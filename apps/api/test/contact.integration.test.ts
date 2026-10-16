import { randomUUID } from 'node:crypto';
import { brand } from '@walls/ui/brand';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext, uniqueEmail } from './helpers';

const ctx = createTestContext();
afterAll(ctx.close);

const CONTACT = '/api/v1/public/contact';

const message = (overrides: Record<string, string> = {}) => ({
  name: 'Marija Petrović',
  email: uniqueEmail(),
  subject: `Pitanje ${randomUUID().slice(0, 8)}`,
  message: 'Da li mogu da oglasim više nekretnina?\nHvala.',
  locale: 'en',
  ...overrides,
});

/** Delivers queued email and returns what reached the company inbox with this subject. */
async function inboxEmailsAbout(subject: string) {
  await ctx.lastEmailTo(brand.company.email);
  return ctx.emails.sent.filter(
    (email) => email.to === brand.company.email && email.subject.includes(subject),
  );
}

describe('contact form (decision 2026-10-16)', () => {
  it('emails the company inbox, with replies going to the visitor', async () => {
    const body = message();
    const response = await ctx.client().post(CONTACT, body);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: true });

    const [email, ...others] = await inboxEmailsAbout(body.subject);
    expect(others).toEqual([]);
    expect(email?.replyTo).toBe(body.email);
    expect(email?.text).toContain('Hvala.');
    expect(email?.text).toContain(body.email);
    // The inbox reads Serbian; the note says which site the visitor wrote from.
    expect(email?.text).toContain('engleske verzije sajta');
  });

  it('silently drops messages with the trap field filled in', async () => {
    const body = message({ website: 'https://spam.example' });
    const response = await ctx.client().post(CONTACT, body);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: true });
    expect(await inboxEmailsAbout(body.subject)).toEqual([]);
  });

  it('rejects invalid input', async () => {
    for (const body of [
      message({ email: 'not-an-email' }),
      message({ message: 'Kratko' }),
      message({ subject: 'Hi' }),
      message({ locale: 'de' }),
      { ...message(), role: 'ADMIN' },
    ]) {
      const response = await ctx.client().post(CONTACT, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('limits messages per IP address', async () => {
    const limited = createTestContext({ contactRateLimit: { windowMs: 60_000, limit: 2 } });
    try {
      expect((await limited.client().post(CONTACT, message())).status).toBe(201);
      expect((await limited.client().post(CONTACT, message())).status).toBe(201);
      const blocked = await limited.client().post(CONTACT, message());
      expect(blocked.status).toBe(429);
      expect(blocked.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    } finally {
      await limited.close();
    }
  });
});
