import { Router } from 'express';
import { getAuditLog, verifyReceiptOnChain } from '../controllers/auditController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/elections/:id/audit', verifyToken, requireAdmin, getAuditLog);
router.get('/audit/verify/:receiptCode', verifyReceiptOnChain);

export default router;
