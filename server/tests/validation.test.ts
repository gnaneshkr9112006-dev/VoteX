import { createElection } from '../src/controllers/electionController';
import { addCandidate } from '../src/controllers/candidateController';

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
    createElection: jest.fn().mockResolvedValue({
      onchainId: '0x123',
      txHash: '0xabc',
      blockNumber: 100
    })
  }
}));

describe('Input Validation Controller Unit Tests', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('Election Date Validation', () => {
    it('rejects election creation when startDate is invalid ISO string', async () => {
      req = {
        user: { id: 1 },
        body: {
          title: 'Test Election',
          startTime: 'invalid-date',
          endTime: '2026-12-31T00:00:00.000Z'
        }
      };

      await createElection(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('valid ISO date strings')
        })
      );
    });

    it('rejects election creation when endTime is before startTime', async () => {
      req = {
        user: { id: 1 },
        body: {
          title: 'Test Election',
          startTime: '2026-12-31T00:00:00.000Z',
          endTime: '2026-01-01T00:00:00.000Z'
        }
      };

      await createElection(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('End time must be after start time')
        })
      );
    });
  });

  describe('Candidate Name & Type Validation', () => {
    it('rejects candidate addition when name is non-string or whitespace', async () => {
      req = {
        user: { id: 1, role: 'admin' },
        params: { id: '10' },
        body: {
          name: '   ',
          party: 'Democratic Party',
          candidateCode: 'CAN-01'
        }
      };

      await addCandidate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Candidate name is required and must be text')
        })
      );
    });

    it('rejects candidate addition when name is a numeric type', async () => {
      req = {
        user: { id: 1, role: 'admin' },
        params: { id: '10' },
        body: {
          name: 12345,
          party: 'Democratic Party',
          candidateCode: 'CAN-01'
        }
      };

      await addCandidate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
