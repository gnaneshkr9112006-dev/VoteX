import { Router } from 'express';
import multer from 'multer';
import { registerVoter, importVoters, listVoters, removeVoter, enrollVoterFaceAdmin } from '../controllers/voterController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken, requireAdmin);

router.post('/:id/voters', registerVoter);
router.post('/:id/voters/import', upload.single('file'), importVoters);
router.get('/:id/voters', listVoters);
router.delete('/:id/voters/:voterId', removeVoter);
router.post('/:id/voters/:voterId/face', enrollVoterFaceAdmin);

export default router;
