/**
 * What-If Simulator Routes
 *
 * POST /api/admin/whatif — ask a workforce planning question
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { requireRole } from '../middleware/requireRole';
import { simulateWhatIf } from '../controllers/whatIfController';

const router = Router();

router.post('/admin/whatif', verifyAuth, requireRole('admin', 'manager'), simulateWhatIf);

export default router;
