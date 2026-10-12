import { type ApiErrorBody, ApiErrorCode } from '@walls/shared';

/** A failed API call with the API's error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The API could not be reached at all (offline, DNS, server down). */
export class NetworkError extends Error {
  constructor() {
    super('The API could not be reached');
    this.name = 'NetworkError';
  }
}

const KNOWN_CODES = new Set<string>(Object.values(ApiErrorCode));

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  const error = (value as Partial<ApiErrorBody> | null)?.error;
  return typeof error?.code === 'string' && KNOWN_CODES.has(error.code);
}
