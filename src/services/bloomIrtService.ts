/**
 * Bloom's Taxonomy + IRT Calibration Service
 *
 * BLOOM'S TAXONOMY (6 levels, from simple to complex):
 * - Remember: recall facts and basic concepts
 * - Understand: explain ideas or concepts
 * - Apply: use information in new situations
 * - Analyze: draw connections among ideas
 * - Evaluate: justify a stand or decision
 * - Create: produce new or original work
 *
 * IRT (Item Response Theory) — 3-parameter logistic model:
 * - a (discrimination): how well the item separates high/low ability
 * - b (difficulty): the ability level at which P(correct) = 0.5
 * - c (guessing): probability of correct answer by guessing
 *
 * Used to:
 * 1. Tag every question with a Bloom's level
 * 2. Track IRT parameters per question for adaptive difficulty
 * 3. Estimate user ability after each answer
 */

// Bloom's taxonomy levels (ordered from simple to complex)
export const BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
] as const;

export type BloomLevel = typeof BLOOM_LEVELS[number];

// Bloom's level descriptions for prompt injection
export const BLOOM_DESCRIPTIONS: Record<BloomLevel, string> = {
  remember: 'Recall facts and basic concepts. "What is...", "List...", "Define..."',
  understand: 'Explain ideas or concepts. "Describe...", "Explain why...", "Summarize..."',
  apply: 'Use information in new situations. "How would you apply...", "Solve..."',
  analyze: 'Draw connections among ideas. "Compare...", "What are the causes of...", "Differentiate..."',
  evaluate: 'Justify a stand or decision. "Which is better...", "Evaluate the impact...", "Critique..."',
  create: 'Produce new or original work. "Design...", "Propose...", "How would you improve..."',
};

// Map difficulty levels to Bloom's ranges
export function difficultyToBloomRange(difficulty: string): BloomLevel[] {
  switch (difficulty) {
    case 'beginner':
      return ['remember', 'understand'];
    case 'intermediate':
      return ['apply', 'analyze'];
    case 'advanced':
      return ['evaluate', 'create'];
    default:
      return ['apply', 'analyze'];
  }
}

// Map a Bloom's level back to difficulty
export function bloomToDifficulty(level: BloomLevel): 'beginner' | 'intermediate' | 'advanced' {
  if (level === 'remember' || level === 'understand') return 'beginner';
  if (level === 'apply' || level === 'analyze') return 'intermediate';
  return 'advanced';
}

/**
 * IRT Item parameters
 */
export interface IRTParameters {
  /** Discrimination — how well this question separates strong/weak learners (0.5-2.0 typical) */
  a: number;
  /** Difficulty — ability level where P(correct) = 0.5 (-3 to 3 scale) */
  b: number;
  /** Guessing — probability of correct answer by chance (0-0.3 typical) */
  c: number;
}

/**
 * Default IRT parameters by difficulty level.
 * These are updated as real response data accumulates.
 */
export const DEFAULT_IRT: Record<string, IRTParameters> = {
  beginner: { a: 1.0, b: -1.0, c: 0.25 },
  intermediate: { a: 1.2, b: 0.0, c: 0.20 },
  advanced: { a: 1.5, b: 1.5, c: 0.15 },
};

/**
 * Calculate probability of correct response using 3PL IRT model.
 *
 * P(correct) = c + (1 - c) / (1 + exp(-a * (theta - b)))
 *
 * where theta = user ability
 */
