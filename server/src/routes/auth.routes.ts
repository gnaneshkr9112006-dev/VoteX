import { Router } from 'express';
import {
  adminLogin,
  sendVoterOtp,
  verifyVoterOtp,
  voterLogin,
  logout,
  getMe,
  lookupVoterPhone
} from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

// Authentication
router.post('/admin/login', strictLimiter, adminLogin);
router.post('/voter/lookup-phone', lookupVoterPhone);
router.post('/voter/send-otp', strictLimiter, sendVoterOtp);
router.post('/voter/verify-otp', strictLimiter, verifyVoterOtp);
router.post('/voter/login', strictLimiter, voterLogin);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);

export default router;
