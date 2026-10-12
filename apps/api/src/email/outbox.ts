import { type Database, type DbExecutor, emailOutbox } from '@walls/database';
import type { Locale } from '@walls/shared';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { Logger } from '../logger';
import type { EmailService } from './email-service';
import { type EmailPayloads, type EmailTemplate, renderEmail } from './templates';

const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 60_000;
const DEFAULT_BATCH_SIZE = 20;
const MAX_ERROR_LENGTH = 500;

/** Queues an email. Call inside the transaction of the change that triggers it. */
export async function enqueueEmail<T extends EmailTemplate>(
  db: DbExecutor,
  email: { template: T; to: string; locale: Locale; payload: EmailPayloads[T] },
): Promise<void> {
  await db.insert(emailOutbox).values({
    template: email.template,
    recipientEmail: email.to,
    locale: email.locale,
    payload: email.payload,
  });
}

/** Exponential backoff: 1, 2, 4, 8 minutes. */
const retryDelayMs = (attempts: number) => BASE_RETRY_DELAY_MS * 2 ** (attempts - 1);

/**
 * Sends due emails. Rows are locked with SKIP LOCKED, so several API instances never
 * send the same email. Payloads are cleared once sent (or given up on) because they can
 * contain single-use links. `recipient` limits the run to one address (used by scripts
 * that must not deliver other people's mail). Returns the number of emails processed.
 */
export async function processOutbox(
  db: Database,
  emailService: EmailService,
  logger: Logger,
  options: { batchSize?: number; recipient?: string } = {},
): Promise<number> {
  const { batchSize = DEFAULT_BATCH_SIZE, recipient } = options;
  return db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(emailOutbox)
      .where(
        and(
          eq(emailOutbox.status, 'PENDING'),
          lte(emailOutbox.nextAttemptAt, sql`now()`),
          recipient === undefined ? undefined : eq(emailOutbox.recipientEmail, recipient),
        ),
      )
      .orderBy(asc(emailOutbox.createdAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    for (const email of due) {
      try {
        const message = renderEmail(
          email.template as EmailTemplate,
          email.locale,
          email.payload as EmailPayloads[EmailTemplate],
        );
        await emailService.send({ to: email.recipientEmail, ...message });
        await tx
          .update(emailOutbox)
          .set({ status: 'SENT', sentAt: new Date(), payload: null, lastError: null })
          .where(eq(emailOutbox.id, email.id));
        logger.info({ emailId: email.id, template: email.template }, 'Email sent');
      } catch (error) {
        const attempts = email.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        await tx
          .update(emailOutbox)
          .set({
            attempts,
            status: failed ? 'FAILED' : 'PENDING',
            lastError: String(error instanceof Error ? error.message : error).slice(
              0,
              MAX_ERROR_LENGTH,
            ),
            nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
            ...(failed ? { payload: null } : {}),
          })
          .where(eq(emailOutbox.id, email.id));
        logger.warn(
          { emailId: email.id, template: email.template, attempts, failed },
          'Email delivery failed',
        );
      }
    }
    return due.length;
  });
}

/** Polls the outbox on an interval. Returns a function that stops the worker. */
export function startOutboxWorker(
  db: Database,
  emailService: EmailService,
  logger: Logger,
  intervalMs: number,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processOutbox(db, emailService, logger)
      .catch((error: unknown) => logger.error({ err: error }, 'Email outbox processing failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