export function irtProbability(theta: number, params: IRTParameters): number {
  const { a, b, c } = params;
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

/**
 * Update user ability estimate after answering a question.
 * Uses Maximum Likelihood Estimation (MLE) via Newton-Raphson.
 *
 * @param theta current ability estimate
 * @param params IRT parameters of the question
 * @param correct whether the answer was correct
 * @param learningRate how aggressively to update (0.3 = conservative, 1.0 = aggressive)
 * @returns new ability estimate
 */
export function updateAbility(
  theta: number,
  params: IRTParameters,
  correct: boolean,
  learningRate: number = 0.5
): number {
  const p = irtProbability(theta, params);
  const q = 1 - p;

  // Derivative components
  const info = Math.pow(params.a, 2) * q * Math.pow((p - params.c) / (1 - params.c), 2) / p;
  const score = correct ? 1 : 0;

  // Newton-Raphson step
  const delta = info > 0.001 ? params.a * (score - p) / info : 0;

  // Apply with learning rate for stability
  const newTheta = theta + learningRate * delta;

  // Clamp to reasonable range
  return Math.max(-3, Math.min(3, newTheta));
}

/**
 * Get initial IRT parameters from a Bloom's level.
 * Higher Bloom's levels tend to be more discriminating and harder.
 */
export function bloomToIRT(level: BloomLevel): IRTParameters {
  const idx = BLOOM_LEVELS.indexOf(level);
  return {
    a: 0.8 + idx * 0.15,  // 0.8 to 1.55
    b: -1.5 + idx * 0.6,  // -1.5 to 1.5
    c: 0.30 - idx * 0.03, // 0.30 to 0.15
  };
}

/**
 * Build an enhanced prompt that includes Bloom's taxonomy levels.
 */
export function buildBloomPrompt(
  courseTitle: string,
  competencies: string[],
  difficulty: string,
  count: number
): string {
  const bloomRange = difficultyToBloomRange(difficulty);

  return `Generate exactly ${count} multiple-choice questions (MCQs) for a government training course assessment.

COURSE: ${courseTitle}
COMPETENCIES: ${competencies.join(', ')}
DIFFICULTY LEVEL: ${difficulty}
BLOOM'S TAXONOMY LEVELS: ${bloomRange.join(', ')}

BLOOM'S TAXONOMY GUIDELINES:
Each question MUST target one of these Bloom's levels:
- remember: "What is...", "Which of the following...", basic definitions and recall
- understand: "Explain why...", "Which statement best describes...", conceptual understanding
- apply: "How would you apply...", "A government officer faces... what should they do?", scenario-based application
- analyze: "Compare...", "What are the root causes of...", breaking down complex situations
- evaluate: "Which approach is more effective and why...", "Critique the following policy...", judgment and justification
- create: "Design a framework for...", "Propose a solution to...", generating new approaches

DIFFICULTY GUIDELINES:
- beginner (remember/understand): Basic knowledge recall. "What is the RTI Act?", "Define stratified sampling."
- intermediate (apply/analyze): Application and analysis. "How would you handle this scenario?", "What factors contributed to..."
- advanced (evaluate/create): Complex judgment and creation. "Evaluate the effectiveness of...", "Design a framework for..."

RULES:
1. Each question must have exactly 4 options (A, B, C, D)
2. Exactly ONE option must be correct
3. Questions should be specific to Indian government context where applicable
4. Include a brief explanation for the correct answer
5. Do NOT include the letters (A, B, C, D) in the options — just the text
6. Make distractors plausible but clearly wrong to someone who knows the material
7. Each question MUST include a "bloomLevel" field indicating which Bloom's level it targets

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1",
      "explanation": "Brief explanation of why this is correct.",
      "difficulty": "${difficulty}",
      "competency": "Relevant competency name",
      "bloomLevel": "remember|understand|apply|analyze|evaluate|create"
    }
  ]
}`;
}

/**
 * Calculate a question's "information" value for a given ability level.
 * Higher information = better question for distinguishing ability at that level.
 * Used in Computerized Adaptive Testing (CAT) to select optimal next question.
 */
export function itemInformation(theta: number, params: IRTParameters): number {
  const p = irtProbability(theta, params);
  const q = 1 - p;
  return Math.pow(params.a, 2) * q * Math.pow((p - params.c) / (1 - params.c), 2) / Math.max(p, 0.001);
}
