import { Locale, enumValues } from '@walls/shared';
import { z } from 'zod';
import { displayNameSchema, emailSchema } from './auth';
import { INQUIRY_INPUT_LIMITS } from './inquiry';

export const CONTACT_INPUT_LIMITS = {
  subjectMinLength: 3,
  subjectMaxLength: 150,
  messageMinLength: 10,
  messageMaxLength: 4000,
} as const;

const L = CONTACT_INPUT_LIMITS;

/**
 * A visitor's message to the company through the contact page (decision 2026-10-16). Like
 * a listing inquiry, `website` is a hidden trap field that only bots fill in. `locale` is
 * the language of the page it was sent from, so the reply can be in the same language.
 */
export const contactInputSchema = z.strictObject({
  name: displayNameSchema,
  email: emailSchema,
  subject: z.string().trim().min(L.subjectMinLength).max(L.subjectMaxLength),
  message: z.string().trim().min(L.messageMinLength).max(L.messageMaxLength),
  locale: z.enum(enumValues(Locale)),
  website: z.string().max(INQUIRY_INPUT_LIMITS.honeypotMaxLength).default(''),
});
/** What the form sends (the trap field may be left out). */
export type ContactInput = z.input<typeof contactInputSchema>;
/** A validated contact message. */
export type ContactData = z.output<typeof contactInputSchema>;

/** The contact form in the browser: the same rules, with the trap field always sent. */
export const contactFormSchema = contactInputSchema.extend({
  website: z.string().max(INQUIRY_INPUT_LIMITS.honeypotMaxLength),
});
