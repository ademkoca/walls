const UNIQUE_VIOLATION = '23505';

/** Whether a database error (possibly wrapped by Drizzle) is a unique-constraint violation. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const pgError = current as Error & { code?: unknown; constraint_name?: unknown };
    if (pgError.code === UNIQUE_VIOLATION) {
      return constraint === undefined || pgError.constraint_name === constraint;
    }
  }
  return false;
}
