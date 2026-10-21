import { emailedText } from '../support/api-log';
import { expect, test } from '../support/fixtures';

const INBOX = 'contact@walls.rs';

test('a visitor reads about Walls, writes through the contact form and finds the legal pages', async ({
  page,
}) => {
  await page.goto('/en');
  const footer = page.getByRole('contentinfo');

  // About: the story and the three ways to use Walls.
  await footer.getByRole('link', { name: 'About' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Why we built Walls' })).toBeVisible();
  const ways = page.getByRole('region', { name: 'Three ways to use Walls' });
  await expect(ways.getByRole('link', { name: 'Browse partners' })).toHaveAttribute(
    'href',
    '/en/partners',
  );

  // Contact: no company details until the company is registered, and the form delivers to
  // the company inbox.
  await footer.getByRole('link', { name: 'Contact' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contact us' })).toBeVisible();
  await expect(page.getByRole('link', { name: INBOX })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Company details' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');

  const subject = `Question ${Date.now()}`;
  await page.getByLabel('Your name').fill('Ana Visitor');
  await page.getByLabel('Email address').fill('ana.visitor@example.com');
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Message').fill(`Can I list more than one property? (${subject})`);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thank you, Ana Visitor.')).toBeVisible();
  const email = await emailedText(INBOX, subject);
  expect(email).toContain('ana.visitor@example.com');
  expect(email).toContain('engleske verzije sajta');

  // Legal pages are linked from every footer and marked as drafts.
  await footer.getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByText('This text is a draft.')).toBeVisible();
  await footer.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
});
