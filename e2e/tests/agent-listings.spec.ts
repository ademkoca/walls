import type { Browser, Page } from '@playwright/test';
import {
  approveListingViaApi,
  createActiveAgent,
  signInAsSuperAdmin,
  submitListingViaApi,
} from '../support/accounts';
import { expect, test } from '../support/fixtures';
import { WEB_ORIGIN } from '../support/environment';

const TITLE = 'Agentov stan na Zvezdari';
const NO_ACCESS = "This listing doesn't exist or you don't have access to it.";

/** Another person in their own browser context, failing on browser errors. */
async function openPage(browser: Browser): Promise<{ page: Page; errors: Error[] }> {
  const page = await (await browser.newContext()).newPage();
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return { page, errors };
}

test('an approved agent submits a listing for the same review, and no other agent can open it', async ({
  browser,
}) => {
  test.slow();
  const { page: admin, errors: adminErrors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  const { page: agentPage, errors: agentErrors } = await openPage(browser);
  await createActiveAgent(agentPage, admin);
  const { page: otherPage, errors: otherErrors } = await openPage(browser);
  await createActiveAgent(otherPage, admin);

  // The agent creates and submits a listing; like a seller, they cannot publish it themselves.
  const id = await submitListingViaApi(agentPage, TITLE);
  await agentPage.goto('/en/dashboard/listings');
  await expect(agentPage.getByRole('row', { name: new RegExp(TITLE) })).toContainText('In review');
  const publish = await agentPage.request.post(`/api/v1/listings/${id}/approve`, {
    headers: { Origin: WEB_ORIGIN },
  });
  expect(publish.status(), 'agents cannot approve listings').toBe(403);

  // An admin reviews and publishes it, as for any listing.
  await admin.goto(`/en/dashboard/listings/${id}`);
  await expect(admin.getByText('This listing is waiting for review.')).toBeVisible();
  await admin.getByRole('button', { name: 'Approve and publish' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve and publish' }).click();
  await expect(admin.getByText('Listing published.')).toBeVisible();
  await agentPage.goto('/en/dashboard/listings');
  await expect(agentPage.getByRole('row', { name: new RegExp(TITLE) })).toContainText('Published');

  // Another agent cannot see or open it: not in their list, not in the browser, not through the API.
  await otherPage.goto('/en/dashboard/listings');
  await expect(otherPage.getByRole('link', { name: new RegExp(TITLE) })).toHaveCount(0);
  await otherPage.goto(`/en/dashboard/listings/${id}`);
  await expect(otherPage.getByText('Page not found')).toBeVisible();
  const direct = await otherPage.request.get(`/api/v1/listings/${id}`);
  expect([403, 404], 'another agent is refused by the API').toContain(direct.status());

  // The creator opens it as before.
  await agentPage.goto(`/en/dashboard/listings/${id}`);
  await expect(agentPage.getByRole('link', { name: 'Back to listings' })).toBeVisible();
  await expect(agentPage.getByText(NO_ACCESS)).toHaveCount(0);

  expect(adminErrors, 'uncaught browser errors (admin)').toEqual([]);
  expect(agentErrors, 'uncaught browser errors (agent)').toEqual([]);
  expect(otherErrors, 'uncaught browser errors (other agent)').toEqual([]);
});

test('an investor advertises a listing, and visitors contact the investor about it', async ({
  browser,
}) => {
  test.slow();
  const title = 'Novogradnja investitora u Novom Pazaru';
  const { page: admin, errors: adminErrors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  const { page: investorPage } = await openPage(browser);
  const investor = await createActiveAgent(investorPage, admin, 'INVESTOR');

  // Investors advertise their own listings, reviewed like any other.
  const id = await submitListingViaApi(investorPage, title);
  const slug = await approveListingViaApi(admin, id);

  // Visitors see the investor as the advertiser, and inquiries go to the investor.
  const { page: visitor, errors: visitorErrors } = await openPage(browser);
  await visitor.goto(`/en/properties/${slug}`);
  const advertiserCard = visitor.getByText('Advertiser', { exact: true }).locator('xpath=../..');
  await expect(advertiserCard.getByText(investor.name)).toBeVisible();
  await expect(advertiserCard.getByText('Investor', { exact: true })).toBeVisible();
  await expect(visitor.getByText('Your message goes to ' + investor.name + '.')).toBeVisible();

  expect(adminErrors, 'uncaught browser errors (admin)').toEqual([]);
  expect(visitorErrors, 'uncaught browser errors (visitor)').toEqual([]);
});
