import { z } from 'zod';

export const REASON_MAX_LENGTH = 2000;

/** A required, human-written justification, e.g. for rejections and deactivations. */
export const reasonSchema = z.string().trim().min(1).max(REASON_MAX_LENGTH);

/** Rejecting something under review (agent applications, profile changes) needs a reason. */
export const rejectionInputSchema = z.strictObject({ reason: reasonSchema });
export type RejectionInput = z.infer<typeof rejectionInputSchema>;

/** A public URL segment such as a profile or listing slug: lowercase words joined by "-". */
export const slugParamSchema = z
  .string()
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
