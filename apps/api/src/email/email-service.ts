import type { Logger } from '../logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where replies go, e.g. the visitor who sent an inquiry. */
  replyTo?: string;
}

/** Sends transactional email. Business logic depends only on this interface (SPEC §21). */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend responded with HTTP ${response.status}`);
    }
  }
}

/**
 * Development only: prints emails (including their links) to the console instead of
 * sending them. Never used in production, where RESEND_API_KEY is required.
 */
export class ConsoleEmailService implements EmailService {
  constructor(private readonly logger: Logger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject },
      `Email (not sent)\n${message.text}`,
    );
    return Promise.resolve();
  }
}

/** For tests: keeps sent messages in memory. */
export class RecordingEmailService implements EmailService {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}
