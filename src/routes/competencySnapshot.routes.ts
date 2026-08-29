/**
 * Competency Snapshot Routes
 *
 * POST /api/competencies/snapshot — generate initial competency scores from profile
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { generateSnapshot } from '../controllers/competencySnapshotController';

const router = Router();

router.post('/competencies/snapshot', verifyAuth, generateSnapshot);

export default router;
