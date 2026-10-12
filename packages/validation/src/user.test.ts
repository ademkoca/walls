import { describe, expect, it } from 'vitest';
import { deactivateUserInputSchema } from './user';

describe('deactivation input', () => {
  it('requires a non-blank reason', () => {
    expect(deactivateUserInputSchema.safeParse({}).success).toBe(false);
    expect(deactivateUserInputSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(deactivateUserInputSchema.parse({ reason: ' Spam listings ' })).toEqual({
      reason: 'Spam listings',
    });
  });
});
