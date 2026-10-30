import type { UserDetail } from '@walls/shared';
import type { InviteAdminInput } from '@walls/validation';
import { apiFetch } from './client';

type UserResponse = { user: UserDetail };

/** Browser-side calls to user administration endpoints (Admin / Super Admin). */
export const usersApi = {
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
