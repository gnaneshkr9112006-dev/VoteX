import { Router } from 'express';
import { addCandidate, editCandidate, removeCandidate, listCandidates } from '../controllers/candidateController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const adminAuth = [verifyToken, requireAdmin];

router.get('/:id/candidates', listCandidates);
router.post('/:id/candidates', ...adminAuth, addCandidate);
router.put('/:id/candidates/:candidateId', ...adminAuth, editCandidate);
router.delete('/:id/candidates/:candidateId', ...adminAuth, removeCandidate);

export default router;
