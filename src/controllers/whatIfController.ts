/**
 * What-If Simulator Controller — lets admins ask workforce planning questions.
 *
 * Example: "If 30% of Group B officers complete the AI/ML track,
 * what's the projected capability gain?"
 *
 * Uses Gemini function calling to parse natural language into structured queries,
 * then computes answers against real workforce data.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { supabaseServiceRole } from '../config/supabaseClient';
import { env } from '../config/env';

interface WhatIfResult {
  question: string;
  interpretation: string;
  baseline: {
    department: string;
    competency: string;
    currentAvg: number;
    userCount: number;
  }[];
  projection: {
    scenario: string;
    projectedAvg: number;
    improvement: number;
    usersAffected: number;
  };
  recommendation: string;
}

/**
 * POST /api/admin/whatif
 *
 * Accepts a natural language question, parses it, and returns a computed answer.
 */
export async function simulateWhatIf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { question } = req.body;
    if (!question) return next(new AppError('question is required', 400));

    // Try Gemini to parse the question into structured parameters
    const parsed = await parseQuestionWithAI(question);

    if (!parsed) {
      // Fallback: return a generic analysis
      res.json({
        status: 'ok',
        data: {
          question,
          interpretation: 'Unable to parse the question. Please try rephrasing.',
          baseline: [],
          projection: { scenario: 'N/A', projectedAvg: 0, improvement: 0, usersAffected: 0 },
          recommendation: 'Try asking: "What is the average competency score for Statistical Officers?" or "How many officers need Python training?"',
        },
      });
      return;
    }

    // Query real data based on parsed parameters
    const result = await computeScenario(parsed);
    result.question = question;

    res.json({ status: 'ok', data: result });
  } catch (err) {
    next(new AppError('What-if simulation failed', 500));
  }
}

async function parseQuestionWithAI(question: string): Promise<{
  department?: string;
  competency?: string;
  designation?: string;
  improvementPercent?: number;
  queryType: string;
} | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Parse this workforce planning question into structured parameters. Return ONLY valid JSON, no markdown.\n\nQuestion: ${question}\n\nReturn JSON:\n{\n  "department": "department name or null",\n  "competency": "competency name or null",\n  "designation": "designation or null",\n  "improvementPercent": number or null,\n  "queryType": "gap_analysis" | "projection" | "comparison" | "summary"\n}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!resp.ok) return null;
    const data = (await resp.json()) as Record<string, unknown>;
    const candidates = data.candidates as Record<string, unknown>[] | undefined;
    const content = (candidates?.[0] as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Record<string, unknown>[] | undefined;
    const text = (parts?.[0]?.text as string) || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function computeScenario(params: {
  department?: string;
  competency?: string;
  designation?: string;
  improvementPercent?: number;
  queryType: string;
}): Promise<WhatIfResult> {
  // Get current competency data
  let query = supabaseServiceRole
    .from('user_competency_scores')
    .select('score, competency_id, competencies(name, competency_domains(name)), user_id, profiles!inner(designation, department_id)');

  const { data: rows } = await query;

  // Filter by parameters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filtered = (rows || []) as any[];

  if (params.competency) {
    filtered = filtered.filter((r) => {
      const comps = r.competencies;
      const name = Array.isArray(comps) ? comps[0]?.name : comps?.name;
      return name?.toLowerCase().includes(params.competency!.toLowerCase());
    });
  }

  if (params.designation) {
    filtered = filtered.filter((r) => {
      const profiles = r.profiles;
      const des = Array.isArray(profiles) ? profiles[0]?.designation : profiles?.designation;
      return des?.toLowerCase().includes(params.designation!.toLowerCase());
    });
  }

  // Compute baseline
  const baseline = filtered.length > 0
    ? [{
        department: 'All',
        competency: params.competency || 'All',
        currentAvg: Math.round(filtered.reduce((s: number, r: { score: number }) => s + (r.score || 0), 0) / filtered.length),
        userCount: filtered.length,
      }]
    : [];

  const currentAvg = baseline[0]?.currentAvg || 0;
  const improvement = params.improvementPercent || 20;
  const projectedAvg = Math.min(100, Math.round(currentAvg + (improvement * 0.3))); // 30% of improvement is realistic

  return {
    question: '',
    interpretation: `Analyzing ${params.designation || 'all'} officers in ${params.competency || 'all competencies'}${params.department ? ` in ${params.department}` : ''}.`,
    baseline,
    projection: {
      scenario: `${improvement}% training completion`,
      projectedAvg,
      improvement: projectedAvg - currentAvg,
      usersAffected: filtered.length,
    },
    recommendation: projectedAvg > 70
      ? 'Current trajectory looks good. Focus on maintaining momentum.'
      : 'Consider targeted training interventions. The gap analysis shows significant room for improvement.',
  };
}
