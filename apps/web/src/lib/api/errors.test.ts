import { describe, expect, it } from 'vitest';
import { isApiErrorBody } from './errors';

describe('isApiErrorBody', () => {
  it('accepts the API error shape with a known code', () => {
    expect(isApiErrorBody({ error: { code: 'INVALID_TOKEN', message: 'x' } })).toBe(true);
  });

  it.each([null, {}, { error: 'nope' }, { error: { code: 'MADE_UP', message: 'x' } }])(
    'rejects %j',
    (value) => {
      expect(isApiErrorBody(value)).toBe(false);
    },
  );
});
