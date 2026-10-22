import { Router } from 'express';
import {
  adminLogin,
  voterLogin,
  logout,
  getMe,
  unifiedLogin,
  unifiedSelectRole,
  unifiedResetRole,
  googleAuth
} from '../controllers/authController';
import { verifyToken, requireAdmin } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

// Google Identity Services (GIS) Token Verification & Voter Eligibility
router.post('/google', strictLimiter, googleAuth);

// Legacy / Direct authentication
router.post('/admin/login', strictLimiter, adminLogin);
router.post('/voter/login', strictLimiter, voterLogin);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);

// Unified Authentication (Gmail & Phone/Email)
router.post('/unified/login', strictLimiter, unifiedLogin);
router.post('/unified/select-role', strictLimiter, unifiedSelectRole);
router.post('/unified/reset-role', unifiedResetRole);

export default router;
