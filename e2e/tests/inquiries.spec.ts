import type { Browser, Page } from '@playwright/test';
import { approveListingViaApi, signInAsSuperAdmin, submitListingViaApi } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** Another person in their own browser context, failing on browser errors. */
async function openPage(browser: Browser): Promise<{ page: Page; errors: Error[] }> {
  const page = await (await browser.newContext()).newPage();
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return { page, errors };
}

test('a visitor sends an inquiry, the seller handles it and sees the listing statistics', async ({
  page: visitor,
  browser,
}) => {
  test.slow();
  const { page: seller, errors: sellerErrors } = await openPage(browser);
  const user = newTestUser();
  await registerAndVerify(seller, user);
  await logIn(seller, user);
  await expect(seller).toHaveURL(/\/en\/dashboard$/);
  const id = await submitListingViaApi(seller, `Stan za upit ${user.email.slice(0, 6)}`);
  const { page: admin, errors: adminErrors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  const slug = await approveListingViaApi(admin, id);

  // The visitor writes to the advertiser from the listing page; no account needed.
  await visitor.goto(`/en/properties/${slug}`);
  const form = visitor.locator('#inquiry');
  await expect(form.getByText(`Your message goes to ${user.name}.`)).toBeVisible();
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByText('This field is required.').first()).toBeVisible();
  await form.getByLabel('Your name').fill('Marija Petrović');
  await form.getByLabel('Email address').fill('marija@example.com');
  await form.getByLabel('Message').fill('Da li je stan još dostupan? Mogu da dođem u subotu.');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByText('Message sent')).toBeVisible();
  await expect(
    form.getByText(`${user.name} will reply to you at marija@example.com.`),
  ).toBeVisible();

  // The seller sees a new inquiry in the navigation and marks it as contacted.
  await seller.goto('/en/dashboard');
  const nav = seller.getByRole('navigation', { name: 'Dashboard navigation' });
  await expect(nav.getByRole('link', { name: /^Inquiries/ })).toContainText('1');
  await expect(seller.getByText('1 new inquiry')).toBeVisible();
  await nav.getByRole('link', { name: /^Inquiries/ }).click();
  await seller.getByRole('link', { name: 'Marija Petrović' }).click();
  await expect(seller.getByText('Mogu da dođem u subotu.')).toBeVisible();
  await expect(seller.getByRole('link', { name: 'marija@example.com' })).toBeVisible();
  await seller.getByRole('button', { name: 'Mark as contacted' }).click();
  await expect(seller.getByText('Status updated.')).toBeVisible();
  await expect(seller.getByText('Contacted', { exact: true })).toBeVisible();

  // The listing's statistics count the visitor's view and the inquiry.
  await seller.goto(`/en/dashboard/listings/${id}`);
  const stats = seller.getByRole('definition');
  await expect(seller.getByText('Views and inquiries')).toBeVisible();
  await expect(stats.nth(0)).toHaveText('1');
  await expect(stats.nth(1)).toHaveText('1');

  // On their own listing the seller gets a note instead of the form.
  await seller.goto(`/en/properties/${slug}`);
  await expect(
    seller.getByText('This is your listing. Inquiries about it are in your dashboard.'),
  ).toBeVisible();

  // Another private seller, signed in, sends under their account and keeps a history.
  const { page: buyer, errors: buyerErrors } = await openPage(browser);
  const buyerUser = newTestUser();
  await registerAndVerify(buyer, buyerUser);
  await logIn(buyer, buyerUser);
  await expect(buyer).toHaveURL(/\/en\/dashboard$/);
  await buyer.goto(`/en/properties/${slug}`);
  const buyerForm = buyer.locator('#inquiry');
  await expect(
    buyerForm.getByText(`Sending as ${buyerUser.name} (${buyerUser.email}).`, { exact: false }),
  ).toBeVisible();
  await expect(buyerForm.getByLabel('Your name')).toHaveCount(0);
  await buyerForm
    .getByLabel('Message')
    .fill('Prodajem i ja stan u blizini, da li biste razmenili?');
  await buyerForm.getByRole('button', { name: 'Send message' }).click();
  await expect(buyerForm.getByText('Message sent')).toBeVisible();
  await buyerForm.getByRole('link', { name: 'View sent inquiries' }).click();
  await expect(buyer.getByRole('heading', { name: 'Inquiries' })).toBeVisible();
  await expect(buyer.getByText(`To ${user.name}`)).toBeVisible();
  await expect(buyer.getByText('Prodajem i ja stan u blizini')).toBeVisible();
  expect(buyerErrors, 'uncaught browser errors (buyer)').toEqual([]);

  // Admins see platform totals on their overview.
  await admin.goto('/en/dashboard');
  await expect(admin.getByRole('heading', { name: 'Platform' })).toBeVisible();
  await expect(admin.getByText('Property views', { exact: true })).toBeVisible();

  expect(sellerErrors, 'uncaught browser errors (seller)').toEqual([]);
  expect(adminErrors, 'uncaught browser errors (admin)').toEqual([]);
});
