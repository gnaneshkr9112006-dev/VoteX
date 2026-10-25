import { Request, Response } from 'express';
import { pool } from '../db/connection';
import { parse } from 'csv-parse/sync';

const verifyElectionAccess = async (electionId: string, adminId: number, role?: string): Promise<boolean> => {
  if (role === 'super_admin') {
    const [elections]: any = await pool.query('SELECT id FROM election_rooms WHERE id = ?', [electionId]);
    return elections.length > 0;
  }
  const [elections]: any = await pool.query(
    'SELECT id FROM election_rooms WHERE id = ? AND admin_id = ?',
    [electionId, adminId]
  );
  return elections.length > 0;
};

export const registerVoter = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  const { voterId, fullName, email } = req.body;

  if (!voterId || !fullName || !email) {
    return res.status(400).json({ message: 'voter_id, full_name, and email are required' });
  }

  try {
    const hasAccess = await verifyElectionAccess(electionId, adminId, role);
    if (!hasAccess) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    // Upsert voter into global voters table
    let voterDbId: number;
    const [existing]: any = await pool.query('SELECT id FROM voters WHERE voter_id = ?', [voterId]);
    if (existing.length > 0) {
      voterDbId = existing[0].id;
    } else {
      const [insertResult]: any = await pool.query(
        'INSERT INTO voters (voter_id, full_name, email) VALUES (?, ?, ?)',
        [voterId, fullName, email]
      );
      voterDbId = insertResult.insertId;
    }

    // Check if already registered in this room
    const [roomCheck]: any = await pool.query(
      'SELECT id FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [electionId, voterDbId]
    );
    if (roomCheck.length > 0) {
      return res.status(409).json({ message: `Voter ${voterId} is already registered in this election room` });
    }

    await pool.query(
      'INSERT INTO room_voters (election_id, voter_id) VALUES (?, ?)',
      [electionId, voterDbId]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'VOTER_REGISTERED', `Voter ${voterId} registered manually`, req.ip]
    );

    res.status(201).json({ message: 'Voter registered successfully' });
  } catch (error) {
    console.error('Register voter error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const importVoters = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  const csvData = req.file?.buffer.toString();

  if (!csvData) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const hasAccess = await verifyElectionAccess(electionId, adminId, role);
    if (!hasAccess) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    let imported = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const record of records) {
      // CSV columns: voter_id, full_name, email
      const voterId = record.voter_id?.trim();
      const fullName = record.full_name?.trim();
      const email = record.email?.trim();

      if (!voterId || !fullName || !email) {
        errors.push(`Invalid row: missing fields for voter_id=${voterId || 'N/A'}`);
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email for voter ${voterId}: ${email}`);
        continue;
      }

      try {
        // Upsert voter
        let voterDbId: number;
        const [existing]: any = await pool.query('SELECT id FROM voters WHERE voter_id = ?', [voterId]);
        if (existing.length > 0) {
          voterDbId = existing[0].id;
        } else {
          const [insertResult]: any = await pool.query(
            'INSERT INTO voters (voter_id, full_name, email) VALUES (?, ?, ?)',
            [voterId, fullName, email]
          );
          voterDbId = insertResult.insertId;
        }

        // Check duplicate in this room
        const [roomCheck]: any = await pool.query(
          'SELECT id FROM room_voters WHERE election_id = ? AND voter_id = ?',
          [electionId, voterDbId]
        );
        if (roomCheck.length > 0) {
          duplicates++;
          continue;
        }

        await pool.query(
          'INSERT INTO room_voters (election_id, voter_id) VALUES (?, ?)',
          [electionId, voterDbId]
        );
        imported++;
      } catch (err) {
        errors.push(`Failed to import voter ${voterId}: ${(err as Error).message}`);
      }
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'VOTERS_IMPORTED', `CSV import: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`, req.ip]
    );

    res.json({
      message: 'Import completed',
      imported,
      duplicates,
      errors,
      total: records.length
    });
  } catch (error) {
    console.error('Import voters error:', error);
    res.status(500).json({ message: 'Failed to parse CSV file' });
  }
};

export const listVoters = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const electionId = req.params.id;
  try {
    const hasAccess = await verifyElectionAccess(electionId, adminId, role);
    if (!hasAccess) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const [rows] = await pool.query(
      `SELECT v.id, v.voter_id, v.full_name, v.email, v.face_descriptor, v.face_photo, rv.has_voted, rv.voted_at, rv.verification_proof_hash
       FROM voters v
       JOIN room_voters rv ON v.id = rv.voter_id
       WHERE rv.election_id = ?
       ORDER BY v.full_name ASC`,
      [electionId]
    );
    // Add computed flag for clean client consumption
    const enriched = (rows as any[]).map(r => ({
      ...r,
      has_face_enrolled: Boolean(r.face_descriptor && r.face_descriptor !== 'null' && r.face_descriptor !== '')
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const enrollVoterFaceAdmin = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const { id: electionId, voterId } = req.params;
  const { faceDescriptor, facePhoto, photoBase64 } = req.body;

  if (!faceDescriptor) {
    return res.status(400).json({ message: 'Face descriptor is required' });
  }

  try {
    const hasAccess = await verifyElectionAccess(electionId, adminId, role);
    if (!hasAccess) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const [voterRows]: any = await pool.query('SELECT id, full_name, face_photo FROM voters WHERE voter_id = ?', [voterId]);
    if (voterRows.length === 0) {
      return res.status(404).json({ message: `Voter ${voterId} not found` });
    }
    const voter = voterRows[0];
    const isUpdate = Boolean(voter.face_photo);

    const descriptorStr = typeof faceDescriptor === 'string' ? faceDescriptor : JSON.stringify(faceDescriptor);
    const photoToSave = facePhoto || photoBase64 || null;

    await pool.query(
      'UPDATE voters SET face_descriptor = ?, face_photo = ? WHERE voter_id = ?',
      [descriptorStr, photoToSave, voterId]
    );

    // If voter's photo was updated and they haven't voted yet, reset proof hash so they re-verify with new face
    await pool.query(
      'UPDATE room_voters SET verification_proof_hash = NULL WHERE election_id = ? AND voter_id = ? AND has_voted = 0',
      [electionId, voter.id]
    );

    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, isUpdate ? 'BIOMETRIC_UPDATED' : 'BIOMETRIC_ENROLLED', `Biometric face profile ${isUpdate ? 'updated' : 'enrolled'} for voter ${voterId}`, req.ip]
    );

    res.json({
      message: isUpdate ? 'Face biometrics updated successfully' : 'Face enrolled successfully',
      voterId,
      isUpdate
    });
  } catch (error) {
    console.error('Enroll voter face error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const removeVoter = async (req: Request, res: Response) => {
  const adminId = (req as any).user.id;
  const role = (req as any).user.role;
  const { id: electionId, voterId } = req.params;

  try {
    const hasAccess = await verifyElectionAccess(electionId, adminId, role);
    if (!hasAccess) {
      return res.status(404).json({ message: 'Election not found or access denied' });
    }

    const [voter]: any = await pool.query('SELECT id, voter_id FROM voters WHERE voter_id = ?', [voterId]);
    if (voter.length === 0) return res.status(404).json({ message: 'Voter not found' });

    // Check if voter has already voted
    const [roomVoter]: any = await pool.query(
      'SELECT has_voted FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [electionId, voter[0].id]
    );
    if (roomVoter.length > 0 && roomVoter[0].has_voted) {
      return res.status(400).json({ message: 'Cannot remove a voter who has already voted' });
    }

    await pool.query(
      'DELETE FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [electionId, voter[0].id]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (admin_id, election_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [adminId, electionId, 'VOTER_REMOVED', `Voter ${voterId} removed from room`, req.ip]
    );

    res.json({ message: 'Voter removed from room' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
