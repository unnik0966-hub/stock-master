import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApp, ensureDbInitialized } from './server/app.ts';
import { env } from './server/config/env.ts';

function readCliFlag(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function startServer(): Promise<void> {
  void ensureDbInitialized().catch((err) => {
    console.error('Initial database warm-up error:', err);
  });

  const app = createApp();
  const httpServer = http.createServer(app);

  const port = Number(readCliFlag('--port') || env.port || 3000);
  const host = readCliFlag('--host') || '0.0.0.0';

  const isProduction =
    env.nodeEnv === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (process.env.NODE_ENV !== 'development' &&
      process.env.npm_lifecycle_event !== 'dev' &&
      Boolean(process.env.K_SERVICE));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
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

  httpServer.listen(port, host, () => {
    console.log(`StockMaster server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StockMaster server:', err);
  process.exit(1);
});
