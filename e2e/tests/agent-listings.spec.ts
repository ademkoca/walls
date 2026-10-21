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

test('an approved agent submits a listing for the same review, a second agent cannot open it until an admin assigns it', async ({
  browser,
}) => {
  test.slow();
  const { page: admin, errors: adminErrors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  const { page: agentPage, errors: agentErrors } = await openPage(browser);
  await createActiveAgent(agentPage, admin);
  const { page: otherPage, errors: otherErrors } = await openPage(browser);
  const other = await createActiveAgent(otherPage, admin);

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

  // The admin assigns the listing to the other agent, who can then open it.
  await admin.goto(`/en/dashboard/listings/${id}`);
  await admin
    .getByRole('textbox', { name: 'Search agents and agencies by name or email' })
    .fill(other.name);
  await admin.getByRole('button', { name: 'Search agents and agencies by name or email' }).click();
  await admin
    .getByRole('listitem')
    .filter({ hasText: other.name })
    .getByRole('button', { name: 'Assign' })
    .click();
  await expect(admin.getByText('Assignment saved.')).toBeVisible();

  await otherPage.goto('/en/dashboard/listings');
  await expect(otherPage.getByRole('row', { name: new RegExp(TITLE) })).toBeVisible();
  await otherPage.goto(`/en/dashboard/listings/${id}`);
  await expect(otherPage.getByRole('link', { name: 'Back to listings' })).toBeVisible();
  await expect(otherPage.getByText(NO_ACCESS)).toHaveCount(0);

  // The creator keeps their access.
  await agentPage.goto(`/en/dashboard/listings/${id}`);
  await expect(agentPage.getByRole('link', { name: 'Back to listings' })).toBeVisible();

  expect(adminErrors, 'uncaught browser errors (admin)').toEqual([]);
  expect(agentErrors, 'uncaught browser errors (agent)').toEqual([]);
  expect(otherErrors, 'uncaught browser errors (other agent)').toEqual([]);
});

test('an investor advertises a listing, and an admin can assign an agency but not an investor', async ({
  browser,
}) => {
  test.slow();
  const title = 'Novogradnja investitora u Novom Pazaru';
  const { page: admin, errors: adminErrors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  const { page: investorPage } = await openPage(browser);
  const investor = await createActiveAgent(investorPage, admin, 'INVESTOR');
  const { page: agencyPage } = await openPage(browser);
  const agency = await createActiveAgent(agencyPage, admin, 'AGENCY');

  // Investors advertise their own listings, reviewed like any other.
  const id = await submitListingViaApi(investorPage, title);
  const slug = await approveListingViaApi(admin, id);

  // The assignment search offers agencies, never investors.
  await admin.goto(`/en/dashboard/listings/${id}`);
  const search = admin.getByRole('textbox', {
    name: 'Search agents and agencies by name or email',
  });
  const searchButton = admin.getByRole('button', {
    name: 'Search agents and agencies by name or email',
  });
  await search.fill(investor.name);
  await searchButton.click();
  await expect(admin.getByText('No active agents or agencies match.')).toBeVisible();
  await search.fill(agency.name);
  await searchButton.click();
  const candidate = admin.getByRole('listitem').filter({ hasText: agency.name });
  await expect(candidate.getByText('Agency', { exact: true })).toBeVisible();
  await candidate.getByRole('button', { name: 'Assign' }).click();
  await expect(admin.getByText('Assignment saved.')).toBeVisible();

  // Visitors see the investor as the advertiser and the agency handling the listing.
  const { page: visitor, errors: visitorErrors } = await openPage(browser);
  await visitor.goto(`/en/properties/${slug}`);
  const advertiserCard = visitor.getByText('Advertiser', { exact: true }).locator('xpath=../..');
  await expect(advertiserCard.getByText(investor.name)).toBeVisible();
  await expect(advertiserCard.getByText('Investor', { exact: true })).toBeVisible();
  const agencyCard = visitor
    .getByText('Agency for this property', { exact: true })
    .locator('xpath=../..');
  await expect(agencyCard.getByText(agency.name)).toBeVisible();
  await expect(agencyCard.getByText('Agency', { exact: true })).toBeVisible();
  await expect(visitor.getByText('Your message goes to ' + agency.name + '.')).toBeVisible();

  expect(adminErrors, 'uncaught browser errors (admin)').toEqual([]);
  expect(visitorErrors, 'uncaught browser errors (visitor)').toEqual([]);
});
