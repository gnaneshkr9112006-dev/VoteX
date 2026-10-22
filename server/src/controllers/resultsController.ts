import { Request, Response } from 'express';
import { pool } from '../db/connection';
import { blockchainService } from '../services/blockchainService';

export const getResults = async (req: Request, res: Response) => {
  const electionId = req.params.id;
  try {
    const [elections]: any = await pool.query(
      'SELECT id, title, room_number, status, results_published FROM election_rooms WHERE id = ?',
      [electionId]
    );
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election not found' });
    }
    if (elections[0].status !== 'published' || !elections[0].results_published) {
      return res.status(403).json({ message: 'Results have not been published yet' });
    }

    // Get candidate vote counts from MySQL
    const [candidates]: any = await pool.query(
      `SELECT c.id, c.candidate_code, c.name, c.party,
              (SELECT COUNT(*) FROM vote_receipts vr
               JOIN blockchain_transactions bt ON vr.tx_hash = bt.tx_hash
               WHERE bt.election_id = c.election_id AND bt.action_type = 'VOTE_CAST') as blockchain_votes
       FROM candidates c
       WHERE c.election_id = ?
       ORDER BY c.name ASC`,
      [electionId]
    );

    // Get total vote count from room_voters (source of truth)
    const [voteStats]: any = await pool.query(
      'SELECT COUNT(*) as total_votes FROM room_voters WHERE election_id = ? AND has_voted = 1',
      [electionId]
    );

    const [totalVoters]: any = await pool.query(
      'SELECT COUNT(*) as voter_count FROM room_voters WHERE election_id = ?',
      [electionId]
    );

    let onchainVotes = new Map<string, number>();
    try {
      const bResults = await blockchainService.getResults(
        Number(electionId),
        candidates.map((c: any) => c.candidate_code)
      );
      bResults.forEach((r: any) => onchainVotes.set(r.candidateId, r.votes));
    } catch (e) {
      console.warn('Could not fetch blockchain results:', e);
    }

    res.json({
      election: {
        id: elections[0].id,
        title: elections[0].title,
        roomNumber: elections[0].room_number,
        status: elections[0].status
      },
      candidates: candidates.map((c: any) => ({
        id: c.id,
        code: c.candidate_code,
        name: c.name,
        party: c.party,
        votes: onchainVotes.has(c.candidate_code)
          ? onchainVotes.get(c.candidate_code)
          : (c.blockchain_votes || 0)
      })),
      totalVotes: voteStats[0].total_votes || 0,
      totalVoters: totalVoters[0].voter_count ?? totalVoters[0].total ?? 0
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPublicResults = async (req: Request, res: Response) => {
  const { roomNumber } = req.params;
  try {
    const [elections]: any = await pool.query(
      'SELECT id, title, room_number, status, results_published FROM election_rooms WHERE room_number = ?',
      [roomNumber]
    );
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election room not found' });
    }
    if (elections[0].status !== 'published' || !elections[0].results_published) {
      return res.status(403).json({ message: 'Results have not been published yet', published: false });
    }

    const electionId = elections[0].id;

    const [candidates]: any = await pool.query(
      `SELECT c.id, c.candidate_code, c.name, c.party
       FROM candidates c WHERE c.election_id = ? ORDER BY c.name ASC`,
      [electionId]
    );

    const [voteStats]: any = await pool.query(
      'SELECT COUNT(*) as total_votes FROM room_voters WHERE election_id = ? AND has_voted = 1',
      [electionId]
    );

    const [totalVoters]: any = await pool.query(
      'SELECT COUNT(*) as voter_count FROM room_voters WHERE election_id = ?',
      [electionId]
    );

    let onchainVotes = new Map<string, number>();
    try {
      const bResults = await blockchainService.getResults(
        Number(electionId),
        candidates.map((c: any) => c.candidate_code)
      );
      bResults.forEach((r: any) => onchainVotes.set(r.candidateId, r.votes));
    } catch (e) {
      console.warn('Could not fetch blockchain results:', e);
    }

    res.json({
      published: true,
      election: {
        id: elections[0].id,
        title: elections[0].title,
        roomNumber: elections[0].room_number,
        status: elections[0].status
      },
      candidates: candidates.map((c: any) => ({
        id: c.id,
        code: c.candidate_code,
        name: c.name,
        party: c.party,
        votes: onchainVotes.has(c.candidate_code)
          ? onchainVotes.get(c.candidate_code)
          : 0
      })),
      totalVotes: voteStats[0].total_votes || 0,
      totalVoters: totalVoters[0].voter_count ?? totalVoters[0].total ?? 0
    });
  } catch (error) {
    console.error('Get public results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
