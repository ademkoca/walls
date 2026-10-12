import { createDatabase } from '@walls/database';
import { createApp } from './app';
import { loadConfig } from './config';
import { createEmailService } from './email/create-email-service';
import { startOutboxWorker } from './email/outbox';
import { createLogger } from './logger';
import { createMediaStorage, createPrivateFileStorage } from './media/create-media-storage';

const OUTBOX_POLL_INTERVAL_MS = 5_000;

const config = loadConfig();
const logger = createLogger(config);
const { db, close: closeDatabase } = createDatabase({ url: config.databaseUrl });
const emailService = createEmailService(config, logger);

const mediaStorage = createMediaStorage(config, logger);
const privateFiles = createPrivateFileStorage(config, logger);

const server = createApp({ db, config, logger, mediaStorage, privateFiles }).listen(
  config.port,
  () => {
    logger.info({ port: config.port, env: config.env }, 'API listening');
  },
);
const stopOutboxWorker = startOutboxWorker(db, emailService, logger, OUTBOX_POLL_INTERVAL_MS);

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  stopOutboxWorker();
  server.close(() => {
    closeDatabase()
      .catch((error: unknown) => logger.error({ err: error }, 'Failed to close database'))
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
