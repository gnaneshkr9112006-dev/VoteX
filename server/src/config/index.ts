import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (parent of server/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Also try loading from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try default
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'votex'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'votex_dev_secret_change_in_production_minimum_64_chars_long',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
    privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
    contractAddress: process.env.CONTRACT_ADDRESS || ''
  },
  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || 'VoteX',
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173'
  },
  demoMode: process.env.DEMO_MODE !== 'false', // Default to true for development
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@votex.local'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  voterCommitmentSalt: process.env.VOTER_COMMITMENT_SALT || 'votex_default_salt_change_in_production',
  admin: {
    loginId: process.env.ADMIN_LOGIN_ID || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    role: process.env.ADMIN_ROLE || 'super_admin'
  }
};
