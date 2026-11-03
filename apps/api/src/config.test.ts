import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const BASE = {
  DATABASE_URL: 'postgres://walls:walls@localhost:5432/walls',
  SESSION_SECRET: 'a-session-secret-that-is-long-enough-1234',
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('exchange rate configuration', () => {
  it('uses the NBS rate by default, also when the variables are left empty', () => {
    expect(loadConfig(BASE).exchangeRates).toEqual({ provider: 'nbs' });
    expect(
      loadConfig({ ...BASE, EXCHANGE_RATE_PROVIDER: '', EXCHANGE_RATE_FIXED_EUR_RSD: '' })
        .exchangeRates,
    ).toEqual({ provider: 'nbs' });
  });

  it('uses a fixed rate only when one is given, and never in production', () => {
    expect(
      loadConfig({ ...BASE, EXCHANGE_RATE_PROVIDER: 'fixed', EXCHANGE_RATE_FIXED_EUR_RSD: '117.2' })
        .exchangeRates,
    ).toEqual({ provider: 'fixed', eurRsd: '117.2' });
    expect(() => loadConfig({ ...BASE, EXCHANGE_RATE_PROVIDER: 'fixed' })).toThrow(
      /EXCHANGE_RATE_FIXED_EUR_RSD/,
    );
    expect(() =>
      loadConfig({
        ...BASE,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test',
        CLOUDINARY_CLOUD_NAME: 'c',
        CLOUDINARY_API_KEY: 'k',
        CLOUDINARY_API_SECRET: 's',
        EXCHANGE_RATE_PROVIDER: 'fixed',
        EXCHANGE_RATE_FIXED_EUR_RSD: '117.2',
      }),
    ).toThrow(/EXCHANGE_RATE_PROVIDER/);
  });
});

describe('Google sign-in configuration', () => {
  const PRODUCTION = {
    ...BASE,
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test',
    CLOUDINARY_CLOUD_NAME: 'c',
    CLOUDINARY_API_KEY: 'k',
    CLOUDINARY_API_SECRET: 's',
  };

  it('is off without credentials, also when the variables are left empty', () => {
    expect(loadConfig(BASE).google).toBeUndefined();
    expect(
      loadConfig({ ...BASE, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }).google,
    ).toBeUndefined();
  });

  it('uses Google with both credentials and refuses only one of them', () => {
    expect(
      loadConfig({ ...BASE, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }).google,
    ).toEqual({ provider: 'google', clientId: 'id', clientSecret: 'secret' });
    expect(() => loadConfig({ ...BASE, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('offers the fake Google account outside production only', () => {
    expect(loadConfig({ ...BASE, GOOGLE_SIGN_IN_FAKE: 'on' }).google).toEqual({
      provider: 'fake',
    });
    expect(() => loadConfig({ ...PRODUCTION, GOOGLE_SIGN_IN_FAKE: 'on' })).toThrow(
      /GOOGLE_SIGN_IN_FAKE/,
    );
  });
});
