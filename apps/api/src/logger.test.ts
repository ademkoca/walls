import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

function logLine(entry: object): Record<string, unknown> {
  let output = '';
  const logger = createLogger(
    { env: 'production', logLevel: 'info' },
    {
      write: (chunk: string) => {
        output += chunk;
      },
    },
  );
  logger.info(entry, 'request completed');
  return JSON.parse(output) as Record<string, unknown>;
}

describe('log redaction (AGENTS.md: no secrets, no unnecessary personal data)', () => {
  it('hides credentials and the visitor location that Netlify adds', () => {
    const line = logLine({
      req: {
        headers: {
          cookie: '__Host-walls_session=secret-token',
          authorization: 'Bearer secret',
          'x-nf-geo': 'eyJjaXR5IjoiSmFnb2RpbmEifQ==',
          'user-agent': 'Mozilla/5.0',
        },
      },
      res: { headers: { 'set-cookie': '__Host-walls_session=secret-token' } },
    });
    const text = JSON.stringify(line);
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('Bearer secret');
    expect(text).not.toContain('eyJjaXR5');
    expect(text).toContain('Mozilla/5.0');
  });
});
