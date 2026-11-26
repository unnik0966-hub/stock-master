import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp, ensureDbInitialized } from './server/app.ts';
import { env } from './server/config/env.ts';

async function startServer(): Promise<void> {
  void ensureDbInitialized().catch((err) => {
    console.error('Initial database warm-up error:', err);
  });

  const app = createApp();

  const isProduction =
    env.nodeEnv === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (process.env.NODE_ENV !== 'development' &&
      process.env.npm_lifecycle_event !== 'dev' &&
      Boolean(process.env.K_SERVICE));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.warn('Production dist directory missing; run npm run build first.');
      app.get('*', (_req, res) => {
        res.status(503).send('Application build assets missing. Run npm run build.');
      });
    }
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`StockMaster server running at http://localhost:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StockMaster server:', err);
  process.exit(1);
});
