import { Locale, ReviewStatus, enumValues } from '@walls/shared';
import { z } from 'zod';
import { AUTH_INPUT_LIMITS, displayNameSchema, emailSchema } from './auth';
import { ADMIN_LIST_LIMITS } from './user';

export const PROFILE_INPUT_LIMITS = {
  bioMaxLength: 2000,
  agencyNameMaxLength: 120,
  phoneMaxLength: 30,
  phoneMinDigits: 6,
  phoneMaxDigits: 15,
} as const;

const L = PROFILE_INPUT_LIMITS;
const PHONE_CHARACTERS = /^\+?[0-9 ()/.-]+$/;
const NON_DIGITS = /\D/g;

function isPhoneNumber(value: string): boolean {
  const digits = value.replace(NON_DIGITS, '').length;
  return PHONE_CHARACTERS.test(value) && digits >= L.phoneMinDigits && digits <= L.phoneMaxDigits;
}

/** A phone number as people write it, e.g. "+381 64 123 4567" or "064/123-4567". */
export const phoneSchema = z
  .string()
  .trim()
  .max(L.phoneMaxLength)
  .refine(isPhoneNumber, { message: 'Invalid phone number' });

/** Optional text fields arrive as strings; the API stores an empty string as null. */
const optionalText = (max: number) => z.string().trim().max(max);

/** An optional phone number: empty, or a valid number. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(L.phoneMaxLength)
  .refine((value) => value === '' || isPhoneNumber(value), { message: 'Invalid phone number' });

/**
 * "For real-estate agents" application (SPEC §2.1). Proof files travel in the same
 * multipart request and are checked separately from their content.
 */
export const agentApplicationInputSchema = z.strictObject({
  fullName: displayNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  agencyName: optionalText(L.agencyNameMaxLength),
  locale: z.enum(enumValues(Locale)),
});
export type AgentApplicationInput = z.infer<typeof agentApplicationInputSchema>;

/**
 * The editable profile (SPEC §4). Role rules (agents must have a phone, only agents have
 * an agency name, agents' phones are always public) are applied by the API.
 */
export const profileInputSchema = z.strictObject({
  displayName: displayNameSchema,
  bio: optionalText(L.bioMaxLength),
  agencyName: optionalText(L.agencyNameMaxLength),
  phone: optionalPhoneSchema,
  isPhonePublic: z.boolean(),
  isEmailPublic: z.boolean(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Changing the sign-in email needs the current password and a verified new address. */
export const emailChangeInputSchema = z.strictObject({
  newEmail: emailSchema,
  currentPassword: z.string().min(1).max(AUTH_INPUT_LIMITS.passwordMaxLength),
});
export type EmailChangeInput = z.infer<typeof emailChangeInputSchema>;

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_LIST_LIMITS.maxPage).default(1);

export const reviewQueueQuerySchema = z.strictObject({
  status: z.enum(enumValues(ReviewStatus)).default(ReviewStatus.PENDING),
  page: pageSchema,
});
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;

export const publicPageQuerySchema = z.strictObject({ page: pageSchema });
