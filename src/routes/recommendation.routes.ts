/**
 * Recommendation Routes
 *
 * GET /api/recommendations            — personalized recommendations
 * GET /api/recommendations/explain/:id — explanation for a recommendation
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { getPersonalizedRecommendations, explainCourseRecommendation } from '../controllers/recommendationController';

const router = Router();

router.get('/recommendations', verifyAuth, getPersonalizedRecommendations);
router.get('/recommendations/explain/:courseId', verifyAuth, explainCourseRecommendation);

export default router;
