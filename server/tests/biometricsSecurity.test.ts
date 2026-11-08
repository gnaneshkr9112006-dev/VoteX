import { castVote } from '../src/controllers/voteController';
import { pool } from '../src/db/connection';

jest.mock('../src/db/connection', () => {
  const mockConn = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    release: jest.fn()
  };
  return {
    pool: {
      query: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConn)
    }
  };
});

jest.mock('../src/services/blockchainService', () => ({
  blockchainService: {
    castVote: jest.fn()
  }
}));

jest.mock('../src/services/socketService', () => ({
  emitVoteUpdate: jest.fn(),
  emitResultsPublished: jest.fn()
}));

describe('Biometrics Security & Zero-Trust Ballot Locking', () => {
  let req: any;
  let res: any;
  let mockConn: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConn = await pool.getConnection();

    req = {
      user: { id: 1, electionId: 10 },
      body: { candidateId: 5 },
      ip: '127.0.0.1'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('strictly blocks vote casting with 403 if voter has no biometric verification proof hash', async () => {
    // 1st query: election active check
    mockConn.query.mockResolvedValueOnce([
      [{ id: 10, status: 'active', start_time: '2026-01-01', end_time: '2026-12-31' }]
    ]);

    // 2nd query: room_voters check where has_voted = 0 but verification_proof_hash is null
    mockConn.query.mockResolvedValueOnce([
      [{ id: 1, voter_id: 1, election_id: 10, has_voted: 0, verification_proof_hash: null }]
    ]);

    await castVote(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Biometric identity verification is required')
      })
    );
  });

  it('rejects vote casting if candidateId is non-numeric or NaN', async () => {
    req.body.candidateId = 'not-a-number';

    await castVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Valid candidate selection is required')
      })
    );
  });
});
