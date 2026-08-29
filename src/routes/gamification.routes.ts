/**
 * Gamification Routes
 *
 * GET /api/gamification/profile  — get full gamification profile
 * GET /api/gamification/badges   — list all badges with earned status
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { getProfile, getBadges } from '../controllers/gamificationController';

const router = Router();

router.get('/gamification/profile', verifyAuth, getProfile);
router.get('/gamification/badges', verifyAuth, getBadges);

export default router;
