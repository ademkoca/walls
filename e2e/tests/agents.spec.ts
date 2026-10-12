import type { Browser, Page } from '@playwright/test';
import { emailedLink } from '../support/api-log';
import { signInAsSuperAdmin } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

const PROOF_PDF = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n');
const PHONE = '+381 64 123 4567';

/** A second person in their own browser context, failing on browser errors. */
async function openPage(browser: Browser): Promise<{ page: Page; errors: Error[] }> {
  const page = await (await browser.newContext()).newPage();
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return { page, errors };
}

async function openFromDashboard(admin: Page, section: string, name: string) {
  await admin
    .getByRole('navigation', { name: 'Dashboard navigation' })
    .getByRole('link', { name: new RegExp(`^${section}`) })
    .click();
  await expect(admin.getByRole('heading', { level: 1, name: section })).toBeVisible();
  await admin.getByRole('main').getByRole('link', { name }).click();
  await expect(admin.getByRole('heading', { name })).toBeVisible();
}

/** The agent's or seller's public page, via the profile page's "View public profile" link. */
async function publicProfileUrl(page: Page): Promise<string> {
  const href = await page.getByRole('link', { name: 'View public profile' }).getAttribute('href');
  expect(href).toBeTruthy();
  return href!;
}

test('an agent applies, is approved, activates the account and gets profile changes approved', async ({
  page: applicant,
  browser,
}) => {
  test.slow();
  const agent = { ...newTestUser(), name: `Marko Agent ${Date.now().toString(36)}` };

  // The separate "For agents" application with private proof.
  await applicant.goto('/en/for-agents');
  await applicant.getByLabel('Full name').fill(agent.name);
  await applicant.getByLabel('Email address').fill(agent.email);
  await applicant.getByLabel('Phone number', { exact: true }).fill(PHONE);
  await applicant.getByLabel('Agency (optional)').fill('Kvadrat nekretnine');
  await applicant.getByRole('button', { name: 'Send application' }).click();
  await expect(applicant.getByText('Add at least one file.')).toBeVisible();
  await applicant
    .getByLabel('Proof')
    .setInputFiles({ name: 'licenca.pdf', mimeType: 'application/pdf', buffer: PROOF_PDF });
  await expect(applicant.getByText('licenca.pdf')).toBeVisible();
  await applicant.getByRole('button', { name: 'Send application' }).click();
  await expect(applicant.getByRole('heading', { name: 'Thank you for applying' })).toBeVisible();

  // An admin checks the proof and approves the application.
  const { page: admin, errors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  await openFromDashboard(admin, 'Agent applications', agent.name);
  await expect(admin.getByRole('link', { name: 'Open licenca.pdf' })).toBeVisible();
  const proof = await admin.request.get(
    (await admin.getByRole('link', { name: 'Open licenca.pdf' }).getAttribute('href'))!,
  );
  expect(proof.headers()['content-type']).toBe('application/pdf');
  await admin.getByRole('button', { name: 'Approve agent' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve agent' }).click();
  await expect(admin.getByText('Application approved.')).toBeVisible();

  // The proof stays available from the new agent's account page.
  await admin.getByRole('link', { name: agent.name }).click();
  await expect(admin.getByText('Agent application', { exact: true })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Open licenca.pdf' })).toBeVisible();

  // The applicant activates the agent account from the emailed link.
  await applicant.goto(await emailedLink(agent.email));
  await applicant.getByLabel('New password', { exact: true }).fill(agent.password);
  await applicant.getByRole('button', { name: 'Activate account' }).click();
  await expect(applicant.getByText('Your account is active.')).toBeVisible();
  await logIn(applicant, agent);
  await expect(applicant).toHaveURL(/\/en\/dashboard$/);

  // Profile changes wait for approval; the public profile stays as it was.
  await applicant
    .getByRole('navigation', { name: 'Dashboard navigation' })
    .getByRole('link', { name: 'My profile' })
    .click();
  await expect(applicant.getByText("Agents' phone numbers are always shown")).toBeVisible();
  await applicant.getByLabel('About you').fill('Prodajem stanove na Dorćolu već deset godina.');
  await applicant.getByRole('button', { name: 'Send changes for review' }).click();
  await expect(applicant.getByText('Your changes were sent for review.')).toBeVisible();
  await expect(applicant.getByText('Your changes are waiting for review.')).toBeVisible();
  const profileUrl = await publicProfileUrl(applicant);

  await openFromDashboard(admin, 'Profile changes', agent.name);
  await expect(admin.getByRole('cell', { name: /deset godina/ })).toBeVisible();
  await admin.getByRole('button', { name: 'Approve changes' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve changes' }).click();
  await expect(admin.getByText('Profile changes approved.')).toBeVisible();

  // A visitor sees the approved agent, the bio and the phone with its status.
  const { page: visitor, errors: visitorErrors } = await openPage(browser);
  await visitor.goto(profileUrl);
  await expect(visitor.getByRole('heading', { name: agent.name })).toBeVisible();
  await expect(visitor.getByText('Approved agent')).toBeVisible();
  await expect(visitor.getByText('Prodajem stanove na Dorćolu već deset godina.')).toBeVisible();
  await expect(visitor.getByRole('link', { name: PHONE })).toBeVisible();
  await expect(visitor.getByText('Not verified')).toBeVisible();
  await expect(visitor.getByText(agent.email)).toHaveCount(0);

  expect(errors, 'uncaught browser errors (admin)').toEqual([]);
  expect(visitorErrors, 'uncaught browser errors (visitor)').toEqual([]);
});

test('a private seller edits their profile, which is public immediately', async ({
  page: seller,
  browser,
}) => {
  const user = newTestUser();
  await registerAndVerify(seller, user);
  await logIn(seller, user);
  await expect(seller).toHaveURL(/\/en\/dashboard$/);
  await seller.goto('/en/dashboard/profile');

  await seller.getByLabel('Phone number', { exact: true }).fill(PHONE);
  await seller.getByRole('switch', { name: 'Show my phone number on my profile' }).click();
  await seller.getByLabel('About you').fill('Prodajem porodični stan.');
  await seller.getByRole('button', { name: 'Save profile' }).click();
  await expect(seller.getByText('Profile saved.')).toBeVisible();

  const { page: visitor, errors } = await openPage(browser);
  await visitor.goto(await publicProfileUrl(seller));
  await expect(visitor.getByRole('heading', { name: user.name })).toBeVisible();
  await expect(visitor.getByText('Private seller')).toBeVisible();
  await expect(visitor.getByText('Prodajem porodični stan.')).toBeVisible();
  await expect(visitor.getByRole('link', { name: PHONE })).toBeVisible();
  await expect(visitor.getByText('Not verified')).toBeVisible();
  await expect(visitor.getByText('No published listings at the moment.')).toBeVisible();
  expect(errors, 'uncaught browser errors (visitor)').toEqual([]);
});
