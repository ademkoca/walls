import type { Page } from '@playwright/test';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** Signs up a new private seller and opens their dashboard. */
async function signedInSeller(page: Page) {
  const user = newTestUser();
  await registerAndVerify(page, user);
  await logIn(page, user);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  return user;
}

/** How far the page scrolls sideways; 0 when it fits the screen. */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the dashboard menu opens the sections and logs out', async ({ page }) => {
    await signedInSeller(page);
    expect(await sidewaysOverflow(page)).toBe(0);

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Dashboard navigation' });
    await expect(menu.getByRole('link', { name: /^View site/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    await menu.getByRole('link', { name: /^Inquiries/ }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/inquiries$/);
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await menu.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/en');
  });

  test('the site menu logs out', async ({ page }) => {
    await signedInSeller(page);
    await page.goto('/en');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Main navigation' });
    await menu.getByRole('button', { name: 'Log out' }).click();
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(menu.getByRole('link', { name: 'Log in' })).toBeVisible();
  });
});

test('the header fits a tablet screen', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/en');
  expect(await sidewaysOverflow(page)).toBe(0);
});

test('a session ended in another tab sends the next dashboard click to log in', async ({
  page,
  context,
}) => {
  await signedInSeller(page);
  const other = await context.newPage();
  await other.goto('/en/dashboard');
  await other.getByRole('button', { name: 'Account menu' }).click();
  await other.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(other).toHaveURL('/en');

  await page
    .getByRole('navigation', { name: 'Dashboard navigation' })
    .getByRole('link', { name: /^Inquiries/ })
    .click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fdashboard%2Finquiries$/);
});

test('an admin page opened by a private seller is not found', async ({ page }) => {
  await signedInSeller(page);
  for (const path of ['/en/dashboard/users', '/en/dashboard/audit-log']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  }
});
