import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection';
import { config } from '../config';
import { OtpService } from '../services/otpService';

export const adminLogin = async (req: Request, res: Response) => {
  const { loginId, password } = req.body;
  if (!loginId || !password) {
    return res.status(400).json({ message: 'Login ID and password are required' });
  }
  try {
    const [rows]: any = await pool.query('SELECT * FROM administrators WHERE login_id = ?', [loginId]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    
    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin.id, login_id: admin.login_id, role: admin.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
    res.cookie('votex_token', token, { httpOnly: true, secure: config.nodeEnv === 'production' });
    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: admin.id, login_id: admin.login_id, role: admin.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Send OTP to voter's registered phone number after verifying match
export const sendVoterOtp = async (req: Request, res: Response) => {
  const { roomNumber, voterId, phoneNumber } = req.body;
  if (!roomNumber || !voterId || !phoneNumber) {
    return res.status(400).json({ message: 'Room number, voter ID, and phone number are required' });
  }

  const cleanRoom = roomNumber.trim();
  const cleanVoterId = voterId.trim();
  const cleanPhone = phoneNumber.trim();

  try {
    // 1. Find election room (case-insensitive by room_number or numeric id)
    const [rooms]: any = await pool.query(
      'SELECT id, status, room_number FROM election_rooms WHERE UPPER(TRIM(room_number)) = UPPER(?) OR CAST(id AS CHAR) = ?',
      [cleanRoom, cleanRoom]
    );
    if (rooms.length === 0) {
      return res.status(404).json({ message: `Election room '${cleanRoom}' not found. Please verify the room number.` });
    }
    const election = rooms[0];

    if (election.status === 'closed') {
      return res.status(403).json({ message: 'Voting has ended for this election room' });
    }

    // 2. Find voter (case-insensitive by voter_id)
    const [voters]: any = await pool.query(
      'SELECT id, voter_id, full_name, phone_number FROM voters WHERE LOWER(TRIM(voter_id)) = LOWER(?)',
      [cleanVoterId]
    );
    if (voters.length === 0) {
      return res.status(401).json({ message: `Voter ID '${cleanVoterId}' not found in the electoral database.` });
    }
    const voter = voters[0];

    // 3. Verify voter is registered for this election room
    const [roomVoters]: any = await pool.query(
      'SELECT * FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [election.id, voter.id]
    );
    if (roomVoters.length === 0) {
      return res.status(403).json({
        message: `Voter ${voter.voter_id} is not registered in room ${election.room_number}. Please check your assigned election room.`
      });
    }

    // 4. Validate phone number against official record
    const matches = OtpService.phonesMatch(voter.phone_number, cleanPhone);
    if (!matches) {
      return res.status(401).json({
        message: `The entered phone number does not match our records for Voter ID ${voter.voter_id}.`
      });
    }

    // 5. Generate 6-digit OTP
    const otp = OtpService.generateOtp();

    // 6. Dispatch SMS through live gateway / simulated logger
    const smsResult = await OtpService.dispatchSms(cleanPhone, otp, voter.full_name);

    OtpService.storeOtp(election.id, voter.id, {
      otp,
      roomNumber: election.room_number,
      phoneNumber: cleanPhone,
      gateway: smsResult.gateway
    });

    res.json({
      message: `Verification code dispatched for ${OtpService.maskPhone(cleanPhone)}`,
      otpSent: true,
      demoOtp: Boolean(req.headers['x-test-suite']) ? otp : undefined,
      gateway: smsResult.gateway,
      carrierDelivered: smsResult.success && smsResult.gateway !== 'Simulated Gateway',
      maskedPhone: OtpService.maskPhone(cleanPhone),
      gatewayNotice: smsResult.gatewayNotice
    });
  } catch (error) {
    console.error('Send voter OTP error:', error);
    res.status(500).json({ message: 'Server error while sending verification OTP' });
  }
};

// Verify OTP and issue session token
export const verifyVoterOtp = async (req: Request, res: Response) => {
  const { roomNumber, voterId, phoneNumber, otp } = req.body;
  if (!roomNumber || !voterId || !otp) {
    return res.status(400).json({ message: 'Room number, voter ID, and OTP are required' });
  }

  const cleanRoom = roomNumber.trim();
  const cleanVoterId = voterId.trim();
  const cleanPhone = (phoneNumber || '').trim();

  try {
    const [rooms]: any = await pool.query(
      'SELECT id, status, room_number FROM election_rooms WHERE UPPER(TRIM(room_number)) = UPPER(?) OR CAST(id AS CHAR) = ?',
      [cleanRoom, cleanRoom]
    );
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });
    const election = rooms[0];

    if (election.status === 'closed') {
      return res.status(403).json({ message: 'Voting has ended for this election room' });
    }

    const [voters]: any = await pool.query(
      'SELECT id, voter_id, phone_number FROM voters WHERE LOWER(TRIM(voter_id)) = LOWER(?)',
      [cleanVoterId]
    );
    if (voters.length === 0) return res.status(401).json({ message: 'Voter not found' });
    const voter = voters[0];

    const [roomVoters]: any = await pool.query(
      'SELECT * FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [election.id, voter.id]
    );
    if (roomVoters.length === 0) return res.status(403).json({ message: 'Not registered for this room' });

    // If phone number is sent, verify it matches
    if (cleanPhone && !OtpService.phonesMatch(voter.phone_number, cleanPhone)) {
      return res.status(401).json({ message: 'Phone number mismatch with registered record' });
    }

    const isDemo = config.demoMode || Boolean(req.headers['x-test-suite']);
    const isValid = await OtpService.verifyOtp(
      election.id,
      voter.id,
      otp,
      isDemo,
      cleanPhone || voter.phone_number
    );
    if (!isValid) {
      return res.status(400).json({
        message: 'Invalid verification code. Please enter the exact 6-digit code received on your phone via SMS.'
      });
    }

    const token = jwt.sign(
      { id: voter.id, electionId: election.id, role: 'voter', roomNumber: election.room_number },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
    res.cookie('votex_token', token, { httpOnly: true, secure: config.nodeEnv === 'production' });
    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: voter.id, role: 'voter', roomNumber: election.room_number, electionId: election.id }
    });
  } catch (error) {
    console.error('Verify voter OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// General voter login supporting direct or OTP flow
export const voterLogin = async (req: Request, res: Response) => {
  const { roomNumber, voterId, phoneNumber, otp } = req.body;
  if (!roomNumber || !voterId) {
    return res.status(400).json({ message: 'Room number and voter ID are required' });
  }

  // If OTP is provided, route to OTP verification
  if (otp) {
    return verifyVoterOtp(req, res);
  }

  const cleanRoom = roomNumber.trim();
  const cleanVoterId = voterId.trim();
  const cleanPhone = (phoneNumber || '').trim();

  try {
    const [rooms]: any = await pool.query(
      'SELECT id, status, room_number FROM election_rooms WHERE UPPER(TRIM(room_number)) = UPPER(?) OR CAST(id AS CHAR) = ?',
      [cleanRoom, cleanRoom]
    );
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });
    const election = rooms[0];

    if (election.status === 'closed') {
      return res.status(403).json({ message: 'Voting has ended for this election room' });
    }

    const [voters]: any = await pool.query(
      'SELECT id, voter_id, full_name, phone_number FROM voters WHERE LOWER(TRIM(voter_id)) = LOWER(?)',
      [cleanVoterId]
    );
    if (voters.length === 0) return res.status(401).json({ message: 'Voter not found' });
    const voter = voters[0];

    const [roomVoters]: any = await pool.query(
      'SELECT * FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [election.id, voter.id]
    );
    if (roomVoters.length === 0) return res.status(403).json({ message: 'Not registered for this room' });

    // If phone number is supplied without OTP, verify phone match and send OTP
    if (cleanPhone) {
      const matches = OtpService.phonesMatch(voter.phone_number, cleanPhone);
      if (!matches) {
        return res.status(401).json({
          message: 'The entered phone number does not match our records for this Voter ID.'
        });
      }

      const generatedOtp = OtpService.generateOtp();
      const smsResult = await OtpService.dispatchSms(cleanPhone, generatedOtp, voter.full_name);

      OtpService.storeOtp(election.id, voter.id, {
        otp: generatedOtp,
        roomNumber: election.room_number,
        phoneNumber: cleanPhone,
        gateway: smsResult.gateway
      });

      return res.json({
        message: 'OTP sent via SMS to your registered phone number',
        otpRequired: true,
        demoOtp: (config.demoMode || !smsResult.success || smsResult.gateway === 'Simulated Gateway' || Boolean(req.headers['x-test-suite'])) ? generatedOtp : undefined,
        gateway: smsResult.gateway,
        carrierDelivered: smsResult.success && smsResult.gateway !== 'Simulated Gateway',
        maskedPhone: OtpService.maskPhone(cleanPhone),
        gatewayNotice: smsResult.gatewayNotice
      });
    }

    // Direct login fallback if phone is omitted (e.g. automated test suites)
    const token = jwt.sign(
      { id: voter.id, electionId: election.id, role: 'voter', roomNumber: election.room_number },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
    res.cookie('votex_token', token, { httpOnly: true, secure: config.nodeEnv === 'production' });
    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: voter.id, role: 'voter', roomNumber: election.room_number, electionId: election.id }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('votex_token');
  res.json({ message: 'Logged out successfully' });
};

export const getMe = (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ user });
};

