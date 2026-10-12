import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Logger } from '../logger';
import { AppError, type ErrorBody, ErrorCode } from './errors';

const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_PAYLOAD_TOO_LARGE = 413;
const STATUS_INTERNAL_ERROR = 500;

/** Errors raised by body parsing middleware (express.json). */
interface BodyParserError {
  type?: string;
  status?: number;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ErrorBody = { error: { code: ErrorCode.NOT_FOUND, message: 'Not found' } };
  res.status(STATUS_NOT_FOUND).json(body);
};

/** Converts every error into the consistent API error shape; never leaks internals. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json(error.toBody());
      return;
    }
    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'The request is invalid',
          details: error.issues.map(({ path, message, code }) => ({ path, message, code })),
        },
      };
      res.status(STATUS_BAD_REQUEST).json(body);
      return;
    }
    const parserError = error as BodyParserError;
    if (parserError.type === 'entity.parse.failed') {
      res.status(STATUS_BAD_REQUEST).json({
        error: { code: ErrorCode.INVALID_JSON, message: 'Malformed JSON body' },
      } satisfies ErrorBody);
      return;
    }
    if (parserError.type === 'entity.too.large') {
      res.status(STATUS_PAYLOAD_TOO_LARGE).json({
        error: { code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Request body is too large' },
      } satisfies ErrorBody);
      return;
    }

    logger.error({ err: error, method: req.method, path: req.path }, 'Unhandled request error');
    res.status(STATUS_INTERNAL_ERROR).json({
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong' },
    } satisfies ErrorBody);
  };
}
