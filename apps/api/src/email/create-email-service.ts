import type { Config } from '../config';
import type { Logger } from '../logger';
import { ConsoleEmailService, type EmailService, ResendEmailService } from './email-service';

/**
 * Resend when an API key is configured (always in production — enforced by config),
 * otherwise emails are printed to the console for local development.
 */
export function createEmailService(config: Config, logger: Logger): EmailService {
  if (config.email.resendApiKey) {
    return new ResendEmailService(config.email.resendApiKey, config.email.from);
  }
  logger.warn('RESEND_API_KEY is not set: emails are printed to the console, not sent');
  return new ConsoleEmailService(logger);
}
