import type { Browser, Page } from '@playwright/test';
import { approveListingViaApi, signInAsSuperAdmin, submitListingViaApi } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** A page that records every Content Security Policy violation the browser reports. */
async function recordingPage(browser: Browser): Promise<{ page: Page; violations: string[] }> {
  const context = await browser.newContext();
  const violations: string[] = [];
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (/Content Security Policy|CSP violation/.test(message.text())) {
      violations.push(`${page.url()}: ${message.text()}`);
    }
  });
  return { page, violations };
}

test('pages carry security headers and never break their own Content Security Policy', async ({
  browser,
}) => {
  test.slow();
  const seller = await recordingPage(browser);
  const user = newTestUser();
  await registerAndVerify(seller.page, user);
  await logIn(seller.page, user);
  await expect(seller.page).toHaveURL(/\/en\/dashboard$/);
  const id = await submitListingViaApi(seller.page, 'Stan za proveru zaglavlja');
  const admin = await recordingPage(browser);
  await signInAsSuperAdmin(admin.page);
  const slug = await approveListingViaApi(admin.page, id);
  const visitor = await recordingPage(browser);

  // Every page is served with the hardening headers.
  const response = await visitor.page.goto('/en');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['permissions-policy']).toContain('geolocation=(self)');

  // The public pages, including the listing with its map, gallery and inquiry form.
  for (const path of [
    '/en',
    '/en/properties',
    `/en/properties/${slug}`,
    '/en/agents',
    '/en/for-agents',
    '/en/login',
    '/sr',
  ]) {
    await visitor.page.goto(path);
    await visitor.page.waitForLoadState('networkidle');
  }
  await expect(visitor.page.locator('.leaflet-container')).toHaveCount(0); // not on /sr
  await visitor.page.goto(`/en/properties/${slug}`);
  await expect(visitor.page.locator('.leaflet-container')).toBeVisible();
  await expect(visitor.page.locator('.leaflet-tile-loaded').first()).toBeVisible({
    timeout: 20_000,
  });

  // The seller's editor (map, photos, photo viewer) and the admin's review view.
  await seller.page.goto(`/en/dashboard/listings/${id}`);
  await expect(seller.page.locator('.leaflet-container').first()).toBeVisible();
  await seller.page.getByRole('button', { name: 'View photo 1 larger' }).click();
  await expect(seller.page.getByRole('dialog').getByRole('img')).toBeVisible();
  await seller.page.keyboard.press('Escape');
  for (const path of ['/en/dashboard', '/en/dashboard/inquiries', '/en/dashboard/profile']) {
    await seller.page.goto(path);
    await seller.page.waitForLoadState('networkidle');
  }
  await admin.page.goto(`/en/dashboard/listings/${id}`);
  await admin.page.getByRole('button', { name: 'View photo 1 larger' }).click();
  await expect(admin.page.getByRole('dialog').getByRole('img')).toBeVisible();
  await admin.page.keyboard.press('Escape');
  await admin.page.goto('/en/dashboard/users');
  await admin.page.waitForLoadState('networkidle');

  expect(
    [...visitor.violations, ...seller.violations, ...admin.violations],
    'Content Security Policy violations',
  ).toEqual([]);
});
