/**
 * Recommendation Controller — serves personalized course recommendations.
 *
 * GET /api/recommendations — get personalized recommendations for the caller
 * GET /api/recommendations/explain/:courseId — get explanation for a specific recommendation
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { getRecommendations } from '../services/recommendationService';
import { explainRecommendation } from '../services/knowledgeGraphService';

export async function getPersonalizedRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const limit = parseInt(req.query.limit as string) || 10;
    const recommendations = await getRecommendations(userId, limit);
    res.json({ status: 'ok', data: recommendations });
  } catch (err) {
    next(new AppError('Failed to generate recommendations', 500));
  }
}

export async function explainCourseRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { courseId } = req.params;
    if (!userId) return next(new AppError('Unauthorized', 401));
    if (!courseId) return next(new AppError('courseId is required', 400));

    const explanation = await explainRecommendation(userId, courseId);
    res.json({ status: 'ok', data: { explanation } });
  } catch (err) {
    next(new AppError('Failed to generate explanation', 500));
  }
}
