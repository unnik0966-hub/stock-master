import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

function containsUnsafeOperatorKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsUnsafeOperatorKeys);
  }
  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        return true;
      }
      if (containsUnsafeOperatorKeys(val)) {
        return true;
      }
    }
  }
  return false;
}

export function rejectNoSqlOperators(req: Request, res: Response, next: NextFunction): void {
  if (
    containsUnsafeOperatorKeys(req.body) ||
    containsUnsafeOperatorKeys(req.query) ||
    containsUnsafeOperatorKeys(req.params)
  ) {
    res.status(400).json({ error: 'Invalid request payload keys.' });
    return;
  }
  next();
}

export function isSafeImageUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith('/src/assets/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      res.status(400).json({
        error: firstIssue ? `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}` : 'Validation failed.',
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
