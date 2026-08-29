/**
 * Assessment Controller — adaptive MCQ assessments for course completion.
 *
 * FLOW:
 * =====
 * 1. POST /api/assessments/start → generates first question (intermediate difficulty)
 * 2. POST /api/assessments/answer → submits answer, returns next question
 * 3. GET /api/assessments/result/:attemptId → final score and competency breakdown
 *
 * ADAPTIVE DIFFICULTY:
 * ====================
 * - Starts at intermediate
 * - 2+ correct in a row → difficulty increases
 * - 2+ wrong in a row → difficulty decreases
 * - 3+ wrong at low level → spike test (try one harder)
 * - Current difficulty shown on UI
 *
 * COURSE COMPLETION:
 * ==================
 * - Must answer at least 5 questions
 * - Must score >= 60% to pass
 * - Passing generates a certificate and updates competency scores
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { supabaseServiceRole } from '../config/supabaseClient';
import { generateMCQs, calculateNextDifficulty } from '../services/aiService';
import type { PostgrestResponse } from '@supabase/supabase-js';

interface AssessmentAttempt {
  id: string;
  user_id: string;
  course_id: string;
  score: number;
  passed: boolean;
  started_at: string;
  completed_at: string | null;
}

interface QuestionState {
  currentDifficulty: 'beginner' | 'intermediate' | 'advanced';
  consecutiveCorrect: number;
  consecutiveWrong: number;
  questionsAnswered: number;
  totalCorrect: number;
  totalQuestions: number;
}

/**
 * POST /api/assessments/start
 *
 * Starts a new assessment for a course.
 * Generates the first MCQ using AI.
 */
export async function startAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { courseId } = req.body;
    const userId = req.user?.id;

    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!courseId) return next(new AppError('courseId is required', 400));

    // Get course info
    const { data: course, error: courseErr } = await supabaseServiceRole
      .from('courses')
      .select('id, title, description')
      .eq('id', courseId)
      .single();

    if (courseErr || !course) return next(new AppError('Course not found', 404));

    // Get competencies for this course
    const { data: courseComps } = await supabaseServiceRole
      .from('course_competencies')
      .select('competencies(name)')
      .eq('course_id', courseId);

    const competencies = (courseComps || [])
      .map((cc: Record<string, unknown>) => (cc.competencies as Record<string, string>)?.name)
      .filter(Boolean);

    // Create attempt record
    const { data: attempt, error: attemptErr } = await supabaseServiceRole
      .from('assessment_attempts')
      .insert({
        user_id: userId,
        assessment_id: courseId, // Using course_id as assessment_id for simplicity
        score: 0,
        passed: false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (attemptErr || !attempt) return next(new AppError('Failed to create assessment', 500));

    // Generate first question at intermediate difficulty
    const { questions, modelUsed } = await generateMCQs({
      courseTitle: course.title,
      competencies,
      difficulty: 'intermediate',
      count: 1,
    });

    if (questions.length === 0) {
      return next(new AppError('Failed to generate question. Please try again.', 500));
    }

    const question = questions[0];

    // Store the question state in the response (client maintains state between questions)
    const questionState: QuestionState = {
      currentDifficulty: 'intermediate',
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      questionsAnswered: 1,
      totalCorrect: 0,
      totalQuestions: 5,
    };

    res.json({
      status: 'ok',
      data: {
        attemptId: attempt.id,
        question: {
          id: `q-${Date.now()}`,
          text: question.question,
          options: question.options,
          difficulty: question.difficulty,
          competency: question.competency,
          bloomLevel: question.bloomLevel,
        },
        state: questionState,
        modelUsed,
        courseTitle: course.title,
      },
    });
  } catch (err) {
    next(new AppError('Failed to start assessment', 500));
  }
}

/**
 * POST /api/assessments/answer
 *
 * Submits an answer and returns the next question.
 * Uses adaptive difficulty based on performance.
 */
