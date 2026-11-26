import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/app.ts';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, 'http://localhost');
  const pathParam = parsed.searchParams.get('__path');

  if (pathParam !== null) {
    parsed.searchParams.delete('__path');
    const cleanedPath = pathParam.replace(/^\/+/, '');
    const qs = parsed.searchParams.toString();
    req.url = `/api${cleanedPath ? `/${cleanedPath}` : ''}${qs ? `?${qs}` : ''}`;
  } else if (parsed.pathname === '/api/index' || parsed.pathname === '/api/index/') {
    const qs = parsed.searchParams.toString();
    req.url = `/api${qs ? `?${qs}` : ''}`;
  } else if (!parsed.pathname.startsWith('/api')) {
    const qs = parsed.searchParams.toString();
    req.url = `/api${parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`}${qs ? `?${qs}` : ''}`;
  }

  app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1]
  );
}
