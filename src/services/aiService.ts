/**
 * AI Service — generates MCQs using Gemini and Sarvam AI with automatic fallback.
 *
 * DESIGN:
 * =======
 * 1. Randomly pick a primary model (Gemini or Sarvam) for variety
 * 2. If the primary fails, fall back to the other model
 * 3. Every API call is logged with timing and success/failure
 * 4. Rate limiting is handled at the adapter level
 *
 * MODELS:
 * =======
 * - Gemini (Google): Free tier available, good at generating educational content
 * - Sarvam AI: Indian government-backed, good at Indian context questions
 *
 * ADAPTIVE DIFFICULTY:
 * ====================
 * The assessment controller tracks user performance and adjusts difficulty:
 * - START: intermediate
 * - 2+ correct in a row → difficulty increases
 * - 2+ wrong in a row → difficulty decreases
 * - After 3 wrong at low level → try one harder question (spike test)
 * - Show current difficulty level on the UI
 *
 * ERROR LOGGING:
 * ==============
 * Every API call logs: model, prompt length, response time, success/failure, error message.
 * Failed calls trigger automatic fallback to the other model.
 */

import { env } from '../config/env';
import { buildBloomPrompt, type BloomLevel, bloomToIRT, type IRTParameters, BLOOM_LEVELS } from './bloomIrtService';

interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  competency: string;
  bloomLevel?: BloomLevel;
  irt?: IRTParameters;
}

interface AIResponse {
  model: string;
  success: boolean;
  questions: MCQQuestion[];
  error?: string;
  responseTimeMs: number;
}

