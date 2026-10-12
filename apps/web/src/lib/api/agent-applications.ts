import type { AgentApplicationDetail } from '@walls/shared';
import { apiFetch } from './client';

type ApplicationResponse = { application: AgentApplicationDetail };
const path = (id: string) => `/agent-applications/${encodeURIComponent(id)}`;

/** Browser-side calls for agent applications (SPEC §2.1). */
export const agentApplicationsApi = {
  /** Public: the form fields plus the proof files under `files`. */
  submit: (form: FormData) => apiFetch('/agent-applications', { method: 'POST', body: form }),
  approve: async (id: string) =>
    (await apiFetch<ApplicationResponse>(`${path(id)}/approve`, { method: 'POST' })).application,
  reject: async (id: string, reason: string) =>
    (
      await apiFetch<ApplicationResponse>(`${path(id)}/reject`, {
        method: 'POST',
        body: { reason },
      })
    ).application,
  /** Opened in a new tab; the browser sends the session cookie through the /api proxy. */
  fileUrl: (id: string, fileId: string) => `/api/v1${path(id)}/files/${encodeURIComponent(fileId)}`,
};