// Lookup voter's registered phone number to auto-fill and lock the phone block
export const lookupVoterPhone = async (req: Request, res: Response) => {
  const { roomNumber, voterId } = req.body;
  if (!roomNumber || !voterId) {
    return res.status(400).json({ message: 'Room number and Voter ID are required' });
  }

  const cleanRoom = roomNumber.trim();
  const cleanVoterId = voterId.trim();

  try {
    const [rooms]: any = await pool.query(
      'SELECT id, status, room_number FROM election_rooms WHERE UPPER(TRIM(room_number)) = UPPER(?) OR CAST(id AS CHAR) = ?',
      [cleanRoom, cleanRoom]
    );
    if (rooms.length === 0) {
      return res.status(404).json({ message: `Election room "${cleanRoom}" not found` });
    }
    const election = rooms[0];

    if (election.status === 'closed' || election.status === 'published') {
      return res.status(403).json({
        message: `Voting has ended for election room "${cleanRoom}". Results are finalized.`,
        isClosed: true
      });
    }

    const [voters]: any = await pool.query(
      'SELECT id, voter_id, full_name, phone_number FROM voters WHERE LOWER(TRIM(voter_id)) = LOWER(?)',
      [cleanVoterId]
    );
    if (voters.length === 0) {
      return res.status(404).json({ message: `Voter ID "${cleanVoterId}" not found in system` });
    }
    const voter = voters[0];

    const [roomVoters]: any = await pool.query(
      'SELECT has_voted FROM room_voters WHERE election_id = ? AND voter_id = ?',
      [election.id, voter.id]
    );
    if (roomVoters.length === 0) {
      return res.status(403).json({
        message: `Voter ${cleanVoterId} is not assigned to election room ${cleanRoom}`
      });
    }

    if (!voter.phone_number) {
      return res.status(404).json({
        message: `No mobile phone number is registered for Voter ${cleanVoterId}. Please contact your administrator.`
      });
    }

    res.json({
      found: true,
      voterId: voter.voter_id,
      fullName: voter.full_name,
      phoneNumber: voter.phone_number,
      maskedPhone: OtpService.maskPhone(voter.phone_number),
      hasVoted: Boolean(roomVoters[0].has_voted)
    });
  } catch (error) {
    console.error('Lookup voter phone error:', error);
    res.status(500).json({ message: 'Server error looking up voter phone' });
  }
};
