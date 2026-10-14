import type { Page } from '@playwright/test';
import { largePhoto, listingPhotos } from '../support/images';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** Near the Temple of Saint Sava, Vračar. */
const AT_THE_PROPERTY = { latitude: 44.798123, longitude: 20.468912 };

/** Signs up a new seller and opens a fresh draft in the editor. */
async function openNewDraft(page: Page) {
  const user = newTestUser();
  await registerAndVerify(page, user);
  await logIn(page, user);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await page.goto('/en/dashboard/listings');
  await page.getByRole('button', { name: 'New listing' }).first().click();
  await expect(page).toHaveURL(/\/en\/dashboard\/listings\/[0-9a-f-]{36}$/);
}

test.describe('with location access granted', () => {
  test.use({ geolocation: AT_THE_PROPERTY, permissions: ['geolocation'] });

  test('a private seller creates a listing, uploads images and submits it for review', async ({
    page,
  }) => {
    test.slow();
    const user = newTestUser();
    await registerAndVerify(page, user);
    await logIn(page, user);

    await page
      .getByRole('navigation', { name: 'Dashboard navigation' })
      .getByRole('link', { name: 'My listings' })
      .click();
    await expect(page.getByRole('heading', { name: 'You have no listings yet' })).toBeVisible();
    await page.getByRole('button', { name: 'New listing' }).first().click();
    await expect(page).toHaveURL(/\/en\/dashboard\/listings\/[0-9a-f-]{36}$/);

    // Basics
    await page.getByRole('combobox', { name: 'Property type *' }).click();
    await page.getByRole('option', { name: 'Apartment' }).click();
    await page.getByRole('radio', { name: 'Sale' }).check();

    // Title and description (Serbian is required)
    await page.getByLabel('Title *').fill('Trosoban stan na Vračaru');
    await page.getByLabel('Description *').fill('Svetao, renoviran stan blizu Hrama Svetog Save.');

    // Location: address fields plus a pin on the map
    await page.getByLabel('City *').fill('Beograd');
    await page.getByLabel('Municipality').fill('Vračar');
    await page.getByLabel('Street *').fill('Njegoševa');
    await page.getByLabel('Number *').fill('12a');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByText('44.798123, 20.468912')).toBeVisible();

    // Making the address public asks for confirmation; cancelling keeps it hidden.
    const addressSwitch = page.getByRole('switch', { name: 'Show the exact address publicly' });
    await addressSwitch.click();
    await expect(page.getByRole('alertdialog')).toContainText('visible to every visitor');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(addressSwitch).not.toBeChecked();

    // Details required for apartments, with a Serbian decimal comma
    await page.getByLabel('Floor area (m²) *').fill('74,5');
    await page.getByLabel('Bedrooms *').fill('2');
    await page.getByLabel('Bathrooms *').fill('1');
    await page.getByLabel('Floor *').fill('3');
    await page.getByLabel('Total floors *').fill('5');
    await page.getByRole('combobox', { name: 'Heating' }).click();
    await page.getByRole('option', { name: 'District heating (CG)' }).click();
    await page.getByRole('checkbox', { name: 'Elevator' }).click();

    // Price
    await page.getByRole('switch', { name: 'Price on request' }).click();
    await page.getByLabel('Amount *').fill('189000');

    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved.')).toBeVisible();

    // Only the images are missing now.
    const checklist = page.getByText('Before submitting, add:').locator('..').locator('..');
    await expect(checklist.getByRole('listitem')).toHaveText(['at least 3 images']);
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled();

    await page.getByLabel('Add images').setInputFiles(await listingPhotos(3));
    await expect(page.getByText('3 / 30')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Cover', { exact: true })).toHaveCount(1);
    await expect(page.getByText('This listing has everything needed for review.')).toBeVisible();

    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByText('This listing is in review and can')).toBeVisible();
    await expect(page.getByText('In review').first()).toBeVisible();
    await expect(page.getByLabel('City *')).toBeDisabled();

    await page.getByRole('link', { name: 'Back to listings' }).click();
    const row = page.getByRole('row', { name: /Trosoban stan na Vračaru/ });
    await expect(row).toContainText('In review');
    await expect(row).toContainText('Apartment · Sale · Beograd');
  });
});

test('explains when location access is blocked', async ({ page }) => {
  await openNewDraft(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText('Location access is blocked.')).toBeVisible();
});

test('offers only the features that apply to the property type', async ({ page }) => {
  await openNewDraft(page);
  await expect(page.getByText('Choose the property type first.').first()).toBeVisible();

  const propertyType = page.getByRole('combobox', { name: 'Property type *' });
  await propertyType.click();
  await page.getByRole('option', { name: 'Apartment' }).click();
  await page.getByRole('checkbox', { name: 'Elevator' }).click();
  await expect(page.getByRole('checkbox', { name: 'Electricity' })).toHaveCount(0);

  await propertyType.click();
  await page.getByRole('option', { name: 'Land' }).click();
  await expect(page.getByRole('checkbox', { name: 'Elevator' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Electricity' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Building permit' })).toBeVisible();

  // The elevator chosen for the apartment is not saved with the land listing.
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved.')).toBeVisible();
  await propertyType.click();
  await page.getByRole('option', { name: 'Apartment' }).click();
  await expect(page.getByRole('checkbox', { name: 'Elevator' })).not.toBeChecked();
});

// Netlify refuses request bodies above about 4.5 MB, so large photos are reduced in the browser.
test('a large photo is reduced in the browser before it is uploaded', async ({ page }) => {
  test.slow();
  await openNewDraft(page);
  const photo = await largePhoto();
  expect(photo.bytes, 'the fixture is a large photo').toBeGreaterThan(8 * 1024 * 1024);

  const upload = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/images'),
  );
  await page.getByLabel('Add images').setInputFiles(photo.path);
  const sentBytes = Number((await (await upload).allHeaders())['content-length']);
  expect(sentBytes, 'bytes sent to the API').toBeLessThan(4 * 1024 * 1024);

  await expect(page.getByText('1 image added.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 / 30')).toBeVisible();
});
