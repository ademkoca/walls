import { type DestinationStream, type Logger, type LoggerOptions, pino } from 'pino';
import type { Config } from './config';

export type { Logger };

/** Paths that must never reach the logs (AGENTS.md: no passwords, tokens or secrets). */
const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  // Netlify adds the visitor's city and coordinates; nothing needs them in the logs.
  'req.headers["x-nf-geo"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
];

/** `destination` is for tests that read the log lines; by default logs go to the console. */
export function createLogger(
  config: Pick<Config, 'env' | 'logLevel'>,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level: config.logLevel,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    ...(config.env === 'development' && !destination
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  };
  return destination ? pino(options, destination) : pino(options);
}
