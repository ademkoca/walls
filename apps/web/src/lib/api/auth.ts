import type { CurrentUser, GooglePendingSignup } from '@walls/shared';
import type {
  EmailRequestInput,
  GoogleSignupInput,
  LoginInput,
  RegisterInput,
  SetPasswordInput,
} from '@walls/validation';
import { apiFetch } from './client';

/** Browser-side calls to the auth endpoints. */
export const authApi = {
  register: (input: RegisterInput) => apiFetch('/auth/register', { method: 'POST', body: input }),
  resendVerification: (input: EmailRequestInput) =>
    apiFetch('/auth/resend-verification', { method: 'POST', body: input }),
  verifyEmail: (token: string) =>
    apiFetch('/auth/verify-email', { method: 'POST', body: { token } }),
  login: (input: LoginInput) =>
    apiFetch<{ user: CurrentUser }>('/auth/login', { method: 'POST', body: input }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  me: (signal?: AbortSignal) =>
    apiFetch<{ user: CurrentUser }>('/auth/me', signal ? { signal } : {}),
  forgotPassword: (input: EmailRequestInput) =>
    apiFetch('/auth/forgot-password', { method: 'POST', body: input }),
  resetPassword: (input: SetPasswordInput) =>
    apiFetch('/auth/reset-password', { method: 'POST', body: input }),
  setupAccount: (input: SetPasswordInput) =>
    apiFetch('/auth/setup-account', { method: 'POST', body: input }),
  /** The Google account waiting on the choice page, if any (SPEC §3.1). */
  googlePending: async () =>
    (await apiFetch<{ pending: GooglePendingSignup | null }>('/auth/google/pending')).pending,
  googleRegister: (input: GoogleSignupInput) =>
    apiFetch<{ user: CurrentUser }>('/auth/google/register', { method: 'POST', body: input }),
  confirmGoogleLink: (token: string) =>
    apiFetch('/auth/google/confirm-link', { method: 'POST', body: { token } }),
};
