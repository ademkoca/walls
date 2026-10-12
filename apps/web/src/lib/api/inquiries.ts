import type { InquiryDetail, InquiryStatus } from '@walls/shared';
import type { InquiryInput } from '@walls/validation';
import { apiFetch } from './client';

const listingPath = (slug: string) => `/public/listings/${encodeURIComponent(slug)}`;

/** Browser-side calls for inquiries (SPEC §20) and view counting (SPEC §23). */
export const inquiriesApi = {
  /** Public: a visitor contacts the advertiser of a listing. */
  send: (slug: string, input: InquiryInput) =>
    apiFetch<{ received: true }>(`${listingPath(slug)}/inquiries`, { method: 'POST', body: input }),
  setStatus: async (id: string, status: InquiryStatus) =>
    (
      await apiFetch<{ inquiry: InquiryDetail }>(`/inquiries/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: { status },
      })
    ).inquiry,
  /** Public: the listing page reports that it was viewed; the API decides whether it counts. */
  reportView: (slug: string) => apiFetch(`${listingPath(slug)}/views`, { method: 'POST' }),
};
