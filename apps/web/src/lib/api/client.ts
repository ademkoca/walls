import { ApiErrorCode } from '@walls/shared';
import { ApiError, NetworkError, isApiErrorBody } from './errors';

/** Browser calls go through the web app's /api rewrite, so cookies stay first-party. */
const API_BASE_PATH = '/api/v1';
const STATUS_NO_CONTENT = 204;
const STATUS_ACCEPTED = 202;
const STATUS_PAYLOAD_TOO_LARGE = 413;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Calls the API from the browser. Resolves with the parsed JSON body (or undefined for
 * 202/204) and rejects with ApiError or NetworkError. A `FormData` body is sent as
 * multipart (file uploads); anything else as JSON.
 */
export async function apiFetch<T = undefined>(
  path: string,
  options: { method?: Method; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const isJson = body !== undefined && !(body instanceof FormData);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body === undefined ? {} : { body: isJson ? JSON.stringify(body) : body }),
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
    // The hosting platform answers an oversized request itself, with plain text.
    if (response.status === STATUS_PAYLOAD_TOO_LARGE && !isApiErrorBody(data)) {
      throw new ApiError(response.status, ApiErrorCode.PAYLOAD_TOO_LARGE, 'Payload too large');
    }
    if (isApiErrorBody(data)) {
      throw new ApiError(response.status, data.error.code, data.error.message, data.error.details);
    }
    throw new ApiError(response.status, ApiErrorCode.INTERNAL_ERROR, `HTTP ${response.status}`);
  }
  return data as T;
}
