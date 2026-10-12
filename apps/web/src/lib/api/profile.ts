import type { MyProfile, ProfileChangeRequestDetail } from '@walls/shared';
import type { EmailChangeInput, ProfileInput } from '@walls/validation';
import { apiFetch } from './client';

type ProfileResponse = { profile: MyProfile };
const profileOf = async (request: Promise<ProfileResponse>) => (await request).profile;

/** Browser-side calls for the signed-in user's own profile (SPEC §4). */
export const profileApi = {
  update: (input: ProfileInput) =>
    profileOf(apiFetch<ProfileResponse>('/me/profile', { method: 'PUT', body: input })),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return profileOf(
      apiFetch<ProfileResponse>('/me/profile/avatar', { method: 'POST', body: form }),
    );
  },
  removeAvatar: () =>
    profileOf(apiFetch<ProfileResponse>('/me/profile/avatar', { method: 'DELETE' })),
  discardChanges: () =>
    profileOf(apiFetch<ProfileResponse>('/me/profile/change-request', { method: 'DELETE' })),
  requestEmailChange: (input: EmailChangeInput) =>
    profileOf(apiFetch<ProfileResponse>('/me/email-change', { method: 'POST', body: input })),
  cancelEmailChange: () =>
    profileOf(apiFetch<ProfileResponse>('/me/email-change', { method: 'DELETE' })),
  confirmEmailChange: (token: string) =>
    apiFetch<{ awaitingApproval: boolean }>('/auth/confirm-email-change', {
      method: 'POST',
      body: { token },
    }),
};

type RequestResponse = { request: ProfileChangeRequestDetail };
const requestPath = (id: string) => `/profile-changes/${encodeURIComponent(id)}`;

/** Admin review of agents' profile changes. */
export const profileChangesApi = {
  approve: async (id: string) =>
    (await apiFetch<RequestResponse>(`${requestPath(id)}/approve`, { method: 'POST' })).request,
  reject: async (id: string, reason: string) =>
    (
      await apiFetch<RequestResponse>(`${requestPath(id)}/reject`, {
        method: 'POST',
        body: { reason },
      })
    ).request,
};
