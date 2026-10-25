import { Router } from 'express';
import {
  adminLogin,
  voterLogin,
  logout,
  getMe
} from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

// Authentication
router.post('/admin/login', strictLimiter, adminLogin);
router.post('/voter/login', strictLimiter, voterLogin);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);

export default router;
