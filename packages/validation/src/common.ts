import { z } from 'zod';

export const REASON_MAX_LENGTH = 2000;

/** A required, human-written justification, e.g. for rejections and deactivations. */
export const reasonSchema = z.string().trim().min(1).max(REASON_MAX_LENGTH);
