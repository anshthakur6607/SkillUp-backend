/**
 * Heatmap Controller — HTTP endpoints for skill heatmap data.
 *
 * GET /api/heatmap          — full department × competency heatmap
 * GET /api/heatmap/:dept    — heatmap for a specific department
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { generateHeatmap, generateDepartmentHeatmap } from '../services/heatmapService';

export async function getFullHeatmap(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await generateHeatmap();
    res.json({ status: 'ok', data });
  } catch (err) {
    next(new AppError('Failed to generate heatmap', 500));
  }
}

export async function getDepartmentHeatmap(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { department } = req.params;
    if (!department) return next(new AppError('Department is required', 400));

    const data = await generateDepartmentHeatmap(decodeURIComponent(department));
    res.json({ status: 'ok', data });
  } catch (err) {
    next(new AppError('Failed to generate department heatmap', 500));
  }
}
