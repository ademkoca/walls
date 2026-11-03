import { GoogleSignInIntent, Locale, enumValues } from '@walls/shared';
import { z } from 'zod';

export const AUTH_INPUT_LIMITS = {
  emailMaxLength: 254,
  /** NIST SP 800-63B: length matters more than composition rules. */
  passwordMinLength: 10,
  /** Caps hashing cost for oversized inputs. */
  passwordMaxLength: 128,
  displayNameMinLength: 2,
  displayNameMaxLength: 80,
} as const;

const L = AUTH_INPUT_LIMITS;

/** Emails are compared case-insensitively by the database; only whitespace is trimmed here. */
export const emailSchema = z.string().trim().max(L.emailMaxLength).pipe(z.email());

/** A new password. Login accepts any non-empty string so policy changes never lock users out. */
export const newPasswordSchema = z.string().min(L.passwordMinLength).max(L.passwordMaxLength);

export const displayNameSchema = z
  .string()
  .trim()
  .min(L.displayNameMinLength)
  .max(L.displayNameMaxLength);

/** Single-use tokens from emailed links: 32 random bytes, base64url-encoded. */
export const emailTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid token');

/**
 * Private-seller registration (SPEC §3). There is deliberately no role field: public
 * registration always creates a PRIVATE_SELLER, and strict parsing rejects `role`.
 */
export const registerInputSchema = z.strictObject({
  displayName: displayNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  locale: z.enum(enumValues(Locale)),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(L.passwordMaxLength),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** Resend verification / forgot password: responses never reveal whether the email exists. */
export const emailRequestInputSchema = z.strictObject({ email: emailSchema });
export type EmailRequestInput = z.infer<typeof emailRequestInputSchema>;

export const verifyEmailInputSchema = z.strictObject({ token: emailTokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

/** Password reset and first-time account setup both set a password from an emailed token. */
export const setPasswordInputSchema = z.strictObject({
  token: emailTokenSchema,
  password: newPasswordSchema,
});
export type SetPasswordInput = z.infer<typeof setPasswordInputSchema>;

/** Longest post-login path the web app may ask to return to. */
const NEXT_PATH_MAX_LENGTH = 500;

/**
 * Starting "Continue with Google" (GET /auth/google). `next` is a path on the web app;
 * the API only redirects to same-site paths. `token` is the setup link's token.
 */
export const googleStartQuerySchema = z.object({
  intent: z.enum(enumValues(GoogleSignInIntent)).default(GoogleSignInIntent.SIGN_IN),
  locale: z.enum(enumValues(Locale)).default(Locale.SR),
  next: z
    .string()
    .max(NEXT_PATH_MAX_LENGTH)
    .regex(/^\/(?![/\\])/, 'Must be a path on this site')
    .optional(),
  token: emailTokenSchema.optional(),
});
export type GoogleStartQuery = z.infer<typeof googleStartQuerySchema>;

/**
 * Creating a private-seller account from a Google account (SPEC §3.1). The email comes from
 * Google, never from the request; the name is prefilled from Google and may be edited.
 */
export const googleSignupInputSchema = z.strictObject({
  displayName: displayNameSchema,
  locale: z.enum(enumValues(Locale)),
});
export type GoogleSignupInput = z.infer<typeof googleSignupInputSchema>;
