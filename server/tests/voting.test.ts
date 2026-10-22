import { castVote, verifyWebAuthn } from '../src/controllers/voteController';
import { pool } from '../src/db/connection';
import { blockchainService } from '../src/services/blockchainService';

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

describe('Duplicate Vote Prevention and Voting Constraints', () => {
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

  it('rejects vote if voter is not registered in the election room', async () => {
    mockConn.query.mockResolvedValueOnce([[]]); // No room_voters row

    await castVote(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Not registered for this election room' })
    );
  });

  it('rejects duplicate vote if voter has already voted in database', async () => {
    // Return room_voters with has_voted = 1
    mockConn.query.mockResolvedValueOnce([
      [{ has_voted: 1, verification_proof_hash: 'proof_123' }]
    ]);

    await castVote(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'You have already voted in this election room.' })
    );
    expect(blockchainService.castVote).not.toHaveBeenCalled();
  });

  it('rejects duplicate vote if smart contract reports DUPLICATE_VOTE on-chain', async () => {
    // Room voter has not voted in DB yet
    mockConn.query
      .mockResolvedValueOnce([[{ has_voted: 0, verification_proof_hash: 'proof_123' }]]) // room_voters
      .mockResolvedValueOnce([[{ // election_rooms
        status: 'active',
        start_time: new Date(Date.now() - 3600000),
        end_time: new Date(Date.now() + 3600000),
        room_number: 'SIT-1234'
      }]])
      .mockResolvedValueOnce([[{ id: 5, candidate_code: 'CAN-1' }]]) // candidates
      .mockResolvedValueOnce([[{ voter_id: 'VOTER-001' }]]); // voters

    (blockchainService.castVote as jest.Mock).mockRejectedValueOnce(new Error('DUPLICATE_VOTE'));

    await castVote(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'You have already voted in this election room.' })
    );
  });

  it('blocks voting outside the scheduled election timing window', async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ has_voted: 0, verification_proof_hash: 'proof_123' }]])
      .mockResolvedValueOnce([[{
        status: 'active',
        start_time: new Date(Date.now() + 3600000), // In future
        end_time: new Date(Date.now() + 7200000),
        room_number: 'SIT-1234'
      }]]);

    await castVote(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Voting is not allowed outside the scheduled time window' })
    );
  });

  it('successfully casts vote and generates private receipt without candidate info on receipt', async () => {
    mockConn.query
      .mockResolvedValueOnce([[{ has_voted: 0, verification_proof_hash: 'proof_hash_val' }]])
      .mockResolvedValueOnce([[{
        status: 'active',
        start_time: new Date(Date.now() - 3600000),
        end_time: new Date(Date.now() + 3600000),
        room_number: 'SIT-1234'
      }]])
      .mockResolvedValueOnce([[{ id: 5, candidate_code: 'CAN-1' }]])
      .mockResolvedValueOnce([[{ voter_id: 'VOTER-001' }]])
      .mockResolvedValueOnce([{}]) // UPDATE room_voters
      .mockResolvedValueOnce([{}]) // INSERT vote_receipts
      .mockResolvedValueOnce([{}]) // INSERT blockchain_transactions
      .mockResolvedValueOnce([{}]); // INSERT audit_logs

    (blockchainService.castVote as jest.Mock).mockResolvedValueOnce({
      txHash: '0xabcdef1234567890',
      blockNumber: 42
    });

    await castVote(req, res);

    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Vote cast successfully',
        receiptCode: expect.stringMatching(/^VTX-[A-Z0-9]+$/),
        txHash: '0xabcdef1234567890',
        blockNumber: 42
      })
    );
    // Ensure candidate selection is NOT returned in response
    const jsonArgs = res.json.mock.calls[0][0];
    expect(jsonArgs.candidateId).toBeUndefined();
    expect(jsonArgs.candidateCode).toBeUndefined();
  });
});
