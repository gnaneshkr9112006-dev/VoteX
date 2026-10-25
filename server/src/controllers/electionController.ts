import { Request, Response } from 'express';
import { pool } from '../db/connection';
import { generateRoomNumber } from '../utils/generateRoomNumber';
import { blockchainService } from '../services/blockchainService';
import { emitResultsPublished } from '../services/socketService';

export const createElection = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const { title, startTime, endTime } = req.body;

  if (!title || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, start time, and end time are required' });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) {
    return res.status(400).json({ message: 'End time must be after start time' });
  }

  const roomNumber = generateRoomNumber();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result]: any = await connection.query(
      'INSERT INTO election_rooms (room_number, admin_id, title, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [roomNumber, adminId, title, startTime, endTime]
    );
    const electionId = result.insertId;

    // Register election on blockchain (with empty candidates for now)
    const txResult = await blockchainService.createElection(electionId, []);

    await connection.query(
      'UPDATE election_rooms SET onchain_election_id = ? WHERE id = ?',
      [txResult.onchainId, electionId]
    );

    // Record blockchain transaction
    await connection.query(
      'INSERT INTO blockchain_transactions (election_id, tx_hash, block_number, action_type, timestamp) VALUES (?, ?, ?, ?, NOW())',
      [electionId, txResult.txHash, txResult.blockNumber, 'ELECTION_CREATED']
    );

    // Audit log
    await connection.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'ROOM_CREATED', `Election room ${roomNumber} created: "${title}"`, req.ip]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Election created successfully',
      roomNumber,
      electionId,
      onchainId: txResult.onchainId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create election error:', error);
    res.status(500).json({ message: 'Failed to create election' });
  } finally {
    connection.release();
  }
};

