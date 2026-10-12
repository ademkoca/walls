import { randomUUID } from 'node:crypto';
import { expect, type Page, test as base } from '@playwright/test';
import { emailedLink } from './api-log';

export const PASSWORD = 'correct horse battery staple';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function newTestUser(): TestUser {
  const id = randomUUID();
  return { name: `Ana Anić ${id.slice(0, 4)}`, email: `${id}@example.com`, password: PASSWORD };
}

/**
 * Fails a test on any uncaught browser exception. React render errors (such as a component
 * crashing when a menu opens) surface this way even when the page still looks fine.
 */
export const test = base.extend<{ failOnPageErrors: void }>({
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await use();
      expect(errors, 'uncaught browser errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Registers through the UI and confirms the email address using the emailed link. */
export async function registerAndVerify(page: Page, user: TestUser): Promise<void> {
  await page.goto('/en/register');
  await page.getByLabel('Full name').fill(user.name);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(await emailedLink(user.email));
  await page.getByRole('button', { name: 'Confirm email address' }).click();
  await expect(page.getByText('Your email address is confirmed.')).toBeVisible();
}

export async function logIn(page: Page, user: TestUser, path = '/en/login'): Promise<void> {
  await page.goto(path);
  await page.getByLabel(/^(Email address|Email adresa)$/).fill(user.email);
  await page.getByLabel(/^(Password|Lozinka)$/).fill(user.password);
  await page.getByRole('button', { name: /^(Log in|Prijavi se)$/ }).click();
}
