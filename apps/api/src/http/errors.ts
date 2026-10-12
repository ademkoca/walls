import { type ApiErrorBody, ApiErrorCode, DenialReason } from '@walls/shared';

export { ApiErrorCode as ErrorCode } from '@walls/shared';
export type { ApiErrorBody as ErrorBody } from '@walls/shared';

/** An expected failure with a client-safe message. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ApiErrorBody {
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
        ApiErrorCode.ACCOUNT_INACTIVE,
        'Account is not active',
      );
    case DenialReason.EMAIL_NOT_VERIFIED:
      return new AppError(
        HTTP_STATUS.FORBIDDEN,
        ApiErrorCode.EMAIL_NOT_VERIFIED,
        'Email address is not verified',
      );
    case DenialReason.ROLE_NOT_PERMITTED:
    case DenialReason.NOT_RESOURCE_PARTICIPANT:
      return new AppError(
        HTTP_STATUS.FORBIDDEN,
        ApiErrorCode.FORBIDDEN,
        'You are not allowed to do this',
      );
    case DenialReason.RESOURCE_DELETED:
      return new AppError(HTTP_STATUS.NOT_FOUND, ApiErrorCode.NOT_FOUND, 'Not found');
    case DenialReason.INVALID_STATE:
      return new AppError(
        HTTP_STATUS.CONFLICT,
        ApiErrorCode.INVALID_STATE,
        'Not allowed in the current state',
      );
  }
}

export const unauthenticated = () =>
  new AppError(HTTP_STATUS.UNAUTHORIZED, ApiErrorCode.UNAUTHENTICATED, 'Authentication required');

export const invalidToken = () =>
  new AppError(
    HTTP_STATUS.BAD_REQUEST,
    ApiErrorCode.INVALID_TOKEN,
    'This link is invalid or has expired',
  );
