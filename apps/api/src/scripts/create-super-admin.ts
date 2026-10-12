/**
 * Bootstraps a Super Admin account. The new admin receives an email with a single-use
 * link to set their own password; no password is ever chosen or shown here (SPEC §3).
 *
 * Usage: pnpm admin:create --email admin@walls.rs --name "Ana Anić" [--locale en]
 */
import { parseArgs } from 'node:util';
import { createDatabase } from '@walls/database';
import { Locale, Role, enumValues } from '@walls/shared';
import { displayNameSchema, emailSchema } from '@walls/validation';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { loadConfig } from '../config';
import { createEmailService } from '../email/create-email-service';
import { processOutbox } from '../email/outbox';
import { AppError } from '../http/errors';
import { createLogger } from '../logger';

const argsSchema = z.object({
  email: emailSchema,
  name: displayNameSchema,
  locale: z.enum(enumValues(Locale)).default(Locale.SR),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' }, locale: { type: 'string' } },
  });
  const parsed = argsSchema.safeParse(values);
  if (!parsed.success) {
    console.error(
      'Usage: pnpm admin:create --email <email> --name "<display name>" [--locale sr|en]',
    );
    console.error(
      parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const logger = createLogger(config);
  const { db, close } = createDatabase({ url: config.databaseUrl, maxConnections: 1 });
  try {
    const user = await new AuthService(db, config).inviteUser(
      {
        email: parsed.data.email,
        displayName: parsed.data.name,
        role: Role.SUPER_ADMIN,
        locale: parsed.data.locale,
      },
      null,
    );
    // Deliver the setup email now rather than waiting for the API's outbox worker; only
    // this one, so other queued mail is still sent (and logged) by the API.
    await processOutbox(db, createEmailService(config, logger), logger, {
      recipient: user.email,
    });
    console.info(
      `Super Admin ${user.email} created. They must open the emailed link to set a password.`,
    );
  } catch (error) {
    if (error instanceof AppError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await close();
  }
}

await main();
