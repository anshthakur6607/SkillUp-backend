/**
 * Assessment Routes — adaptive MCQ assessments for course completion.
 *
 * POST /api/assessments/start    → start a new assessment
 * POST /api/assessments/answer   → submit answer, get next question
 * GET  /api/assessments/result/:id → get final result
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import {
  startAssessment,
  submitAnswer,
  getAssessmentResult,
} from '../controllers/assessmentController';

const router = Router();

router.post('/assessments/start', verifyAuth, startAssessment);
router.post('/assessments/answer', verifyAuth, submitAnswer);
router.get('/assessments/result/:attemptId', verifyAuth, getAssessmentResult);

export default router;
