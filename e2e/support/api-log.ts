import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';

/**
 * Without RESEND_API_KEY the API prints every email, links included, to its log. The suite
 * runs the API with that log redirected to this file and reads emails back from it, so no
 * test-only endpoint or product code is needed.
 */
export const API_LOG_FILE = path.resolve(import.meta.dirname, '../.output/api.log');

const LINK_PATTERN = /https?:\/\/\S+/;

interface LoggedEmail {
  to: string;
  msg: string;
}

function loggedEmails(): LoggedEmail[] {
  let content: string;
  try {
    content = readFileSync(API_LOG_FILE, 'utf8');
  } catch {
    return [];
  }
  const emails: LoggedEmail[] = [];
  for (const line of content.split('\n')) {
    if (!line.includes('Email (not sent)')) continue;
    try {
      const entry = JSON.parse(line) as Partial<LoggedEmail>;
      if (typeof entry.to === 'string' && typeof entry.msg === 'string') {
        emails.push({ to: entry.to, msg: entry.msg });
      }
    } catch {
      // Not a JSON log line.
    }
  }
  return emails;
}

/** Waits for the outbox worker to deliver an email to `to`, and returns the link in it. */
export async function emailedLink(to: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      () => {
        const message = loggedEmails().findLast((email) => email.to === to);
        link = message?.msg.match(LINK_PATTERN)?.[0];
        return link;
      },
      { message: `Waiting for an email with a link to ${to}`, timeout: 30_000 },
    )
    .toBeDefined();
  return link as string;
}

/** Waits for the outbox worker to deliver an email to `to` containing `text`, and returns it. */
export async function emailedText(to: string, text: string): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      () => {
        found = loggedEmails().findLast(
          (email) => email.to === to && email.msg.includes(text),
        )?.msg;
        return found;
      },
      { message: `Waiting for an email to ${to} containing "${text}"`, timeout: 30_000 },
    )
    .toBeDefined();
  return found as string;
}
