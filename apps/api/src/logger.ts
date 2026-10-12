import { pino, type Logger } from 'pino';
import type { Config } from './config';

export type { Logger };

/** Paths that must never reach the logs (AGENTS.md: no passwords, tokens or secrets). */
const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
];

export function createLogger(config: Pick<Config, 'env' | 'logLevel'>): Logger {
  return pino({
    level: config.logLevel,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    ...(config.env === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
