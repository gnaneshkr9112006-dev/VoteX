import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { initDb } from './db/connection';
import { seedAdmin } from './db/seedAdmin';
import { rateLimiter } from './middleware/rateLimiter';
import { initSocket } from './services/socketService';
import { blockchainService } from './services/blockchainService';

import authRoutes from './routes/auth.routes';
import electionRoutes from './routes/election.routes';
import candidateRoutes from './routes/candidate.routes';
import voterRoutes from './routes/voter.routes';
import voteRoutes from './routes/vote.routes';
import resultsRoutes from './routes/results.routes';
import auditRoutes from './routes/audit.routes';

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// Socket.IO
initSocket(server);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/elections', resultsRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/elections', candidateRoutes);
app.use('/api/elections', voterRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api', auditRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  const bcStatus = blockchainService.getStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    blockchain: bcStatus,
    demoMode: config.demoMode
  });
});

// PDF Report Downloads
app.get('/api/reports/download/project-report', (_req, res) => {
  const candidates = [
    path.resolve(__dirname, '../../VoteX_Project_Report.pdf'),
    path.resolve(process.cwd(), 'VoteX_Project_Report.pdf'),
    path.resolve(process.cwd(), 'client/public/VoteX_Project_Report.pdf')
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) {
    return res.download(found, 'VoteX_Project_Report.pdf');
  }
  res.status(404).json({ message: 'Project report PDF not found' });
});

app.get('/api/reports/download/blockchain-architecture', (_req, res) => {
  const candidates = [
    path.resolve(__dirname, '../../VoteX_Blockchain_Architecture.pdf'),
    path.resolve(process.cwd(), 'VoteX_Blockchain_Architecture.pdf'),
    path.resolve(process.cwd(), 'client/public/VoteX_Blockchain_Architecture.pdf')
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) {
    return res.download(found, 'VoteX_Blockchain_Architecture.pdf');
  }
  res.status(404).json({ message: 'Blockchain architecture PDF not found' });
});

const startServer = async () => {
  try {
    console.log('🗳️  VoteX Server Starting...');
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Demo Mode: ${config.demoMode}`);

    // Initialize database
    try {
      await initDb();
      console.log('✅ Database initialized');
      await seedAdmin();
      console.log('✅ Admin seeded');
    } catch (dbErr: any) {
      console.warn('⚠️  Database connection could not be established:', dbErr.message);
      console.warn(`   Database queries will require MySQL running on port ${config.db.port}.`);
    }

    // Initialize blockchain connection
    try {
      await blockchainService.initialize();
      console.log('✅ Blockchain service initialized');
    } catch (bcErr: any) {
      console.warn('⚠️  Blockchain service warning:', bcErr.message);
    }

    // Start server
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`\n🚀 VoteX server running on http://localhost:${config.port}`);
      console.log(`   Client URL: ${config.clientUrl}`);
      console.log(`   API: http://localhost:${config.port}/api\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
