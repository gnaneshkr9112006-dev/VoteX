import rateLimit from 'express-rate-limit';
import { config } from '../config';

const isDev = config.demoMode || config.nodeEnv === 'development';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: isDev ? 100000 : config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down and try again later.' }
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sensitive requests, please try again later.' }
});
