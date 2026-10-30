import type { Browser, Page } from '@playwright/test';
import { emailedLink } from '../support/api-log';
import { signInAsSuperAdmin } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';
import { largePhoto } from '../support/images';

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

  // The separate "For professionals" application with private proof.
  await applicant.goto('/en/for-professionals');
  await applicant.getByRole('button', { name: 'Send application' }).click();
  await expect(applicant.getByLabel('Agency (optional)')).toHaveCount(0);
  await applicant.getByRole('radio', { name: /^Agent/ }).check();
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
  await openFromDashboard(admin, 'Professional applications', agent.name);
  await expect(admin.getByRole('link', { name: 'Open licenca.pdf' })).toBeVisible();
  const proof = await admin.request.get(
    (await admin.getByRole('link', { name: 'Open licenca.pdf' }).getAttribute('href'))!,
  );
  expect(proof.headers()['content-type']).toBe('application/pdf');
  await admin.getByRole('button', { name: 'Approve application' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve application' }).click();
  await expect(admin.getByText('Application approved.')).toBeVisible();

  // The proof stays available from the new agent's account page.
  await admin.getByRole('link', { name: agent.name }).click();
  await expect(admin.getByText('Account application', { exact: true })).toBeVisible();
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
  await expect(applicant.getByText('Your phone number is always shown')).toBeVisible();
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

  // A visitor sees the agent badge (no "approved" label), the bio and the phone.
  const { page: visitor, errors: visitorErrors } = await openPage(browser);
  await visitor.goto(profileUrl);
  await expect(visitor.getByRole('heading', { name: agent.name })).toBeVisible();
  await expect(visitor.getByRole('main').getByText('Agent', { exact: true })).toBeVisible();
  await expect(visitor.getByText('Approved agent')).toHaveCount(0);
  await expect(visitor.getByText('Kvadrat nekretnine')).toBeVisible();
  await expect(visitor.getByText('Prodajem stanove na Dorćolu već deset godina.')).toBeVisible();
  await expect(visitor.getByRole('link', { name: PHONE })).toBeVisible();
  // No phone verification before launch: unverified numbers carry no label (SPEC §3).
  await expect(visitor.getByText(/^(Not verified|Verified)$/)).toHaveCount(0);
  await expect(visitor.getByText(agent.email)).toHaveCount(0);

  expect(errors, 'uncaught browser errors (admin)').toEqual([]);
  expect(visitorErrors, 'uncaught browser errors (visitor)').toEqual([]);
});

test('an agency applies with its own name, and visitors find it among the partners', async ({
  page: applicant,
  browser,
}) => {
  test.slow();
  const agency = { ...newTestUser(), name: `Agencija Pazar ${Date.now().toString(36)}` };

  await applicant.goto('/en/for-professionals');
  await applicant.getByRole('radio', { name: /^Agency/ }).check();
  // An agency is named by its own name; the "agency you work for" field is for agents only.
  await expect(applicant.getByLabel('Agency (optional)')).toHaveCount(0);
  await expect(
    applicant.getByText('For example an extract from the Business Registers'),
  ).toBeVisible();
  await applicant.getByLabel('Agency name').fill(agency.name);
  await applicant.getByLabel('Email address').fill(agency.email);
  await applicant.getByLabel('Phone number', { exact: true }).fill(PHONE);
  await applicant
    .getByLabel('Proof')
    .setInputFiles({ name: 'apr-izvod.pdf', mimeType: 'application/pdf', buffer: PROOF_PDF });
  await applicant.getByRole('button', { name: 'Send application' }).click();
  await expect(applicant.getByRole('heading', { name: 'Thank you for applying' })).toBeVisible();

  // The admin sees the kind of account applied for before approving.
  const { page: admin, errors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  await openFromDashboard(admin, 'Professional applications', agency.name);
  await expect(admin.getByRole('main').getByText('Agency', { exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Approve application' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve application' }).click();
  await expect(admin.getByText('Application approved.')).toBeVisible();

  await applicant.goto(await emailedLink(agency.email));
  await applicant.getByLabel('New password', { exact: true }).fill(agency.password);
  await applicant.getByRole('button', { name: 'Activate account' }).click();
  await expect(applicant.getByText('Your account is active.')).toBeVisible();
  await logIn(applicant, agency);
  await expect(applicant.getByText("You're signed in as an agency.")).toBeVisible();
  await applicant.goto('/en/dashboard/profile');
  const profileUrl = await publicProfileUrl(applicant);
  expect(profileUrl).toMatch(/^\/en\/partners\//);

  // Visitors find it on the Agencies tab, not on the Investors tab, with an "Agency" badge.
  const { page: visitor, errors: visitorErrors } = await openPage(browser);
  await visitor.goto('/en/partners');
  await visitor.getByRole('link', { name: 'Agencies', exact: true }).click();
  await expect(visitor).toHaveURL(/\/en\/partners\?type=AGENCY$/);
  await expect(visitor.getByRole('link', { name: new RegExp(agency.name) })).toBeVisible();
  await visitor.getByRole('link', { name: 'Investors', exact: true }).click();
  await expect(visitor.getByRole('link', { name: new RegExp(agency.name) })).toHaveCount(0);

  // Old agent profile links lead to the same page.
  const slug = profileUrl.split('/').at(-1)!;
  await visitor.goto(`/en/agents/${slug}`);
  await expect(visitor).toHaveURL(profileUrl);
  await expect(visitor.getByRole('heading', { name: agency.name })).toBeVisible();
  await expect(visitor.getByRole('main').getByText('Agency', { exact: true })).toBeVisible();
  await expect(visitor.getByText(/Approved|Verified agent/)).toHaveCount(0);

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
  // No phone verification before launch: unverified numbers carry no label (SPEC §3).
  await expect(visitor.getByText(/^(Not verified|Verified)$/)).toHaveCount(0);
  await expect(visitor.getByText('No published listings at the moment.')).toBeVisible();
  expect(errors, 'uncaught browser errors (visitor)').toEqual([]);
});

test('an application with a large photo as proof is reduced and accepted, a large PDF is refused', async ({
  page,
}) => {
  test.slow();
  await page.goto('/en/for-professionals');
  const user = newTestUser();
  await page.getByRole('radio', { name: /^Investor/ }).check();
  await page.getByLabel('Name or company name').fill(user.name);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Phone number', { exact: true }).fill(PHONE);

  // A PDF cannot be reduced: over the limit, it is refused right away.
  const bigPdf = Buffer.concat([PROOF_PDF, Buffer.alloc(10 * 1024 * 1024)]);
  await page
    .getByLabel('Proof')
    .setInputFiles({ name: 'veliki-sken.pdf', mimeType: 'application/pdf', buffer: bigPdf });
  await expect(page.getByText('veliki-sken.pdf is larger than 10 MB.')).toBeVisible();

  // A photo above the per-file limit is reduced on sending.
  const photo = await largePhoto();
  await page.getByLabel('Proof').setInputFiles(photo.path);
  await expect(page.getByText(/large-[0-9a-f]{8}\.jpg/)).toBeVisible();
  const upload = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/agent-applications'),
  );
  await page.getByRole('button', { name: 'Send application' }).click();
  const sentBytes = Number((await (await upload).allHeaders())['content-length']);
  expect(sentBytes, 'bytes sent to the API').toBeLessThan(10 * 1024 * 1024);
  await expect(page.getByRole('heading', { name: 'Thank you for applying' })).toBeVisible();
});
