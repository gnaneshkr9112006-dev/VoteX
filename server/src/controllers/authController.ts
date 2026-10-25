import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/connection';
import { config } from '../config';

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

    const token = jwt.sign({ id: admin.id, role: admin.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
    res.cookie('votex_token', token, { httpOnly: true, secure: config.nodeEnv === 'production' });
    res.json({ message: 'Logged in successfully', user: { id: admin.id, role: admin.role } });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const voterLogin = async (req: Request, res: Response) => {
  const { roomNumber, voterId } = req.body;
  if (!roomNumber || !voterId) {
    return res.status(400).json({ message: 'Room number and voter ID are required' });
  }
  try {
    const [rooms]: any = await pool.query('SELECT id, status FROM election_rooms WHERE room_number = ?', [roomNumber]);
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });
    const election = rooms[0];

    if (election.status === 'closed') {
      return res.status(403).json({ message: 'Voting has ended for this election room' });
    }

    const [voters]: any = await pool.query('SELECT id FROM voters WHERE voter_id = ?', [voterId]);
    if (voters.length === 0) return res.status(401).json({ message: 'Voter not found' });
    const voter = voters[0];

    const [roomVoters]: any = await pool.query('SELECT * FROM room_voters WHERE election_id = ? AND voter_id = ?', [election.id, voter.id]);
    if (roomVoters.length === 0) return res.status(403).json({ message: 'Not registered for this room' });

    const token = jwt.sign({ id: voter.id, electionId: election.id, role: 'voter', roomNumber }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
    res.cookie('votex_token', token, { httpOnly: true, secure: config.nodeEnv === 'production' });
    res.json({ message: 'Logged in successfully', user: { id: voter.id, role: 'voter', roomNumber, electionId: election.id } });
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