export const listElections = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? `SELECT er.*,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id) as voter_count,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id AND has_voted = 1) as vote_count,
               (SELECT COUNT(*) FROM candidates WHERE election_id = er.id) as candidate_count
        FROM election_rooms er ORDER BY er.created_at DESC`
      : `SELECT er.*,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id) as voter_count,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id AND has_voted = 1) as vote_count,
               (SELECT COUNT(*) FROM candidates WHERE election_id = er.id) as candidate_count
        FROM election_rooms er WHERE er.admin_id = ? ORDER BY er.created_at DESC`;
    const params = isSuperAdmin ? [] : [adminId];
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getElection = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? `SELECT er.*,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id) as voter_count,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id AND has_voted = 1) as vote_count,
               (SELECT COUNT(*) FROM candidates WHERE election_id = er.id) as candidate_count
        FROM election_rooms er WHERE er.id = ?`
      : `SELECT er.*,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id) as voter_count,
               (SELECT COUNT(*) FROM room_voters WHERE election_id = er.id AND has_voted = 1) as vote_count,
               (SELECT COUNT(*) FROM candidates WHERE election_id = er.id) as candidate_count
        FROM election_rooms er WHERE er.id = ? AND er.admin_id = ?`;
    const params = isSuperAdmin ? [electionId] : [electionId, adminId];
    const [rows]: any = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ message: 'Election not found or access denied' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateElection = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  const { title, startTime, endTime } = req.body;

  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT status FROM election_rooms WHERE id = ?'
      : 'SELECT status FROM election_rooms WHERE id = ? AND admin_id = ?';
    const params = isSuperAdmin ? [electionId] : [electionId, adminId];
    const [existing]: any = await pool.query(query, params);
    if (existing.length === 0) return res.status(404).json({ message: 'Election not found or access denied' });
    if (existing[0].status !== 'draft') {
      return res.status(400).json({ message: 'Cannot modify an active or closed election' });
    }

    const updateQuery = isSuperAdmin
      ? 'UPDATE election_rooms SET title = ?, start_time = ?, end_time = ? WHERE id = ?'
      : 'UPDATE election_rooms SET title = ?, start_time = ?, end_time = ? WHERE id = ? AND admin_id = ?';
    const updateParams = isSuperAdmin
      ? [title, startTime, endTime, electionId]
      : [title, startTime, endTime, electionId, adminId];
    await pool.query(updateQuery, updateParams);

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'ELECTION_UPDATED', `Election settings updated`, req.ip]
    );

    res.json({ message: 'Election updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const closeElection = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT status, room_number FROM election_rooms WHERE id = ?'
      : 'SELECT status, room_number FROM election_rooms WHERE id = ? AND admin_id = ?';
    const params = isSuperAdmin ? [electionId] : [electionId, adminId];
    const [rows]: any = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ message: 'Election not found or access denied' });
    if (rows[0].status === 'closed' || rows[0].status === 'published') {
      return res.status(400).json({ message: 'Election is already closed' });
    }

    await pool.query('UPDATE election_rooms SET status = ? WHERE id = ?', ['closed', electionId]);

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'ELECTION_CLOSED', `Election ${rows[0].room_number} closed early by administrator`, req.ip]
    );

    res.json({ message: 'Election closed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const publishResults = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT status, room_number, end_time FROM election_rooms WHERE id = ?'
      : 'SELECT status, room_number, end_time FROM election_rooms WHERE id = ? AND admin_id = ?';
    const params = isSuperAdmin ? [electionId] : [electionId, adminId];
    const [rows]: any = await pool.query(query, params);
    if (rows.length === 0) return res.status(404).json({ message: 'Election not found or access denied' });

    const election = rows[0];
    const now = new Date();
    const endTime = new Date(election.end_time);

    // Allow publishing only if election is closed OR end time has passed
    if (election.status !== 'closed' && now < endTime) {
      return res.status(400).json({
        message: 'Results can only be published after the election is closed or its end time has passed'
      });
    }

    await pool.query(
      'UPDATE election_rooms SET status = ?, results_published = 1 WHERE id = ?',
      ['published', electionId]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'RESULTS_PUBLISHED', `Results published for election ${election.room_number}`, req.ip]
    );

    // Notify connected voters via Socket.IO
    emitResultsPublished(election.room_number);

    res.json({ message: 'Results published successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getElectionStats = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  try {
    const isSuperAdmin = role === 'super_admin';
    const query = isSuperAdmin
      ? 'SELECT id FROM election_rooms WHERE id = ?'
      : 'SELECT id FROM election_rooms WHERE id = ? AND admin_id = ?';
    const params = isSuperAdmin ? [electionId] : [electionId, adminId];
    const [elections]: any = await pool.query(query, params);
    if (elections.length === 0) return res.status(404).json({ message: 'Election not found or access denied' });

    const [voterStats]: any = await pool.query(
      'SELECT COUNT(*) as total_voters, SUM(has_voted) as voted_count FROM room_voters WHERE election_id = ?',
      [electionId]
    );
    const [candidateStats]: any = await pool.query(
      'SELECT COUNT(*) as total_candidates FROM candidates WHERE election_id = ?',
      [electionId]
    );
    const [txStats]: any = await pool.query(
      'SELECT COUNT(*) as total_transactions FROM blockchain_transactions WHERE election_id = ?',
      [electionId]
    );

    const blockchainStatus = blockchainService.getStatus();

    res.json({
      totalVoters: voterStats[0].total_voters || 0,
      votedCount: voterStats[0].voted_count || 0,
      totalCandidates: candidateStats[0].total_candidates || 0,
      totalTransactions: txStats[0].total_transactions || 0,
      blockchainConnected: blockchainStatus.connected,
      contractAddress: blockchainStatus.contractAddress
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Public endpoint allowing voters to search & explore active elections
 */
export const listPublicElections = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT id, room_number, title, status, start_time, end_time FROM election_rooms WHERE status = "active"';
    const params: any[] = [];
    if (search) {
      sql += ' AND (title LIKE ? OR room_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY id ASC LIMIT 250';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Benchmark / Scale: Generates or scales the system up to 200+ simultaneous active elections
 */
export const seedScaleElections = async (req: Request, res: Response) => {
  try {
    const targetCount = Number(req.body.count) || 205;
    const [countRows]: any = await pool.query('SELECT COUNT(*) as total FROM election_rooms');
    const current = (countRows[0] && (countRows[0].total || countRows[0]['[total]'])) || 0;

    if (current >= targetCount) {
      return res.json({
        message: `System already has ${current} simultaneous elections running!`,
        count: current
      });
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000).toISOString();
    const endTime = new Date(now.getTime() + 7 * 86400000).toISOString();

    const categories = [
      'National Assembly District',
      'Metropolitan Council Ward',
      'State Senate District',
      'University Faculty Council',
      'Judicial Oversight District',
      'Cooperative Board of Directors',
      'Regional Health Board',
      'Civic Infrastructure Committee'
    ];

    const candidatePool = [
      { name: 'Dr. Elena Rostova', party: 'Open Governance Alliance', bio: 'Championing digital rights and civic accountability.' },
      { name: 'Marcus Vance Jr.', party: 'Civic Liberty Union', bio: 'Advancing sustainable municipal infrastructure and privacy.' },
      { name: 'Dr. Tariq Al-Mansoor', party: 'Progressive Tech Alliance', bio: 'Pioneering clean energy and decentralized voting.' },
      { name: 'Sophia Chen', party: 'Public Trust Coalition', bio: 'Focusing on transparent budget allocation and representation.' }
    ];

    for (let i = current + 1; i <= targetCount; i++) {
      const cat = categories[(i - 1) % categories.length];
      const roomCode = `VOTEX-E${String(i).padStart(3, '0')}`;
      const title = `${cat} #${String(i).padStart(3, '0')}`;

      const [roomRes]: any = await pool.query(
        'INSERT INTO election_rooms (room_number, admin_id, title, start_time, end_time, status) VALUES (?, 1, ?, ?, ?, "active")',
        [roomCode, title, startTime, endTime]
      );
      const electionId = roomRes.insertId || i;

      // Register 2 candidates
      const candA = candidatePool[(i * 2) % candidatePool.length];
      const candB = candidatePool[(i * 2 + 1) % candidatePool.length];
      await pool.query(
        'INSERT INTO candidates (election_id, candidate_code, name, party, bio) VALUES (?, "CAN-01", ?, ?, ?)',
        [electionId, candA.name, candA.party, candA.bio]
      );
      await pool.query(
        'INSERT INTO candidates (election_id, candidate_code, name, party, bio) VALUES (?, "CAN-02", ?, ?, ?)',
        [electionId, candB.name, candB.party, candB.bio]
      );

      // Pre-enroll voters 1, 2, 3
      await pool.query('INSERT INTO room_voters (election_id, voter_id, has_voted) VALUES (?, 1, 0)', [electionId]);
      await pool.query('INSERT INTO room_voters (election_id, voter_id, has_voted) VALUES (?, 2, 0)', [electionId]);
      await pool.query('INSERT INTO room_voters (election_id, voter_id, has_voted) VALUES (?, 3, 0)', [electionId]);
    }

    res.json({
      message: `Successfully scaled system to ${targetCount} simultaneous active elections!`,
      count: targetCount
    });
  } catch (error) {
    console.error('Scale seed error:', error);
    res.status(500).json({ message: 'Failed to seed elections for scaling' });
  }
};
