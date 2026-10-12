import path from 'node:path';
import { z } from 'zod';
import type { CloudinaryCredentials } from './media/cloudinary-client';

const MIN_SECRET_LENGTH = 32;
const DEFAULT_PORT = 4000;
const CLOUDINARY_VARIABLE_COUNT = 3;

/** An empty variable (as copied from .env.example) counts as unset. */
const unsetIfEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

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
    /** Auth requests (register, login, reset, …) allowed per IP every 15 minutes. */
    AUTH_RATE_LIMIT_PER_IP: z.coerce.number().int().positive().default(30),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1).default('Walls <no-reply@walls.rs>'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    /** Development only: where uploads are stored when Cloudinary is not configured. */
    LOCAL_MEDIA_DIR: z.string().min(1).default('.media'),
    /** Development only: private documents (agent proof files) without Cloudinary. */
    LOCAL_PRIVATE_FILES_DIR: z.string().min(1).default('.private-files'),
    /** "nbs": the National Bank of Serbia middle rate; "fixed": a set rate (development, tests). */
    EXCHANGE_RATE_PROVIDER: unsetIfEmpty(z.enum(['nbs', 'fixed']).default('nbs')),
    /** The EUR → RSD rate used by the "fixed" provider, e.g. 117.2. */
    EXCHANGE_RATE_FIXED_EUR_RSD: unsetIfEmpty(
      z
        .string()
        .regex(/^\d+(\.\d+)?$/, 'Must be a decimal number such as 117.2')
        .optional(),
    ),
  })
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.RESEND_API_KEY), {
    message: 'RESEND_API_KEY is required in production',
    path: ['RESEND_API_KEY'],
  })
  .refine((env) => env.EXCHANGE_RATE_PROVIDER !== 'fixed' || env.EXCHANGE_RATE_FIXED_EUR_RSD, {
    message: 'Required when EXCHANGE_RATE_PROVIDER is "fixed"',
    path: ['EXCHANGE_RATE_FIXED_EUR_RSD'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.EXCHANGE_RATE_PROVIDER === 'nbs', {
    message: 'Production uses the "nbs" provider',
    path: ['EXCHANGE_RATE_PROVIDER'],
  })
  .refine(
    (env) => {
      const set = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET]
        .map(Boolean)
        .filter(Boolean).length;
      return set === 0 ? env.NODE_ENV !== 'production' : set === CLOUDINARY_VARIABLE_COUNT;
    },
    {
      message: 'Set all three CLOUDINARY_* variables (required in production)',
      path: ['CLOUDINARY_CLOUD_NAME'],
    },
  );

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  databaseUrl: string;
  sessionSecret: string;
  /** Origin of the web app: allowed origin for state-changing requests and base for email links. */
  webOrigin: string;
  trustProxyHops: number;
  /** Auth requests per IP per 15 minutes (tests that share one IP raise it). */
  authRateLimitPerIp: number;
  email: { resendApiKey: string | undefined; from: string };
  media: {
    /** Absent outside production when not configured; uploads then go to `localDirectory`. */
    cloudinary: CloudinaryCredentials | undefined;
    localDirectory: string;
    /** Never served directly; see LocalDiskPrivateFileStorage. */
    localPrivateDirectory: string;
  };
  exchangeRates: { provider: 'nbs' } | { provider: 'fixed'; eurRsd: string };
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
    authRateLimitPerIp: parsed.AUTH_RATE_LIMIT_PER_IP,
    email: { resendApiKey: parsed.RESEND_API_KEY || undefined, from: parsed.EMAIL_FROM },
    media: {
      cloudinary:
        parsed.CLOUDINARY_CLOUD_NAME && parsed.CLOUDINARY_API_KEY && parsed.CLOUDINARY_API_SECRET
          ? {
              cloudName: parsed.CLOUDINARY_CLOUD_NAME,
              apiKey: parsed.CLOUDINARY_API_KEY,
              apiSecret: parsed.CLOUDINARY_API_SECRET,
            }
          : undefined,
      localDirectory: path.resolve(parsed.LOCAL_MEDIA_DIR),
      localPrivateDirectory: path.resolve(parsed.LOCAL_PRIVATE_FILES_DIR),
    },
    exchangeRates:
      parsed.EXCHANGE_RATE_PROVIDER === 'fixed' && parsed.EXCHANGE_RATE_FIXED_EUR_RSD
        ? { provider: 'fixed', eurRsd: parsed.EXCHANGE_RATE_FIXED_EUR_RSD }
        : { provider: 'nbs' },
  };
}
