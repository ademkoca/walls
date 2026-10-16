import type { Database } from '@walls/database';
import { DEFAULT_LOCALE } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import type { ContactData } from '@walls/validation';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import type { Logger } from '../logger';

/**
 * Messages from the contact page (decision 2026-10-16). They are only emailed to the company
 * inbox, with replies going to the visitor; nothing is stored once the email is sent, and the
 * visitor gets no confirmation email, so the form cannot be used to send mail to others.
 */
export class ContactService {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  /** A filled-in trap field marks a bot: the message is dropped and the sender is not told. */
  async send(input: ContactData): Promise<void> {
    if (input.website !== '') {
      this.logger.info('Contact message dropped: trap field filled in');
      return;
    }
    await enqueueEmail(this.db, {
      template: EmailTemplate.CONTACT_MESSAGE,
      to: brand.company.email,
      locale: DEFAULT_LOCALE,
      payload: {
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        pageLocale: input.locale,
      },
    });
    this.logger.info('Contact message queued');
  }
}
