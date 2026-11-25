import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI?.trim() || '',
  jwtSecret: process.env.JWT_SECRET?.trim() || fallbackJwtSecret,
  jwtExpiresIn: '12h' as const,
};
