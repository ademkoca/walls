import { DenialReason } from '@walls/shared';

/** Stable machine-readable error codes returned to clients. */
export const ErrorCode = {
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
  RATE_LIMITED: 'RATE_LIMITED',
  EXTERNAL_SERVICE_FAILED: 'EXTERNAL_SERVICE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

/** An expected failure with a client-safe message. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

/** Maps a domain authorization denial to an HTTP error. */
export function errorFromDenial(reason: DenialReason): AppError {
  switch (reason) {
    case DenialReason.ACCOUNT_INACTIVE:
      return new AppError(
        HTTP_STATUS.FORBIDDEN,
        ErrorCode.ACCOUNT_INACTIVE,
        'Account is not active',
      );
    case DenialReason.EMAIL_NOT_VERIFIED:
      return new AppError(
        HTTP_STATUS.FORBIDDEN,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Email address is not verified',
      );
    case DenialReason.ROLE_NOT_PERMITTED:
    case DenialReason.NOT_RESOURCE_PARTICIPANT:
      return new AppError(
        HTTP_STATUS.FORBIDDEN,
        ErrorCode.FORBIDDEN,
        'You are not allowed to do this',
      );
    case DenialReason.RESOURCE_DELETED:
      return new AppError(HTTP_STATUS.NOT_FOUND, ErrorCode.NOT_FOUND, 'Not found');
    case DenialReason.INVALID_STATE:
      return new AppError(
        HTTP_STATUS.CONFLICT,
        ErrorCode.INVALID_STATE,
        'Not allowed in the current state',
      );
  }
}

export const unauthenticated = () =>
  new AppError(HTTP_STATUS.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, 'Authentication required');

export const invalidToken = () =>
  new AppError(
    HTTP_STATUS.BAD_REQUEST,
    ErrorCode.INVALID_TOKEN,
    'This link is invalid or has expired',
  );
