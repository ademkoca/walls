import type { ListingDetail, ListingImage } from '@walls/shared';
import type { ListingInput, MediaOrderInput, SetFeaturedInput } from '@walls/validation';
import { apiFetch } from './client';

type DetailResponse = { listing: ListingDetail };
/** Status changes the creator and reviewers share (SPEC §6). */
export type StatusChange = 'mark-sold' | 'mark-rented' | 'archive' | 'reopen' | 'unarchive';
type ImagesResponse = { images: ListingImage[] };

const base = (id: string) => `/listings/${encodeURIComponent(id)}`;

/** Browser-side calls to the dashboard listing endpoints. */
export const listingsApi = {
  create: () => apiFetch<{ id: string }>('/listings', { method: 'POST' }),
  get: async (id: string) => (await apiFetch<DetailResponse>(base(id))).listing,
  update: async (id: string, input: ListingInput) =>
    (await apiFetch<DetailResponse>(base(id), { method: 'PATCH', body: input })).listing,
  remove: (id: string) => apiFetch(base(id), { method: 'DELETE' }),
  submit: async (id: string) =>
    (await apiFetch<DetailResponse>(`${base(id)}/submit`, { method: 'POST' })).listing,
  revise: async (id: string) =>
    (await apiFetch<DetailResponse>(`${base(id)}/revise`, { method: 'POST' })).listing,
  uploadImage: async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (await apiFetch<ImagesResponse>(`${base(id)}/images`, { method: 'POST', body })).images;
  },
  reorderImages: async (id: string, order: MediaOrderInput) =>
    (await apiFetch<ImagesResponse>(`${base(id)}/images/order`, { method: 'PUT', body: order }))
      .images,
  changeStatus: async (id: string, action: StatusChange) =>
    (await apiFetch<DetailResponse>(`${base(id)}/${action}`, { method: 'POST' })).listing,
  // Reviewer actions (Admin / Super Admin).
  approve: async (id: string) =>
    (await apiFetch<DetailResponse>(`${base(id)}/approve`, { method: 'POST' })).listing,
  reject: async (id: string, reason: string) =>
    (await apiFetch<DetailResponse>(`${base(id)}/reject`, { method: 'POST', body: { reason } }))
      .listing,
  setFeatured: async (id: string, input: SetFeaturedInput) =>
    (await apiFetch<DetailResponse>(`${base(id)}/featured`, { method: 'PUT', body: input }))
      .listing,
  permanentlyDelete: (id: string) => apiFetch(`${base(id)}/permanent`, { method: 'DELETE' }),
  approveRevision: async (id: string) =>
    (await apiFetch<DetailResponse>(`${base(id)}/revision/approve`, { method: 'POST' })).listing,
  rejectRevision: async (id: string, reason: string) =>
    (
      await apiFetch<DetailResponse>(`${base(id)}/revision/reject`, {
        method: 'POST',
        body: { reason },
      })
    ).listing,
  removeImage: async (id: string, mediaId: string) =>
    (
      await apiFetch<ImagesResponse>(`${base(id)}/images/${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
      })
    ).images,
};
