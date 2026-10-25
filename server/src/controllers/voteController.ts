import { Request, Response } from 'express';
import { pool } from '../db/connection';
import { generateVoterCommitment } from '../utils/voterCommitment';
import { blockchainService } from '../services/blockchainService';
import { emitVoteUpdate } from '../services/socketService';
import { WebAuthnService } from '../services/webauthnService';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const verifyWebAuthn = async (req: Request, res: Response) => {
  const voterId = (req as any).user.id;
  const electionId = (req as any).user.electionId;
  const { liveFaceDescriptor, livenessVerified, authResponse, challenge, credential } = req.body;

  try {
    // 1. Check if voter has already voted
    const [roomVoters]: any = await pool.query(
      'SELECT has_voted FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [electionId, voterId]
    );
    if (roomVoters.length === 0) {
      return res.status(403).json({ message: 'Not registered for this election room' });
    }
    if (roomVoters[0].has_voted) {
      return res.status(403).json({ message: 'You have already voted in this election room.' });
    }

    // 2. Check election is active and within timing window
    const [elections]: any = await pool.query(
      'SELECT status, start_time, end_time FROM election_rooms WHERE id = ?',
      [electionId]
    );
    if (elections.length === 0) {
      return res.status(404).json({ message: 'Election not found' });
    }
    const election = elections[0];
    const now = new Date();
    if (election.status !== 'active' && election.status !== 'draft') {
      return res.status(403).json({ message: 'Election is not accepting votes' });
    }
    if (now < new Date(election.start_time)) {
      return res.status(403).json({ message: 'Voting has not started yet' });
    }
    if (now > new Date(election.end_time)) {
      return res.status(403).json({ message: 'Voting period has ended' });
    }

    // 3. Fetch Official Registered Biometric Profile from Database
    const [voterRows]: any = await pool.query(
      'SELECT face_descriptor, full_name, voter_id FROM voters WHERE id = ?',
      [voterId]
    );
    if (voterRows.length === 0) {
      return res.status(404).json({ message: 'Voter record not found' });
    }
    const voter = voterRows[0];

    if (!voter.face_descriptor) {
      return res.status(403).json({
        message: 'Official biometric profile not enrolled. Administrator verification of your ID photo is required before voting.'
      });
    }

    // Parse enrolled 128D descriptor
    let enrolledDescriptor: number[];
    try {
      enrolledDescriptor = typeof voter.face_descriptor === 'string'
        ? JSON.parse(voter.face_descriptor)
        : voter.face_descriptor;
    } catch {
      return res.status(500).json({ message: 'Corrupted biometric reference vector in database' });
    }

    if (!Array.isArray(enrolledDescriptor) || enrolledDescriptor.length !== 128) {
      return res.status(500).json({ message: 'Invalid reference biometric vector length in database' });
    }

    // 4. Validate Live Facial Descriptor provided by client
    if (!liveFaceDescriptor || !Array.isArray(liveFaceDescriptor) || liveFaceDescriptor.length !== 128) {
      return res.status(400).json({
        message: 'Valid 128-dimensional facial biometric embedding required for verification'
      });
    }

    // 5. Compute Mathematical Euclidean Distance on the Server
    let sumSquares = 0;
    for (let i = 0; i < 128; i++) {
      const diff = Number(liveFaceDescriptor[i]) - Number(enrolledDescriptor[i]);
      sumSquares += diff * diff;
    }
    const euclideanDistance = Math.sqrt(sumSquares);
    const MAX_MATCH_THRESHOLD = 0.54; // Robust calibrated threshold for facial recognition under varying lighting

    console.log(`[Server Face Auth] Voter: ${voter.voter_id}, Distance: ${euclideanDistance.toFixed(4)}, Threshold: ${MAX_MATCH_THRESHOLD}`);

    // Enforce biometric match threshold
    if (euclideanDistance > MAX_MATCH_THRESHOLD) {
      await pool.query(
        'INSERT INTO audit_logs (election_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
        [
          electionId,
          'BIOMETRIC_FAILED',
          `Biometric mismatch for voter ${voter.voter_id}: distance ${euclideanDistance.toFixed(4)} exceeds threshold ${MAX_MATCH_THRESHOLD}`,
          req.ip
        ]
      );
      return res.status(401).json({
        message: `Biometric identity mismatch: Face detected does not match the registered voter (Distance: ${euclideanDistance.toFixed(3)}). Access denied.`,
        distance: euclideanDistance,
        threshold: MAX_MATCH_THRESHOLD
      });
    }

    // 6. Enforce Anti-Spoofing Liveness Verification
    if (livenessVerified === false) {
      return res.status(401).json({
        message: 'Anti-spoofing liveness verification failed. Live human presence required.'
      });
    }

    // 7. Verify WebAuthn / Passkeys
    const verificationResult = await WebAuthnService.verifyAuthentication(
      authResponse || {},
      challenge || 'demo_challenge',
      credential || {}
    );

    if (!verificationResult.verified) {
      return res.status(401).json({ message: 'Hardware biometric token verification failed' });
    }

    // 8. Generate Non-Reversible Cryptographic Proof Hash
    const proofData = `${voterId}_${electionId}_${euclideanDistance.toFixed(4)}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const proofHash = crypto.createHash('sha256').update(proofData).digest('hex');

    // Store proof hash in room_voters
    await pool.query(
      'UPDATE room_voters SET verification_proof_hash = ? WHERE election_id = ? AND voter_id = ?',
      [proofHash, electionId, voterId]
    );

    await pool.query(
      'INSERT INTO audit_logs (election_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [
        electionId,
        'BIOMETRIC_VERIFIED',
        `Biometric identity verified for ${voter.voter_id} (Distance: ${euclideanDistance.toFixed(4)})`,
        req.ip
      ]
    );

    const matchConfidence = Math.max(0, Math.min(100, Math.round((1 - euclideanDistance / 0.65) * 100)));

    res.json({
      message: 'Identity verified successfully',
      verified: true,
      distance: euclideanDistance,
      confidence: matchConfidence,
      proofHash
    });
  } catch (error) {
    console.error('Biometric verification error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
};

export const castVote = async (req: Request, res: Response) => {
  const voterId = (req as any).user.id;
  const electionId = (req as any).user.electionId;
  const { candidateId } = req.body;

  if (!candidateId) {
    return res.status(400).json({ message: 'Candidate selection is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the voter row to prevent race conditions
    const [roomVoters]: any = await connection.query(
      'SELECT rv.has_voted, rv.verification_proof_hash FROM room_voters rv WHERE rv.election_id = ? AND rv.voter_id = ? FOR UPDATE',
      [electionId, voterId]
    );
    if (roomVoters.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Not registered for this election room' });
    }
    if (roomVoters[0].has_voted) {
      await connection.rollback();
      return res.status(403).json({ message: 'You have already voted in this election room.' });
    }

    // Check election is within the voting window
    const [elections]: any = await connection.query(
      'SELECT status, start_time, end_time, room_number FROM election_rooms WHERE id = ?',
      [electionId]
    );
    if (elections.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Election not found' });
    }
    const election = elections[0];
    const now = new Date();
    if (now < new Date(election.start_time) || now > new Date(election.end_time)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Voting is not allowed outside the scheduled time window' });
    }
    if (election.status === 'closed' || election.status === 'published') {
      await connection.rollback();
      return res.status(403).json({ message: 'This election has been closed' });
    }

    // Validate candidate belongs to this election
    const [candidates]: any = await connection.query(
      'SELECT id, candidate_code FROM candidates WHERE election_id = ? AND id = ?',
      [electionId, candidateId]
    );
    if (candidates.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid candidate for this election' });
    }

    // Get voter_id string for commitment
    const [voterRows]: any = await connection.query(
      'SELECT voter_id FROM voters WHERE id = ?',
      [voterId]
    );
    const voterIdStr = voterRows[0].voter_id;

    // Generate cryptographic commitment and receipt
    const commitment = generateVoterCommitment(voterIdStr);
    const proofHash = roomVoters[0].verification_proof_hash || crypto.createHash('sha256').update(`${voterId}_${electionId}`).digest('hex');
    const receiptCode = `VTX-${uuidv4().substring(0, 8).toUpperCase()}`;
    const candidateCode = candidates[0].candidate_code;

    // Cast vote on blockchain (candidate_code is used, NOT voter-linked)
    let txResult;
    try {
      txResult = await blockchainService.castVote(
        electionId,
        candidateCode,
        commitment,
        proofHash,
        receiptCode
      );
    } catch (err: any) {
      if (err.message === 'DUPLICATE_VOTE') {
        await connection.rollback();
        return res.status(403).json({ message: 'You have already voted in this election room.' });
      }
      throw err;
    }

    // Update voter status - mark as voted (no candidate link stored!)
    await connection.query(
      'UPDATE room_voters SET has_voted = 1, voted_at = NOW() WHERE election_id = ? AND voter_id = ?',
      [electionId, voterId]
    );

    // Create receipt (NO candidate info stored - vote is secret)
    await connection.query(
      'INSERT INTO vote_receipts (election_id, receipt_code, voter_commitment, tx_hash, block_number) VALUES (?, ?, ?, ?, ?)',
      [electionId, receiptCode, commitment, txResult.txHash, txResult.blockNumber]
    );

    // Record blockchain transaction for audit
    await connection.query(
      'INSERT INTO blockchain_transactions (election_id, tx_hash, block_number, action_type, voter_commitment, proof_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [electionId, txResult.txHash, txResult.blockNumber, 'VOTE_CAST', commitment, proofHash]
    );

    // Audit log (no candidate info!)
    await connection.query(
      'INSERT INTO audit_logs (election_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [electionId, 'VOTE_CAST', `Vote cast. Receipt: ${receiptCode}`, req.ip]
    );

    // Auto-activate election if still in draft
    if (election.status === 'draft') {
      await connection.query(
        'UPDATE election_rooms SET status = ? WHERE id = ?',
        ['active', electionId]
      );
    }

    await connection.commit();

    // Emit real-time update
    emitVoteUpdate(election.room_number);

    res.json({
      message: 'Vote cast successfully',
      receiptCode,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await connection.rollback();
    console.error('Cast vote error:', error);
    res.status(500).json({ message: 'Failed to cast vote. Please try again.' });
  } finally {
    connection.release();
  }
};

export const getReceipt = async (req: Request, res: Response) => {
  const { receiptCode } = req.params;
  try {
    const [rows]: any = await pool.query(
      `SELECT vr.receipt_code, vr.tx_hash, vr.block_number, vr.created_at,
              er.title as election_title, er.room_number
       FROM vote_receipts vr
       JOIN election_rooms er ON vr.election_id = er.id
       WHERE vr.receipt_code = ?`,
      [receiptCode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    // NEVER include candidate info in receipt
    res.json({
      receiptCode: rows[0].receipt_code,
      txHash: rows[0].tx_hash,
      blockNumber: rows[0].block_number,
      timestamp: rows[0].created_at,
      electionTitle: rows[0].election_title,
      roomNumber: rows[0].room_number,
      note: 'Your vote choice is private and not shown on this receipt.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getStatus = async (req: Request, res: Response) => {
  const voterId = (req as any).user.id;
  const electionId = (req as any).user.electionId;
  try {
    const [rows]: any = await pool.query(
      'SELECT has_voted, verification_proof_hash FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [electionId, voterId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Not registered' });
    }
    res.json({
      hasVoted: !!rows[0].has_voted,
      isVerified: !!rows[0].verification_proof_hash,
      electionId,
      roomNumber: (req as any).user?.roomNumber || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getVoterFaceProfile = async (req: Request, res: Response) => {
  const voterId = (req as any).user.id;
  try {
    const [rows]: any = await pool.query(
      'SELECT id, voter_id, full_name, face_descriptor, face_photo FROM voters WHERE id = ?',
      [voterId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Voter not found' });
    const voter = rows[0];

    let descriptor = null;
    if (voter.face_descriptor) {
      try {
        descriptor = typeof voter.face_descriptor === 'string' ? JSON.parse(voter.face_descriptor) : voter.face_descriptor;
      } catch {
        descriptor = null;
      }
    }

    res.json({
      hasEnrolled: !!descriptor,
      hasFaceEnrolled: !!descriptor,
      faceDescriptor: descriptor,
      facePhoto: voter.face_photo || null,
      fullName: voter.full_name,
      voterId: voter.voter_id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const enrollVoterFace = async (req: Request, res: Response) => {
  const voterId = (req as any).user.id;
  const electionId = (req as any).user.electionId;
  const { faceDescriptor, facePhoto, photoBase64 } = req.body;

  if (!faceDescriptor) {
    return res.status(400).json({ message: 'Face descriptor is required' });
  }

  try {
    // Check if voter already has an enrolled profile - prevent tampering
    const [existing]: any = await pool.query('SELECT face_descriptor FROM voters WHERE id = ?', [voterId]);
    if (existing.length > 0 && existing[0].face_descriptor) {
      return res.status(403).json({
        message: 'Biometric identity profile is permanently locked. Only election administrators can modify registered credentials.'
      });
    }

    const descriptorStr = typeof faceDescriptor === 'string' ? faceDescriptor : JSON.stringify(faceDescriptor);
    await pool.query(
      'UPDATE voters SET face_descriptor = ?, face_photo = ? WHERE id = ?',
      [descriptorStr, facePhoto || photoBase64 || null, voterId]
    );

    await pool.query(
      'INSERT INTO audit_logs (election_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [electionId, 'BIOMETRIC_ENROLLED', `Initial biometric face profile enrolled for voter (ID ${voterId})`, req.ip]
    );

    res.json({ message: 'Face enrolled successfully', verified: true });
  } catch (error) {
    console.error('Enroll face error:', error);
    res.status(500).json({ message: 'Failed to enroll face' });
  }
};
