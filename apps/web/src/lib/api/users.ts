import type { Page, UserDetail, UserSummary } from '@walls/shared';
import type { InviteAdminInput } from '@walls/validation';
import { apiFetch } from './client';

type UserResponse = { user: UserDetail };

/** Browser-side calls to user administration endpoints (Admin / Super Admin). */
export const usersApi = {
  /** Active agents matching `q`, for assigning listings. */
  /** Active agents and agencies, whom a listing can be assigned to (SPEC §5). */
  assignableProfessionals: (q: string) =>
    apiFetch<Page<UserSummary>>(
      `/users?${new URLSearchParams({ role: 'REAL_ESTATE_AGENT', status: 'ACTIVE', assignable: 'true', q }).toString()}`,
    ),
  deactivate: async (id: string, reason: string) =>
    (
      await apiFetch<UserResponse>(`/users/${encodeURIComponent(id)}/deactivate`, {
        method: 'POST',
        body: { reason },
      })
    ).user,
  reactivate: async (id: string, reason: string) =>
    (
      await apiFetch<UserResponse>(`/users/${encodeURIComponent(id)}/reactivate`, {
        method: 'POST',
        body: { reason },
      })
    ).user,
  inviteAdmin: async (input: InviteAdminInput) =>
    (await apiFetch<UserResponse>('/users/admins', { method: 'POST', body: input })).user,
};
