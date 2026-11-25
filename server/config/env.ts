import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

function resolveMongoUri(raw?: string): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed || trimmed === 'MY_MONGODB_URI' || trimmed === 'dummy') {
    return '';
  }
  if (!/^mongodb(\+srv)?:\/\//i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

function resolveJwtSecret(raw?: string): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed || trimmed === 'MY_JWT_SECRET' || trimmed === 'dummy') {
    return fallbackJwtSecret;
  }
  return trimmed;
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: resolveMongoUri(process.env.MONGODB_URI),
  jwtSecret: resolveJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: '12h' as const,
};
