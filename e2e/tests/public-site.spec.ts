import { approveListingViaApi, signInAsSuperAdmin, submitListingViaApi } from '../support/accounts';
import { expect, logIn, newTestUser, registerAndVerify, test } from '../support/fixtures';

/** Letters only, so the code is one search word. */
function uniqueWord(): string {
  return Array.from({ length: 8 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
}

test('a visitor searches, filters, opens a listing and switches currency and language', async ({
  page: visitor,
  browser,
}) => {
  test.slow();
  const code = uniqueWord();
  const title = `Dvosoban stan ${code}`;

  // A seller's listing, published by an Admin.
  const seller = await (await browser.newContext()).newPage();
  const user = newTestUser();
  await registerAndVerify(seller, user);
  await logIn(seller, user);
  await expect(seller).toHaveURL(/\/en\/dashboard$/);
  const id = await submitListingViaApi(seller, title);
  const admin = await (await browser.newContext()).newPage();
  await signInAsSuperAdmin(admin);
  const slug = await approveListingViaApi(admin, id);

  // The home page hero leads to the listings and to registration.
  await visitor.goto('/en');
  const hero = visitor.getByRole('region', { name: 'Find your next home' });
  await expect(hero.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
    'href',
    '/en/properties',
  );
  await expect(hero.getByRole('link', { name: 'List a property' })).toHaveAttribute(
    'href',
    '/en/register',
  );

  // The home page search opens the results with the choices in the URL.
  const homeSearch = visitor.getByRole('search', { name: 'Property search' });
  await homeSearch.getByRole('button', { name: 'Buy' }).click();
  await homeSearch.getByPlaceholder('City, municipality or neighbourhood').fill('Stari grad');
  await homeSearch.getByRole('button', { name: 'Search' }).click();
  await expect(visitor).toHaveURL(/\/en\/properties\?/);
  const query = new URL(visitor.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({ transactionType: 'SALE', location: 'Stari grad' });

  // Filters narrow the results; the whole search stays in the URL.
  const filters = visitor.getByRole('complementary').getByRole('search', { name: 'Filters' });
  await filters.getByLabel('Keyword').fill(code);
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor.getByRole('heading', { name: '1 property' })).toBeVisible();
  await expect(visitor).toHaveURL(new RegExp(`q=${code}`));
  await filters.getByLabel('Minimum price').fill('150000');
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor.getByText('No properties match your search')).toBeVisible();
  await filters.getByLabel('Minimum price').fill('');
  await filters.getByRole('button', { name: 'Show results' }).click();
  await visitor.getByRole('link', { name: new RegExp(title) }).click();

  // The listing page: price, facts, and only the approximate location.
  await expect(visitor).toHaveURL(new RegExp(`/en/properties/${slug}$`));
  await expect(visitor.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(visitor.getByText('€145,000', { exact: true })).toBeVisible();
  await expect(
    visitor.getByText('The advertiser keeps the exact address private.', { exact: false }),
  ).toBeVisible();
  await expect(visitor.getByText('Dobračina')).toHaveCount(0);
  await expect(visitor.getByText(user.name, { exact: true })).toBeVisible();

  // Prices in dinars, converted at the cached rate, with the price as listed.
  await visitor.getByRole('button', { name: 'RSD', exact: true }).click();
  await expect(visitor.getByText('≈ RSD 16,994,000')).toBeVisible();
  await expect(visitor.getByText('Listed at €145,000')).toBeVisible();

  // The currency choice is remembered; the language comes from the URL.
  await visitor.getByRole('link', { name: 'sr', exact: true }).click();
  await expect(visitor).toHaveURL(new RegExp(`/properties/${slug}$`));
  await expect(visitor.getByText('Cena u oglasu: 145.000 €')).toBeVisible();

  // Search engines find the listing in the sitemap.
  const sitemap = await visitor.request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain(`/properties/${slug}</loc>`);
});
