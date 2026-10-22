import { Router } from 'express';
import { addCandidate, editCandidate, removeCandidate, listCandidates } from '../controllers/candidateController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/:id/candidates', listCandidates);

router.use(verifyToken, requireAdmin);
router.post('/:id/candidates', addCandidate);
router.put('/:id/candidates/:candidateId', editCandidate);
router.delete('/:id/candidates/:candidateId', removeCandidate);

export default router;