export async function submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { attemptId, selectedAnswer, correctAnswer, difficulty, state } = req.body;
    const userId = req.user?.id;

    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!attemptId || !selectedAnswer) return next(new AppError('attemptId and selectedAnswer are required', 400));

    // Verify attempt belongs to user
    const { data: attempt } = await supabaseServiceRole
      .from('assessment_attempts')
      .select('id, user_id, course_id')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single();

    if (!attempt) return next(new AppError('Assessment not found', 404));

    // Record the answer
    const isCorrect = selectedAnswer === correctAnswer;
    await supabaseServiceRole.from('assessment_answers').insert({
      attempt_id: attemptId,
      question_id: `q-${Date.now()}`,
      selected_answer: selectedAnswer,
      correct: isCorrect,
    });

    // Update state
    const currentState: QuestionState = state || {
      currentDifficulty: 'intermediate',
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      questionsAnswered: 0,
      totalCorrect: 0,
      totalQuestions: 5,
    };

    currentState.questionsAnswered++;
    if (isCorrect) {
      currentState.totalCorrect++;
      currentState.consecutiveCorrect++;
      currentState.consecutiveWrong = 0;
    } else {
      currentState.consecutiveWrong++;
      currentState.consecutiveCorrect = 0;
    }

    // Check if assessment is complete (5 questions minimum)
    if (currentState.questionsAnswered >= currentState.totalQuestions) {
      // Calculate final score
      const score = Math.round((currentState.totalCorrect / currentState.questionsAnswered) * 100);
      const passed = score >= 60;

      // Update attempt
      await supabaseServiceRole
        .from('assessment_attempts')
        .update({
          score,
          passed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      // If passed, generate certificate and update competency scores
      if (passed) {
        await generateCertificate(userId, attempt.course_id);
        await updateCompetencyScores(userId, attempt.course_id, score);
      }

      res.json({
        status: 'ok',
        data: {
          completed: true,
          score,
          passed,
          totalCorrect: currentState.totalCorrect,
          totalQuestions: currentState.questionsAnswered,
          passThreshold: 60,
        },
      });
      return;
    }

    // Calculate next difficulty
    const nextDifficulty = calculateNextDifficulty(
      currentState.currentDifficulty as 'beginner' | 'intermediate' | 'advanced',
      isCorrect,
      currentState.consecutiveWrong,
      currentState.consecutiveCorrect,
      currentState.questionsAnswered
    );

    currentState.currentDifficulty = nextDifficulty;

    // Get course info for next question
    const { data: course } = await supabaseServiceRole
      .from('courses')
      .select('title')
      .eq('id', attempt.course_id)
      .single();

    const { data: courseComps } = await supabaseServiceRole
      .from('course_competencies')
      .select('competencies(name)')
      .eq('course_id', attempt.course_id);

    const competencies = (courseComps || [])
      .map((cc: Record<string, unknown>) => (cc.competencies as Record<string, string>)?.name)
      .filter(Boolean);

    // Generate next question
    const { questions, modelUsed } = await generateMCQs({
      courseTitle: course?.title || 'Course',
      competencies,
      difficulty: nextDifficulty,
      count: 1,
    });

    if (questions.length === 0) {
      return next(new AppError('Failed to generate next question', 500));
    }

    const question = questions[0];

    res.json({
      status: 'ok',
      data: {
        completed: false,
        wasCorrect: isCorrect,
        nextQuestion: {
          id: `q-${Date.now()}`,
          text: question.question,
          options: question.options,
          difficulty: question.difficulty,
          competency: question.competency,
          bloomLevel: question.bloomLevel,
        },
        state: currentState,
        modelUsed,
      },
    });
  } catch (err) {
    next(new AppError('Failed to submit answer', 500));
  }
}

/**
 * GET /api/assessments/result/:attemptId
 *
 * Returns the final result of an assessment.
 */
export async function getAssessmentResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { attemptId } = req.params;
    const userId = req.user?.id;

    if (!userId) return next(new AppError('Unauthorized', 401));

    const { data: attempt, error } = await supabaseServiceRole
      .from('assessment_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single();

    if (error || !attempt) return next(new AppError('Assessment not found', 404));

    // Get answers
    const { data: answers } = await supabaseServiceRole
      .from('assessment_answers')
      .select('*')
      .eq('attempt_id', attemptId);

    res.json({
      status: 'ok',
      data: {
        attempt,
        answers: answers || [],
      },
    });
  } catch (err) {
    next(new AppError('Failed to get assessment result', 500));
  }
}

/**
 * Generate a certificate after passing an assessment.
 */
async function generateCertificate(userId: string, courseId: string): Promise<void> {
  const verificationCode = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const verificationHash = Buffer.from(`${userId}-${courseId}-${Date.now()}`).toString('base64');

  await supabaseServiceRole.from('certificates').upsert(
    {
      user_id: userId,
      course_id: courseId,
      issued_at: new Date().toISOString(),
      verification_code: verificationCode,
      verification_hash: verificationHash,
    },
    { onConflict: 'user_id,course_id' }
  );
}

/**
 * Update competency scores based on assessment performance.
 */
async function updateCompetencyScores(userId: string, courseId: string, score: number): Promise<void> {
  // Get competencies for this course
  const { data: courseComps } = await supabaseServiceRole
    .from('course_competencies')
    .select('competency_id')
    .eq('course_id', courseId);

  if (!courseComps || courseComps.length === 0) return;

  for (const cc of courseComps) {
    const { data: existing } = await supabaseServiceRole
      .from('user_competency_scores')
      .select('id, score')
      .eq('user_id', userId)
      .eq('competency_id', cc.competency_id)
      .single();

    const weight = 0.3; // Assessment counts for 30%

    if (existing) {
      const newScore = Math.min(100, existing.score * (1 - weight) + score * weight);
      await supabaseServiceRole
        .from('user_competency_scores')
        .update({
          score: Math.round(newScore * 10) / 10,
          last_assessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabaseServiceRole.from('user_competency_scores').insert({
        user_id: userId,
        competency_id: cc.competency_id,
        score,
        last_assessed_at: new Date().toISOString(),
      });
    }
  }
}
