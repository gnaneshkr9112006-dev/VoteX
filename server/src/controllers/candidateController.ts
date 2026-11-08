import { Request, Response } from 'express';
import { pool } from '../db/connection';
import { blockchainService } from '../services/blockchainService';

export const addCandidate = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const identifier = req.params.id;
  let { candidateCode, name, party, bio } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Candidate name is required and must be text' });
  }

  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT id, status, title FROM election_rooms WHERE id = ? OR UPPER(TRIM(room_number)) = UPPER(?)'
      : 'SELECT id, status, title FROM election_rooms WHERE (id = ? OR UPPER(TRIM(room_number)) = UPPER(?)) AND admin_id = ?';
    const params = isSuperAdmin ? [identifier, identifier] : [identifier, identifier, adminId];
    const [elections]: any = await pool.query(query, params);
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const election = elections[0];
    const electionId = election.id;

    if (election.status === 'closed' || election.status === 'published') {
      return res.status(400).json({ message: 'Cannot add candidates to a closed or published election' });
    }

    // Auto-generate candidate code if not provided
    if (!candidateCode || !candidateCode.trim()) {
      const [countRows]: any = await pool.query(
        'SELECT COUNT(*) as cnt FROM candidates WHERE election_id = ?',
        [electionId]
      );
      const nextNum = (countRows[0]?.cnt ?? countRows[0]?.['[cnt]'] ?? 0) + 1;
      candidateCode = `CAN-${String(nextNum).padStart(2, '0')}`;
    } else {
      candidateCode = candidateCode.trim().toUpperCase();
    }

    // Check for duplicate candidate code in this election
    const [existing]: any = await pool.query(
      'SELECT id FROM candidates WHERE election_id = ? AND candidate_code = ?',
      [electionId, candidateCode]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: `Candidate code "${candidateCode}" already exists in this election` });
    }

    const [result]: any = await pool.query(
      'INSERT INTO candidates (election_id, candidate_code, name, party, bio) VALUES (?, ?, ?, ?, ?)',
      [electionId, candidateCode, name.trim(), party?.trim() || null, bio?.trim() || null]
    );

    // Register on blockchain if connected
    try {
      await blockchainService.addCandidate(Number(electionId), candidateCode);
    } catch {
      // ignore
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'CANDIDATE_ADDED', `Candidate "${name}" (${candidateCode}) added to "${election.title}"`, req.ip]
    );

    res.status(201).json({
      message: 'Candidate added successfully',
      candidateId: result.insertId,
      candidate: {
        id: result.insertId,
        name: name.trim(),
        party: party?.trim() || null,
        candidate_code: candidateCode,
        bio: bio?.trim() || null
      }
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Candidate code already exists in this election' });
    }
    console.error('Add candidate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const editCandidate = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const { id: identifier, candidateId } = req.params;
  const { name, party, bio } = req.body;

  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT id FROM election_rooms WHERE id = ? OR UPPER(TRIM(room_number)) = UPPER(?)'
      : 'SELECT id FROM election_rooms WHERE (id = ? OR UPPER(TRIM(room_number)) = UPPER(?)) AND admin_id = ?';
    const params = isSuperAdmin ? [identifier, identifier] : [identifier, identifier, adminId];
    const [elections]: any = await pool.query(query, params);
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const electionId = elections[0].id;

    await pool.query(
      'UPDATE candidates SET name = ?, party = ?, bio = ? WHERE id = ? AND election_id = ?',
      [name, party || null, bio || null, candidateId, electionId]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'CANDIDATE_UPDATED', `Candidate ID ${candidateId} updated`, req.ip]
    );

    res.json({ message: 'Candidate updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const removeCandidate = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const { id: identifier, candidateId } = req.params;

  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT id, status FROM election_rooms WHERE id = ? OR UPPER(TRIM(room_number)) = UPPER(?)'
      : 'SELECT id, status FROM election_rooms WHERE (id = ? OR UPPER(TRIM(room_number)) = UPPER(?)) AND admin_id = ?';
    const params = isSuperAdmin ? [identifier, identifier] : [identifier, identifier, adminId];
    const [elections]: any = await pool.query(query, params);
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const electionId = elections[0].id;

    if (elections[0].status === 'closed' || elections[0].status === 'published') {
      return res.status(400).json({ message: 'Cannot remove candidates from a closed or published election' });
    }

    // Check if any votes have already been cast in this election
    const [votes]: any = await pool.query(
      'SELECT COUNT(*) as vote_count FROM room_voters WHERE election_id = ? AND has_voted = 1',
      [electionId]
    );
    const voteCount = votes[0]?.vote_count ?? votes[0]?.['[vote_count]'] ?? 0;
    if (voteCount > 0) {
      return res.status(400).json({ message: 'Cannot remove candidates after votes have been cast' });
    }

    // Get candidate name for audit log
    const [candidates]: any = await pool.query(
      'SELECT name, candidate_code FROM candidates WHERE id = ? AND election_id = ?',
      [candidateId, electionId]
    );
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    await pool.query('DELETE FROM candidates WHERE id = ? AND election_id = ?', [candidateId, electionId]);

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'CANDIDATE_REMOVED', `Candidate "${candidates[0].name}" (${candidates[0].candidate_code}) removed`, req.ip]
    );

    res.json({ message: 'Candidate removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const listCandidates = async (req: Request, res: Response) => {
  const identifier = req.params.id;
  try {
    let electionId = identifier;
    const [rooms]: any = await pool.query(
      'SELECT id FROM election_rooms WHERE id = ? OR UPPER(TRIM(room_number)) = UPPER(?)',
      [identifier, identifier]
    );
    if (rooms && rooms.length > 0) {
      electionId = rooms[0].id;
    }
    const [rows] = await pool.query(
      'SELECT * FROM candidates WHERE election_id = ? ORDER BY name ASC',
      [electionId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
