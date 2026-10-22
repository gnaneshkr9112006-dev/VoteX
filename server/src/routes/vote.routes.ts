import { Router } from 'express';
import { verifyWebAuthn, castVote, getReceipt, getStatus, getVoterFaceProfile, enrollVoterFace } from '../controllers/voteController';
import { verifyToken, requireVoter } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/receipt/:receiptCode', getReceipt);

router.use(verifyToken, requireVoter);
router.get('/face-profile', getVoterFaceProfile);
router.post('/enroll-face', enrollVoterFace);
router.post('/verify', strictLimiter, verifyWebAuthn);
router.post('/cast', strictLimiter, castVote);
router.get('/status', getStatus);

export default router;
