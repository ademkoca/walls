import type { Locale, Role } from '../enums';

/**
 * Types shared by the REST API and its clients. The API is the only producer of these
 * shapes; clients must not construct them.
 */

/** Stable machine-readable error codes returned in `ApiErrorBody`. */
export const ApiErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  CONFLICT: 'CONFLICT',
  /** 422: the listing misses data required for review; `details.issues` lists what. */
  SUBMISSION_INCOMPLETE: 'SUBMISSION_INCOMPLETE',
  /** 422: an uploaded image breaks the image rules; `details.issues` lists how. */
  INVALID_IMAGE: 'INVALID_IMAGE',
  /** 409: the listing already has the maximum number of images. */
  IMAGE_LIMIT_REACHED: 'IMAGE_LIMIT_REACHED',
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE_FAILED: 'EXTERNAL_SERVICE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

/** The signed-in user (GET /auth/me, POST /auth/login). Never includes credentials. */
export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  slug: string;
  preferredLocale: Locale;
  emailVerified: boolean;
}
