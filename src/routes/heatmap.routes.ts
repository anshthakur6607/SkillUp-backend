/**
 * Heatmap Routes
 *
 * GET /api/heatmap          — full department × competency heatmap
 * GET /api/heatmap/:dept    — heatmap for a specific department
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { getFullHeatmap, getDepartmentHeatmap } from '../controllers/heatmapController';

const router = Router();

router.get('/heatmap', verifyAuth, getFullHeatmap);
router.get('/heatmap/:department', verifyAuth, getDepartmentHeatmap);

export default router;
