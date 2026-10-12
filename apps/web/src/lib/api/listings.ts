import type { ListingDetail, ListingImage } from '@walls/shared';
import type { ListingInput, MediaOrderInput } from '@walls/validation';
import { apiFetch } from './client';

type DetailResponse = { listing: ListingDetail };
type ImagesResponse = { images: ListingImage[] };

const base = (id: string) => `/listings/${encodeURIComponent(id)}`;

/** Browser-side calls to the dashboard listing endpoints. */
export const listingsApi = {
  create: () => apiFetch<{ id: string }>('/listings', { method: 'POST' }),
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
  removeImage: async (id: string, mediaId: string) =>
    (
      await apiFetch<ImagesResponse>(`${base(id)}/images/${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
      })
    ).images,
};
