import { z } from 'zod';
import { reasonSchema } from './common';

/** Deactivating an account always needs a reason; it is audited and emailed to the user. */
export const deactivateUserInputSchema = z.strictObject({
  reason: reasonSchema,
});
export type DeactivateUserInput = z.infer<typeof deactivateUserInputSchema>;
