/**
 * Competency Snapshot Controller — generates initial competency scores
 * from profile data after onboarding completes.
 *
 * POST /api/competencies/snapshot — generate initial snapshot for the caller
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { generateCompetencySnapshot } from '../services/competencySnapshotService';

export async function generateSnapshot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Unauthorized', 401));

    const result = await generateCompetencySnapshot(userId);
    res.json({ status: 'ok', data: result });
  } catch (err) {
    next(new AppError('Failed to generate competency snapshot', 500));
  }
}
