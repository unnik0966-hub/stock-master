import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const deploymentScope =
  process.env.VERCEL_PROJECT_ID ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_BRANCH_URL ||
  process.env.VERCEL_URL ||
  process.env.K_SERVICE ||
  process.cwd();

const fallbackJwtSecret = crypto
  .createHmac('sha256', deploymentScope)
  .update('stockmaster-fallback-jwt-signing-key')
  .digest('hex');

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
