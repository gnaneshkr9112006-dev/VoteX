import { Router } from 'express';
import {
  createElection,
  listElections,
  getElection,
  updateElection,
  closeElection,
  publishResults,
  getElectionStats,
  listPublicElections,
  seedScaleElections
} from '../controllers/electionController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public election exploration
router.get('/public', listPublicElections);

const adminAuth = [verifyToken, requireAdmin];

router.post('/scale/seed-200', ...adminAuth, seedScaleElections);
router.post('/', ...adminAuth, createElection);
router.get('/', ...adminAuth, listElections);
router.get('/:id', ...adminAuth, getElection);
router.put('/:id', ...adminAuth, updateElection);
router.post('/:id/close', ...adminAuth, closeElection);
router.post('/:id/publish', ...adminAuth, publishResults);
router.get('/:id/stats', ...adminAuth, getElectionStats);

export default router;
