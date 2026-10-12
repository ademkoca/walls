import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

test.describe('registration and session', () => {
  test('a visitor registers, confirms their email, logs in and logs out', async ({ page }) => {
    const user = newTestUser();
    await registerAndVerify(page, user);

    await logIn(page, user);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${user.name}` })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByText(user.email)).toBeVisible();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL('/en');
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible();
    await page.goto('/en/dashboard');
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test('a wrong password is rejected with a message', async ({ page }) => {
    await logIn(page, { ...newTestUser(), password: 'definitely the wrong password' });
    await expect(page.getByText('Email address or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe('account menu', () => {
  test('opens and works in Serbian as well as English', async ({ page }) => {
    const user = newTestUser();
    await registerAndVerify(page, user);

    // Serbian is served at unprefixed URLs.
    await logIn(page, user, '/login');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Meni naloga' }).click();
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Kontrolna tabla' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Odjava' }).click();
    await expect(page).toHaveURL('/');
  });
});
