import express from 'express';
import { repository } from './db/repository.ts';
import { rejectNoSqlOperators } from './middleware/validate.ts';
import apiRouter from './routes/api.ts';

let initPromise: Promise<void> | null = null;

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = repository.init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, _res, next) => {
    if (req.body !== undefined && typeof req.body === 'object') {
      (req as unknown as { _body?: boolean })._body = true;
    }
    next();
  });
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

  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureDbInitialized();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', apiRouter);

  return app;
}
