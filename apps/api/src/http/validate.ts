import type { Request } from 'express';
import type { z } from 'zod';

/** Validates the request body; a ZodError becomes a 400 response in the error handler. */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.body ?? {});
}
