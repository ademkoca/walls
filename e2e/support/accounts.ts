import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { type Page, expect } from '@playwright/test';
import { API_ENV, REPO_ROOT, WEB_ORIGIN } from './environment';
import { type TestUser, logIn, newTestUser } from './fixtures';
import { listingPhotos } from './images';

const run = promisify(execFile);
const SETUP_LINK = /https?:\/\/\S+\/setup-account\?token=[A-Za-z0-9_-]+/;

/**
 * Creates a Super Admin the way an operator would (`pnpm admin:create`), completes the
 * account setup from the emailed link and logs in.
 */
export async function signInAsSuperAdmin(page: Page): Promise<TestUser> {
  const user = newTestUser();
  // A unique name: parallel runs would otherwise race for the same profile slug.
  const admin = { ...user, name: `Sanja Superadmin ${user.email.slice(0, 4)}` };
  const { stdout } = await run(
    'pnpm',
    [
      '--filter',
      '@walls/api',
      'admin:create',
      '--email',
      admin.email,
      '--name',
      admin.name,
      '--locale',
      'en',
    ],
    { cwd: REPO_ROOT, env: { ...process.env, ...API_ENV } },
  );
  const link = SETUP_LINK.exec(stdout.replaceAll('\\n', '\n'))?.[0];
  if (!link) throw new Error(`No setup link in admin:create output:\n${stdout}`);

  await page.goto(link);
  await page.getByLabel('New password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Activate account' }).click();
  await expect(page.getByText('Your account is active.')).toBeVisible();
  await logIn(page, admin);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  return admin;
}

/** Calls the API with the page's session, as the browser would (same origin, cookies). */
function api(page: Page) {
  const headers = { Origin: WEB_ORIGIN };
  return {
    post: (path: string, data?: object) =>
      page.request.post(`/api/v1${path}`, { headers, ...(data ? { data } : {}) }),
    patch: (path: string, data: object) => page.request.patch(`/api/v1${path}`, { headers, data }),
    upload: async (path: string, file: string) =>
      page.request.post(`/api/v1${path}`, {
        headers,
        multipart: {
          file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: await readFile(file) },
        },
      }),
  };
}

export const LISTING_TITLE = 'Dvosoban stan na Dorćolu';

/**
 * Creates a complete listing with three images and submits it for review, through the API
 * with the signed-in seller's session. Returns the listing id.
 */
export async function submitListingViaApi(page: Page, title = LISTING_TITLE): Promise<string> {
  const client = api(page);
  const created = await client.post('/listings');
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const saved = await client.patch(`/listings/${id}`, {
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    texts: [{ locale: 'sr', title, description: 'Svetao stan u mirnoj ulici.' }],
    location: {
      country: 'RS',
      city: 'Beograd',
      municipality: 'Stari grad',
      street: 'Dobračina',
      streetNumber: '7',
      latitude: 44.8197,
      longitude: 20.4632,
    },
    attributes: { floorArea: 58, bedrooms: 1, bathrooms: 1, floor: 2, totalFloors: 4 },
    amenityCodes: ['ELEVATOR'],
    price: { mode: 'FIXED', amount: 145000, currency: 'EUR', period: null, negotiable: false },
  });
  expect(saved.status()).toBe(200);

  for (const photo of await listingPhotos(3)) {
    expect((await client.upload(`/listings/${id}/images`, photo)).status()).toBe(201);
  }
  expect((await client.post(`/listings/${id}/submit`)).status()).toBe(200);
  return id;
}

/** An Admin approves a listing in review through the API; returns its public slug. */
export async function approveListingViaApi(admin: Page, id: string): Promise<string> {
  const response = await api(admin).post(`/listings/${id}/approve`);
  expect(response.status()).toBe(200);
  const { listing } = (await response.json()) as { listing: { slug: string } };
  return listing.slug;
}
