import { emailedText } from '../support/api-log';
import { expect, test } from '../support/fixtures';

const INBOX = 'contact@walls.rs';
const SOCIAL = {
  Instagram: 'https://www.instagram.com/walls.rs',
  Facebook: 'https://www.facebook.com/walls.rs',
  LinkedIn: 'https://www.linkedin.com/company/walls-rs',
};

test('a visitor reads about Walls, writes through the contact form and finds the legal pages', async ({
  page,
}) => {
  await page.goto('/en');
  const footer = page.getByRole('contentinfo');

  // The footer links Walls' social profiles, which the home page names for search engines.
  const social = footer.getByRole('list', { name: 'Walls on social media' });
  for (const [name, url] of Object.entries(SOCIAL)) {
    const link = social.getByRole('link', { name: `${name} (opens in a new tab)` });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('target', '_blank');
  }
  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structuredData.map((text) => JSON.parse(text) as unknown)).toContainEqual(
    expect.objectContaining({
      '@type': 'Organization',
      name: 'Walls',
      sameAs: Object.values(SOCIAL),
    }),
  );

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
  const main = page.getByRole('main');
  for (const [name, url] of Object.entries(SOCIAL)) {
    await expect(main.getByRole('link', { name: `${name} (opens in a new tab)` })).toHaveAttribute(
      'href',
      url,
    );
  }

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

  // Legal pages are linked from every footer.
  await footer.getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible();
  await footer.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
});
