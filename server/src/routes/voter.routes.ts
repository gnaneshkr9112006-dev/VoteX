import { Router } from 'express';
import multer from 'multer';
import { registerVoter, importVoters, listVoters, removeVoter, enrollVoterFaceAdmin, clearAllVoters, updateVoter } from '../controllers/voterController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const adminAuth = [verifyToken, requireAdmin];

router.post('/:id/voters', ...adminAuth, registerVoter);
router.post('/:id/voters/import', ...adminAuth, upload.single('file'), importVoters);
router.get('/:id/voters', ...adminAuth, listVoters);
router.put('/:id/voters/:voterId', ...adminAuth, updateVoter);
router.delete('/:id/voters/:voterId', ...adminAuth, removeVoter);
router.delete('/:id/voters', ...adminAuth, clearAllVoters);
router.post('/:id/voters/:voterId/face', ...adminAuth, enrollVoterFaceAdmin);

export default router;
