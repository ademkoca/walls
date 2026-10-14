import type { Browser, Page } from '@playwright/test';
import { createActiveAgent, signInAsSuperAdmin, submitListingViaApi } from '../support/accounts';
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
  await admin.getByRole('textbox', { name: 'Search agents by name or email' }).fill(other.name);
  await admin.getByRole('button', { name: 'Search agents by name or email' }).click();
  await admin
    .getByRole('listitem')
    .filter({ hasText: other.name })
    .getByRole('button', { name: 'Assign' })
    .click();
  await expect(admin.getByText('Agent assignment saved.')).toBeVisible();

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
