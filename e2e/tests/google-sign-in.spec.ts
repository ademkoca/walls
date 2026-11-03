import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { emailedText } from '../support/api-log';
import { expect, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** A made-up Gmail account: Google is the authority for its address (SPEC §3.1). */
function newGoogleAccount() {
  const id = randomUUID();
  return { name: `Ana Google ${id.slice(0, 4)}`, email: `${id}@gmail.com` };
}

/** Chooses the account on the API's fake Google screen (GOOGLE_SIGN_IN_FAKE=on). */
async function chooseOnGoogle(page: Page, account: { email: string; name?: string }) {
  await expect(page.getByRole('heading', { name: 'Fake Google sign-in' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  if (account.name) await page.getByLabel('Name', { exact: true }).fill(account.name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe('Continue with Google', () => {
  test('a visitor creates a private seller account with Google and signs in with it again', async ({
    page,
  }) => {
    const account = newGoogleAccount();
    await page.goto('/en/login');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, account);

    await expect(page).toHaveURL(/\/en\/continue-with-google$/);
    await expect(page.getByRole('heading', { name: 'Welcome to Walls' })).toBeVisible();
    await expect(
      page.getByText(`There's no Walls account for ${account.email} yet.`),
    ).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveValue(account.name);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${account.name}` })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/en');

    await page.goto('/en/login');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, account);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test('an agent chooses to apply, with the application started from Google', async ({ page }) => {
    const account = newGoogleAccount();
    await page.goto('/en/register');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, account);

    await page.getByRole('link', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/\/en\/for-professionals\?from=google$/);
    await expect(page.getByLabel('Email address')).toHaveValue(account.email);
    await expect(page.getByLabel('Full name')).toHaveValue(account.name);
  });

  test('an account with another provider’s address connects Google from an emailed link', async ({
    page,
  }) => {
    const user = newTestUser();
    await registerAndVerify(page, user);

    await page.goto('/en/login');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, { email: user.email });
    await expect(page).toHaveURL(/\/en\/login\?google=link-sent$/);
    await expect(page.getByText('This email address already has a Walls account.')).toBeVisible();

    const message = await emailedText(user.email, '/connect-google?token=');
    await page.goto(message.match(/https?:\/\/\S*connect-google\S*/)![0]);
    await page.getByRole('button', { name: 'Connect Google account' }).click();
    await expect(page.getByText('Your account is connected to Google.')).toBeVisible();

    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, { email: user.email });
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test('a Google-only account confirms with Google before changing its email', async ({ page }) => {
    const account = newGoogleAccount();
    await page.goto('/en/register');
    await page.getByRole('link', { name: 'Continue with Google' }).click();
    await chooseOnGoogle(page, account);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    await page.goto('/en/dashboard/profile');
    await expect(page.getByText('You sign in with Google')).toBeVisible();
    await page.getByRole('link', { name: 'Confirm with Google' }).click();
    await chooseOnGoogle(page, account);

    await expect(page).toHaveURL(/\/en\/dashboard\/profile\?google=reauthenticated$/);
    await expect(page.getByText('Confirmed. Enter your new email address')).toBeVisible();
    const newEmail = `${randomUUID()}@example.com`;
    await page.getByLabel('New email address').fill(newEmail);
    await page.getByRole('button', { name: 'Send confirmation link' }).click();
    await expect(page.getByText(`Waiting for confirmation: ${newEmail}`)).toBeVisible();
  });

  test('a cancelled Google sign-in is explained in Serbian on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Nastavite uz Google' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/login\?google=cancelled$/);
    await expect(page.getByText('Prijava preko Google-a je otkazana.')).toBeVisible();
  });
});
