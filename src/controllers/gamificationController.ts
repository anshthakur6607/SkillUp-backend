/**
 * Gamification Controller — endpoints for badges, XP, streaks, and milestones.
 *
 * GET /api/gamification/profile  — get full gamification profile
 * GET /api/gamification/badges   — list all badges with earned status
 * GET /api/gamification/streak   — get current learning streak
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { getGamificationProfile, getAllBadges } from '../services/gamificationService';

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const profile = await getGamificationProfile(userId);
    res.json({ status: 'ok', data: profile });
  } catch (err) {
    next(new AppError('Failed to fetch gamification profile', 500));
  }
}

export async function getBadges(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const badges = getAllBadges();
    res.json({ status: 'ok', data: badges });
  } catch (err) {
    next(new AppError('Failed to fetch badges', 500));
  }
}
