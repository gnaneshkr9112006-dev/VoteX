import { publishResults, closeElection, getElection } from '../src/controllers/electionController';
import { getResults, getPublicResults } from '../src/controllers/resultsController';
import { pool } from '../src/db/connection';

jest.mock('../src/db/connection', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../src/services/socketService', () => ({
  emitResultsPublished: jest.fn(),
  emitVoteUpdate: jest.fn()
}));

describe('Permissions and Access Controls', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('Admin Room Isolation', () => {
    it('prevents an admin from viewing or managing another admin election room', async () => {
      req = {
        user: { id: 101, role: 'admin' }, // Admin 101
        params: { id: '1' }
      };

      // Query checks `WHERE id = ? AND admin_id = ?` and finds no match
      (pool.query as jest.Mock).mockResolvedValueOnce([[]]);

      await getElection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Election not found or access denied' })
      );
    });

    it('prevents an admin from closing another admin election room', async () => {
      req = {
        user: { id: 101, role: 'admin' },
        params: { id: '2' },
        ip: '127.0.0.1'
      };

      (pool.query as jest.Mock).mockResolvedValueOnce([[]]); // Not owned by admin 101

      await closeElection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Election not found or access denied' })
      );
    });
  });

  describe('Result Publication Permissions', () => {
    it('blocks publication if election is still active and end time has not passed', async () => {
      req = {
        user: { id: 101, role: 'admin' },
        params: { id: '1' },
        ip: '127.0.0.1'
      };

      (pool.query as jest.Mock).mockResolvedValueOnce([
        [{
          status: 'active',
          room_number: 'SIT-4821',
          end_time: new Date(Date.now() + 3600000) // 1 hour in the future
        }]
      ]);

      await publishResults(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Results can only be published after the election is closed or its end time has passed'
        })
      );
    });

    it('allows publication when the election has been closed early', async () => {
      req = {
        user: { id: 101, role: 'admin' },
        params: { id: '1' },
        ip: '127.0.0.1'
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[{
          status: 'closed',
          room_number: 'SIT-4821',
          end_time: new Date(Date.now() + 3600000)
        }]])
        .mockResolvedValueOnce([{}]) // UPDATE election_rooms
        .mockResolvedValueOnce([{}]); // INSERT audit_logs

      await publishResults(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Results published successfully'
        })
      );
    });

    it('allows publication when the election end time has passed even if status was active', async () => {
      req = {
        user: { id: 101, role: 'admin' },
        params: { id: '1' },
        ip: '127.0.0.1'
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[{
          status: 'active',
          room_number: 'SIT-4821',
          end_time: new Date(Date.now() - 3600000) // Ended 1 hour ago
        }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

      await publishResults(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Results published successfully'
        })
      );
    });
  });

  describe('Voter Results Access Permissions', () => {
    it('blocks voter from viewing results before administrator publishes them', async () => {
      req = {
        params: { roomNumber: 'SIT-4821' }
      };

      (pool.query as jest.Mock).mockResolvedValueOnce([
        [{
          id: 1,
          title: 'Campus Election',
          room_number: 'SIT-4821',
          status: 'active',
          results_published: 0
        }]
      ]);

      await getPublicResults(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Results have not been published yet',
          published: false
        })
      );
    });

    it('allows voter to view results once administrator publishes them', async () => {
      req = {
        params: { roomNumber: 'SIT-4821' }
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[{
          id: 1,
          title: 'Campus Election',
          room_number: 'SIT-4821',
          status: 'published',
          results_published: 1
        }]])
        .mockResolvedValueOnce([[{ id: 1, candidate_code: 'CAN-1', name: 'Alice', party: 'Independent' }]])
        .mockResolvedValueOnce([[{ total_votes: 1 }]])
        .mockResolvedValueOnce([[{ total: 10 }]]);

      await getPublicResults(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          published: true,
          election: expect.objectContaining({
            title: 'Campus Election',
            status: 'published'
          }),
          totalVotes: 1,
          totalVoters: 10
        })
      );
    });
  });
});
