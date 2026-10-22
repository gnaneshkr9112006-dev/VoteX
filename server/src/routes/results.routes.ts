import { Router } from 'express';
import { getResults, getPublicResults } from '../controllers/resultsController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/room/:roomNumber/results', getPublicResults);
router.get('/:id/results', verifyToken, requireAdmin, getResults);

export default router;
