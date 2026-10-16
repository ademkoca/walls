import type { ContactInput } from '@walls/validation';
import { apiFetch } from './client';

/** Browser-side call for the contact page. */
export const contactApi = {
  /** Public: a visitor writes to the company. */
  send: (input: ContactInput) =>
    apiFetch<{ received: true }>('/public/contact', { method: 'POST', body: input }),
};
