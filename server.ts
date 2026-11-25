import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { env } from './server/config/env.ts';
import { repository } from './server/db/repository.ts';
import { rejectNoSqlOperators } from './server/middleware/validate.ts';
import apiRouter from './server/routes/api.ts';

async function startServer(): Promise<void> {
  await repository.init();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Invalid JSON request payload.' });
        return;
      }
      next(err);
    }
  );
  app.use(rejectNoSqlOperators);

  app.use('/api', apiRouter);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`StockMaster server running at http://localhost:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StockMaster server:', err);
  process.exit(1);
});
