import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;
const DEFAULT_PORT = 4000;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    SESSION_SECRET: z
      .string()
      .min(MIN_SECRET_LENGTH, `Must be at least ${MIN_SECRET_LENGTH} characters`),
    WEB_ORIGIN: z.url(),
    /** Number of reverse proxies in front of the API, used to read the client IP. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1).default('Walls <no-reply@walls.rs>'),
  })
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.RESEND_API_KEY), {
    message: 'RESEND_API_KEY is required in production',
    path: ['RESEND_API_KEY'],
  });

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  databaseUrl: string;
  sessionSecret: string;
  /** Origin of the web app: allowed origin for state-changing requests and base for email links. */
  webOrigin: string;
  trustProxyHops: number;
  email: { resendApiKey: string | undefined; from: string };
}

/** Parses and validates environment variables. Throws with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
  }
  const parsed = result.data;
  return {
    env: parsed.NODE_ENV,
    port: parsed.API_PORT,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    sessionSecret: parsed.SESSION_SECRET,
    webOrigin: new URL(parsed.WEB_ORIGIN).origin,
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
    email: { resendApiKey: parsed.RESEND_API_KEY || undefined, from: parsed.EMAIL_FROM },
  };
}
