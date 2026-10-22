import crypto from 'crypto';
import { config } from '../config';

export const generateVoterCommitment = (voterId: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(voterId + config.voterCommitmentSalt);
  return '0x' + hash.digest('hex');
};