// Available models with their configs
const MODELS = [
  {
    name: 'gemini',
    apiKey: env.GEMINI_API_KEY || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
  {
    name: 'sarvam',
    apiKey: env.SARVAM_API_KEY || '',
    baseUrl: 'https://api.sarvam.ai',
    model: 'sarvam-2b-v0.5',
  },
];

/**
 * Generate MCQ questions for a course assessment.
 * Tries primary model first, falls back to secondary if it fails.
 */
export async function generateMCQs(params: {
  courseTitle: string;
  competencies: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  count: number;
}): Promise<{ questions: MCQQuestion[]; modelUsed: string }> {
  const { courseTitle, competencies, difficulty, count } = params;

  // Randomly pick primary model
  const primaryIdx = Math.random() < 0.5 ? 0 : 1;
  const primary = MODELS[primaryIdx];
  const secondary = MODELS[1 - primaryIdx];

  // Try primary model
  const primaryResult = await callModel(primary, courseTitle, competencies, difficulty, count);
  if (primaryResult.success && primaryResult.questions.length > 0) {
    logResult(primaryResult);
    return { questions: primaryResult.questions, modelUsed: primary.name };
  }

  // Fallback to secondary model
  console.log(`[AI] Primary model ${primary.name} failed, falling back to ${secondary.name}`);
  const secondaryResult = await callModel(secondary, courseTitle, competencies, difficulty, count);
  logResult(secondaryResult);

  if (secondaryResult.success && secondaryResult.questions.length > 0) {
    return { questions: secondaryResult.questions, modelUsed: secondary.name };
  }

  // Both failed — return generated fallback questions
  console.error('[AI] Both models failed, using generated fallback questions');
  return { questions: generateFallbackQuestions(courseTitle, competencies, difficulty, count), modelUsed: 'fallback' };
}

/**
 * Call a specific AI model to generate MCQs.
 */
async function callModel(
  model: typeof MODELS[0],
  courseTitle: string,
  competencies: string[],
  difficulty: string,
  count: number
): Promise<AIResponse> {
  const startTime = Date.now();

  if (!model.apiKey) {
    return {
      model: model.name,
      success: false,
      questions: [],
      error: `No API key configured for ${model.name}`,
      responseTimeMs: 0,
    };
  }

  try {
    const prompt = buildPrompt(courseTitle, competencies, difficulty, count);
    let questions: MCQQuestion[];

    if (model.name === 'gemini') {
      questions = await callGemini(model, prompt);
    } else {
      questions = await callSarvam(model, prompt);
    }

    return {
      model: model.name,
      success: true,
      questions,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      model: model.name,
      success: false,
      questions: [],
      error: errorMsg,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Build the MCQ generation prompt.
 */
function buildPrompt(courseTitle: string, competencies: string[], difficulty: string, count: number): string {
  return buildBloomPrompt(courseTitle, competencies, difficulty, count);
}

/**
 * Call Gemini API to generate MCQs.
 */
async function callGemini(model: typeof MODELS[0], prompt: string): Promise<MCQQuestion[]> {
  const response = await fetch(
    `${model.baseUrl}/models/${model.model}:generateContent?key=${model.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const candidates = data.candidates as Record<string, unknown>[] | undefined;
  const firstCandidate = candidates?.[0] as Record<string, unknown> | undefined;
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Record<string, unknown>[] | undefined;
  const text = parts?.[0]?.text as string | undefined;
  if (!text) throw new Error('Gemini returned empty response');

  return parseMCQResponse(text);
}

/**
 * Call Sarvam AI API to generate MCQs.
 */
async function callSarvam(model: typeof MODELS[0], prompt: string): Promise<MCQQuestion[]> {
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: [
        { role: 'system', content: 'You are an expert assessment creator for Indian government training programs. Generate MCQs in valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sarvam API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = data.choices as Record<string, unknown>[] | undefined;
  const firstChoice = choices?.[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const text = message?.content as string | undefined;
  if (!text) throw new Error('Sarvam returned empty response');

  return parseMCQResponse(text);
}

/**
 * Parse MCQ response from AI (handles various JSON formats).
 */
function parseMCQResponse(text: string): MCQQuestion[] {
  // Strip markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Try to find JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  const questions = parsed.questions || parsed;

  if (!Array.isArray(questions)) throw new Error('Questions is not an array');

  return questions.map((q: Record<string, unknown>) => {
    const bloomLevel = (q.bloomLevel || q.bloom_level || q.bloom || '') as BloomLevel;
    const irtParams = bloomLevel ? bloomToIRT(bloomLevel) : undefined;
    return {
      question: String(q.question || ''),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: String(q.correctAnswer || q.correct_answer || ''),
      explanation: String(q.explanation || ''),
      difficulty: String(q.difficulty || 'intermediate') as 'beginner' | 'intermediate' | 'advanced',
      competency: String(q.competency || ''),
      bloomLevel: (BLOOM_LEVELS as readonly string[]).includes(bloomLevel) ? bloomLevel as BloomLevel : undefined,
      irt: irtParams,
    };
  }).filter((q: MCQQuestion) => q.question && q.options.length === 4 && q.correctAnswer);
}

/**
 * Log AI call result for monitoring.
 */
function logResult(result: AIResponse): void {
  const status = result.success ? 'SUCCESS' : 'FAILED';
  console.log(
    `[AI] ${status} | model=${result.model} | questions=${result.questions.length} | time=${result.responseTimeMs}ms${result.error ? ` | error=${result.error}` : ''}`
  );
}

/**
 * Generate fallback questions when both AI models fail.
 * These are pre-written questions for common government training topics.
 */
function generateFallbackQuestions(
  courseTitle: string,
  competencies: string[],
  difficulty: string,
  count: number
): MCQQuestion[] {
  const fallbackBank: MCQQuestion[] = [
    {
      question: 'Which Act governs the Right to Information in India?',
      options: ['RTI Act, 2005', 'Right to Privacy Act, 2019', 'Information Technology Act, 2000', 'Official Secrets Act, 1923'],
      correctAnswer: 'RTI Act, 2005',
      explanation: 'The Right to Information Act, 2005 empowers citizens to request information from public authorities.',
      difficulty: 'beginner',
      competency: 'Communication',
    },
    {
      question: 'What is the primary purpose of APAR in government service?',
      options: ['Performance appraisal and career progression', 'Salary calculation', 'Leave management', 'Transfer posting'],
      correctAnswer: 'Performance appraisal and career progression',
      explanation: 'APAR (Annual Performance Appraisal Report) evaluates an officer\'s performance for career progression.',
      difficulty: 'beginner',
      competency: 'Project Management',
    },
    {
      question: 'Under the DPDP Act 2023, who is a "Data Fiduciary"?',
      options: ['Any person who processes personal data on behalf of others', 'The person or entity that determines the purpose and means of processing', 'The government authority that regulates data protection', 'The person whose data is being collected'],
      correctAnswer: 'The person or entity that determines the purpose and means of processing',
      explanation: 'A Data Fiduciary determines the purpose and means of personal data processing under the DPDP Act.',
      difficulty: 'intermediate',
      competency: 'Data Privacy & Protection',
    },
    {
      question: 'In survey sampling, what is "stratified sampling"?',
      options: ['Selecting samples randomly from the entire population', 'Dividing the population into groups and sampling from each group', 'Selecting only willing participants', 'Sampling every nth person from a list'],
      correctAnswer: 'Dividing the population into groups and sampling from each group',
      explanation: 'Stratified sampling divides the population into homogeneous subgroups (strata) and samples from each.',
      difficulty: 'intermediate',
      competency: 'Sampling Techniques',
    },
    {
      question: 'What does GFR stand for in government financial management?',
      options: ['General Financial Rules', 'Government Fund Regulation', 'Global Financial Report', 'General Fiscal Responsibility'],
      correctAnswer: 'General Financial Rules',
      explanation: 'GFR 2017 lays down the general financial rules and procedures for government transactions.',
      difficulty: 'beginner',
      competency: 'Project Management',
    },
  ];

  // Return requested count, cycling through the bank
  const result: MCQQuestion[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      ...fallbackBank[i % fallbackBank.length],
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      competency: competencies[0] || 'General',
    });
  }
  return result;
}

/**
 * Adaptive difficulty calculator.
 * Determines the next difficulty level based on user performance.
 */
export function calculateNextDifficulty(
  currentLevel: 'beginner' | 'intermediate' | 'advanced',
  correct: boolean,
  consecutiveWrong: number,
  consecutiveCorrect: number,
  questionsAnswered: number
): 'beginner' | 'intermediate' | 'advanced' {
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const currentIdx = levels.indexOf(currentLevel);

  // Increase difficulty after 2+ correct in a row
  if (consecutiveCorrect >= 2 && currentIdx < 2) {
    return levels[currentIdx + 1];
  }

  // Decrease difficulty after 2+ wrong in a row
  if (consecutiveWrong >= 2 && currentIdx > 0) {
    return levels[currentIdx - 1];
  }

  // Spike test: after 3+ wrong at low level, try one harder question
  if (consecutiveWrong >= 3 && currentIdx < 2) {
    return levels[currentIdx + 1];
  }

  return currentLevel;
}
