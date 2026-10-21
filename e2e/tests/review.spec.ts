import type { Browser, Page } from '@playwright/test';
import { LISTING_TITLE, signInAsSuperAdmin, submitListingViaApi } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';
import { listingPhotos } from '../support/images';

/** A second signed-in person in their own browser context, failing on browser errors. */
async function openPage(browser: Browser): Promise<{ page: Page; errors: Error[] }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return { page, errors };
}

async function openFromQueue(admin: Page, tab: string, title: string) {
  await admin
    .getByRole('navigation', { name: 'Dashboard navigation' })
    .getByRole('link', { name: 'Listings' })
    .click();
  await admin.getByRole('link', { name: tab }).click();
  await admin
    .getByRole('row', { name: new RegExp(title) })
    .getByRole('link')
    .first()
    .click();
  await expect(admin.getByRole('heading', { name: title })).toBeVisible();
}

test('an admin rejects a listing, the seller resubmits, and the admin publishes it and its later edits', async ({
  page: seller,
  browser,
}) => {
  test.slow();
  const user = newTestUser();
  await registerAndVerify(seller, user);
  await logIn(seller, user);
  await expect(seller).toHaveURL(/\/en\/dashboard$/);
  const id = await submitListingViaApi(seller);

  const { page: admin, errors } = await openPage(browser);
  await signInAsSuperAdmin(admin);

  // Reject with a reason.
  await openFromQueue(admin, 'In review', LISTING_TITLE);
  await expect(admin.getByText('This listing is waiting for review.')).toBeVisible();

  // The form is read-only for a reviewer, but its language tabs still work.
  await admin.getByRole('tab', { name: 'English (optional)' }).click();
  await expect(admin.getByRole('tab', { name: 'English (optional)' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(admin.locator('#texts-en-title')).toBeVisible();
  await expect(admin.locator('#texts-en-title')).toBeDisabled();

  // Reviewers can open the photos at full size.
  await admin.getByRole('button', { name: 'View photo 1 larger' }).click();
  await expect(admin.getByRole('dialog').getByText('Photo 1 of 3')).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(admin.getByRole('dialog')).toBeHidden();

  // The agent search needs something to search for: not empty, not only spaces or symbols.
  const agentSearch = admin.getByRole('textbox', {
    name: 'Search agents and agencies by name or email',
  });
  const searchButton = admin.getByRole('button', {
    name: 'Search agents and agencies by name or email',
  });
  await expect(searchButton).toBeDisabled();
  await agentSearch.fill('  -_. ');
  await expect(searchButton).toBeDisabled();
  await agentSearch.fill('Ana');
  await expect(searchButton).toBeEnabled();
  await agentSearch.fill('');
  await admin.getByRole('button', { name: 'Reject', exact: true }).click();
  const rejectDialog = admin.getByRole('alertdialog');
  await rejectDialog.getByRole('button', { name: 'Reject' }).click();
  await expect(rejectDialog.getByText('This field is required.')).toBeVisible();
  await rejectDialog.getByLabel('Reason').fill('Fotografije su mutne.');
  await rejectDialog.getByRole('button', { name: 'Reject' }).click();
  await expect(admin.getByText('Listing rejected.')).toBeVisible();

  // The seller sees the reason, revises and resubmits.
  await seller.goto(`/en/dashboard/listings/${id}`);
  await expect(seller.getByText('Fotografije su mutne.')).toBeVisible();
  await seller.getByRole('button', { name: 'Edit and resubmit' }).click();
  await expect(seller.getByText('The listing is a draft again.')).toBeVisible();
  // Replacing a photo is the whole fix: image changes are saved on their own.
  await seller.getByLabel('Add images').setInputFiles(await listingPhotos(1));
  await expect(seller.getByText('1 image added.')).toBeVisible();
  await seller.getByRole('button', { name: 'Remove image' }).first().click();
  await expect(seller.getByText('Image removed.')).toBeVisible();
  await expect(seller.getByText('3 / 30')).toBeVisible();
  await expect(seller.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  await seller.getByRole('button', { name: 'Submit for review' }).click();
  await seller.getByRole('alertdialog').getByRole('button', { name: 'Submit for review' }).click();
  await expect(seller.getByText('Listing submitted for review.')).toBeVisible();

  // The admin approves it.
  await openFromQueue(admin, 'In review', LISTING_TITLE);
  await admin.getByRole('button', { name: 'Approve and publish' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve and publish' }).click();
  await expect(admin.getByText('Listing published.')).toBeVisible();
  await expect(admin.getByText('dvosoban-stan-na-dorcolu-beograd')).toBeVisible();

  // The seller changes the title of the published listing: that goes to review.
  await seller.reload();
  await expect(seller.getByText('This listing is published.')).toBeVisible();
  await seller.getByLabel('Title *').fill('Dvosoban stan na Dorćolu, renoviran');
  await seller.getByRole('button', { name: 'Save changes' }).click();
  await expect(seller.getByText('Saved. Your changes were sent for review.')).toBeVisible();
  await expect(seller.getByText('Changes are waiting for review.')).toBeVisible();

  // The admin reviews and approves the changes.
  await openFromQueue(admin, 'Edits to review', LISTING_TITLE);
  await expect(admin.getByText('Changes to review', { exact: true })).toBeVisible();
  await expect(
    admin.getByRole('listitem').filter({ hasText: 'Title and description' }),
  ).toBeVisible();
  await admin.getByRole('button', { name: 'Approve changes' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Approve changes' }).click();
  await expect(admin.getByText('Changes published.')).toBeVisible();
  await expect(
    admin.getByRole('heading', { name: 'Dvosoban stan na Dorćolu, renoviran' }),
  ).toBeVisible();

  expect(errors, 'uncaught browser errors (admin)').toEqual([]);
});

test('an admin deactivates a seller with a reason, which blocks their login', async ({
  page: seller,
  browser,
}) => {
  test.slow();
  const user = newTestUser();
  await registerAndVerify(seller, user);

  const { page: admin, errors } = await openPage(browser);
  await signInAsSuperAdmin(admin);
  await admin
    .getByRole('navigation', { name: 'Dashboard navigation' })
    .getByRole('link', { name: 'Users' })
    .click();
  await admin
    .getByRole('searchbox')
    .or(admin.getByLabel('Search by name or email'))
    .fill(user.email);
  await admin.getByRole('button', { name: 'Show' }).click();
  await admin.getByRole('link', { name: user.name }).click();

  await admin.getByRole('button', { name: 'Deactivate account' }).click();
  const dialog = admin.getByRole('alertdialog');
  await dialog.getByLabel('Reason').fill('Lažni podaci u oglasima.');
  await dialog.getByRole('button', { name: 'Deactivate account' }).click();
  await expect(admin.getByText('Account deactivated.')).toBeVisible();
  await expect(admin.getByText('Deactivated', { exact: true }).first()).toBeVisible();
  await expect(admin.getByRole('cell', { name: 'Lažni podaci u oglasima.' })).toBeVisible();

  await logIn(seller, user);
  await expect(seller.getByText('This account has been deactivated.')).toBeVisible();
  expect(errors, 'uncaught browser errors (admin)').toEqual([]);
});
