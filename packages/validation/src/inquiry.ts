import { InquiryStatus, enumValues } from '@walls/shared';
import { z } from 'zod';
import { displayNameSchema, emailSchema } from './auth';
import { optionalPhoneSchema } from './profile';
import { ADMIN_LIST_LIMITS } from './user';

export const INQUIRY_INPUT_LIMITS = {
  messageMinLength: 10,
  messageMaxLength: 2000,
  /** Bots fill every field; people never see this one. */
  honeypotMaxLength: 200,
} as const;

const L = INQUIRY_INPUT_LIMITS;

/**
 * A visitor's inquiry about a listing (SPEC §20). Visitors have no account. `website` is a
 * hidden trap field: a filled-in value marks the sender as a bot (decision, Phase 9).
 */
export const inquiryInputSchema = z.strictObject({
  name: displayNameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  message: z.string().trim().min(L.messageMinLength).max(L.messageMaxLength),
  website: z.string().max(L.honeypotMaxLength).default(''),
});
/** What the form sends (the trap field may be left out). */
export type InquiryInput = z.input<typeof inquiryInputSchema>;
/** A validated inquiry. */
export type InquiryData = z.output<typeof inquiryInputSchema>;

/** The inquiry form in the browser: the same rules, with the trap field always sent. */
export const inquiryFormSchema = inquiryInputSchema.extend({
  website: z.string().max(L.honeypotMaxLength),
});

/** Dashboard inquiry list: one status tab at a time, new inquiries first. */
export const inquiryListQuerySchema = z.strictObject({
  status: z.enum(enumValues(InquiryStatus)).default(InquiryStatus.NEW),
  page: z.coerce.number().int().min(1).max(ADMIN_LIST_LIMITS.maxPage).default(1),
});
export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;

export const inquiryStatusInputSchema = z.strictObject({
  status: z.enum(enumValues(InquiryStatus)),
});
export type InquiryStatusInput = z.infer<typeof inquiryStatusInputSchema>;
