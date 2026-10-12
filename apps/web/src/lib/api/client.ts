import { ApiErrorCode } from '@walls/shared';
import { ApiError, NetworkError, isApiErrorBody } from './errors';

/** Browser calls go through the web app's /api rewrite, so cookies stay first-party. */
const API_BASE_PATH = '/api/v1';
const STATUS_NO_CONTENT = 204;
const STATUS_ACCEPTED = 202;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Calls the API from the browser. Resolves with the parsed JSON body (or undefined for
 * 202/204) and rejects with ApiError or NetworkError.
 */
export async function apiFetch<T = undefined>(
  path: string,
  options: { method?: Method; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError();
  }

  if (response.status === STATUS_NO_CONTENT || response.status === STATUS_ACCEPTED) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(data)) {
      throw new ApiError(response.status, data.error.code, data.error.message, data.error.details);
    }
    throw new ApiError(response.status, ApiErrorCode.INTERNAL_ERROR, `HTTP ${response.status}`);
  }
  return data as T;
}
