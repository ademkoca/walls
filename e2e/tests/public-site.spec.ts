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

  // The home page plan leads to registration, and its rooms are shortcuts into the search.
  await visitor.goto('/en');
  // Built like production: the demo site's banner (NEXT_PUBLIC_DEMO_SITE) is not shown.
  await expect(visitor.getByText(/demo site/i)).toHaveCount(0);
  const hero = visitor.getByRole('region', { name: "You know what you're getting." });
  await expect(hero.getByRole('link', { name: 'List a property' })).toHaveAttribute(
    'href',
    '/en/register',
  );
  const rooms = hero.getByRole('navigation', { name: 'Browse by property type' });
  await expect(rooms.getByRole('link', { name: /^Apartment/ })).toHaveAttribute(
    'href',
    '/en/properties?propertyType=APARTMENT',
  );
  await expect(rooms.getByRole('link', { name: /^Garage/ })).toHaveAttribute(
    'href',
    '/en/properties?propertyType=GARAGE',
  );
  // Choosing a type in the hallway search lights up its room.
  await hero.getByRole('combobox', { name: 'Property type' }).click();
  await visitor.getByRole('option', { name: 'Apartment', exact: true }).click();
  await expect(rooms.getByRole('link', { name: /^Apartment/ })).toHaveAttribute(
    'data-selected',
    'true',
  );

  const popular = visitor.getByRole('region', { name: 'Popular searches' });
  await expect(popular.getByRole('link', { name: 'Houses for rent', exact: true })).toHaveAttribute(
    'href',
    '/en/properties?propertyType=HOUSE&transactionType=RENT',
  );
  // City links search by the city as listings store it, in Serbian, on English pages too.
  await expect(
    popular.getByRole('link', { name: 'Apartments for sale in Belgrade' }),
  ).toHaveAttribute(
    'href',
    '/en/properties?propertyType=APARTMENT&transactionType=SALE&location=Beograd',
  );

  // City tiles are another shortcut into the search, by the Serbian city name.
  const byCity = visitor.getByRole('region', { name: 'Browse by city' });
  await expect(byCity.getByRole('link', { name: 'Belgrade' })).toHaveAttribute(
    'href',
    '/en/properties?location=Beograd',
  );

  // Platform totals on the plan's dimension line, and the call to professionals.
  await expect(visitor.getByText(/^\d+ published listings?( · |$)/)).toBeVisible();
  const agentBanner = visitor.getByRole('region', { name: 'An agent, agency or investor?' });
  await expect(
    agentBanner.getByRole('link', { name: 'Apply for a professional account' }),
  ).toHaveAttribute('href', '/en/for-professionals');

  // The seller journey and an FAQ answer, further down the home page.
  const howItWorks = visitor.getByRole('region', { name: 'How it works' });
  await expect(howItWorks.getByRole('heading', { name: 'Add your listing' })).toBeVisible();
  const faq = visitor.getByRole('region', { name: 'Frequently asked questions' });
  const firstQuestion = faq.getByRole('button', { name: /free to list a property/ });
  await expect(faq.getByText('Yes. Creating an account')).toBeHidden();
  await firstQuestion.click();
  await expect(faq.getByText('Yes. Creating an account')).toBeVisible();

  // The home page search opens the results with the choices in the URL, including the type
  // chosen above, whose room is lit.
  const homeSearch = visitor.getByRole('search', { name: 'Property search' });
  await homeSearch.getByRole('button', { name: 'Buy' }).click();
  await homeSearch.getByPlaceholder('City, municipality or neighbourhood').fill('Stari grad');
  await homeSearch.getByRole('button', { name: 'Search' }).click();
  await expect(visitor).toHaveURL(/\/en\/properties\?/);
  const query = new URL(visitor.url()).searchParams;
  expect(Object.fromEntries(query)).toEqual({
    transactionType: 'SALE',
    location: 'Stari grad',
    propertyType: 'APARTMENT',
  });

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
  // Wait for the new results, or the re-render can close the dropdown opened below.
  await expect(visitor.getByRole('heading', { name: '1 property' })).toBeVisible();

  // Furnishing matches exactly, and this listing doesn't state it.
  const furnishing = filters.getByRole('combobox', { name: 'Furnishing' });
  await furnishing.click();
  await visitor.getByRole('option', { name: 'Furnished', exact: true }).click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor).toHaveURL(/furnishedStatus=FURNISHED/);
  await expect(visitor.getByText('No properties match your search')).toBeVisible();
  await furnishing.click();
  await visitor.getByRole('option', { name: 'Any' }).click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor.getByRole('heading', { name: '1 property' })).toBeVisible();

  // Only negotiable prices: this listing's price is fixed.
  const negotiable = filters.getByRole('checkbox', { name: 'Negotiable prices only' });
  await negotiable.click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor).toHaveURL(/negotiable=true/);
  await expect(visitor.getByText('No properties match your search')).toBeVisible();
  await negotiable.click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor.getByRole('heading', { name: '1 property' })).toBeVisible();

  // The advertiser filter: a private seller's listing is not an agency's.
  const advertiser = filters.getByRole('combobox', { name: 'Advertiser' });
  await advertiser.click();
  await visitor.getByRole('option', { name: 'Agency', exact: true }).click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor).toHaveURL(/sellerType=AGENCY/);
  await expect(visitor.getByText('No properties match your search')).toBeVisible();
  await advertiser.click();
  await visitor.getByRole('option', { name: 'Private seller', exact: true }).click();
  await filters.getByRole('button', { name: 'Show results' }).click();
  await expect(visitor.getByRole('heading', { name: '1 property' })).toBeVisible();
  // The card names the kind of advertiser.
  const card = visitor.getByRole('article').filter({ hasText: title });
  await expect(card.getByText('Private seller', { exact: true })).toBeVisible();
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

  // Link previews show the listing's own photo, not the logo card.
  const listingImage = visitor.locator('meta[property="og:image"]');
  await expect(listingImage).toHaveCount(1);
  await expect(listingImage).not.toHaveAttribute('content', /opengraph-image/);
  await expect(visitor.locator('meta[property="og:site_name"]')).toHaveAttribute(
    'content',
    'Walls',
  );
  await expect(visitor.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    new RegExp(`/en/properties/${slug}$`),
  );

  // The seller has no profile picture, so their profile's preview is the logo card.
  const profilePath = await visitor
    .getByRole('link', { name: 'View profile' })
    .first()
    .getAttribute('href');
  const profile = await (await browser.newContext()).newPage();
  await profile.goto(profilePath!);
  await expect(profile.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/opengraph-image\.png$/,
  );
  await expect(profile.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );

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

test('link previews show the logo card on pages without an image of their own', async ({
  page,
}) => {
  for (const path of ['/', '/en', '/en/about']) {
    await page.goto(path);
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveAttribute('content', /^https?:\/\/.+\/opengraph-image\.png$/);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      path === '/' ? 'Logo Walls Real Estate' : 'Walls Real Estate logo',
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
  }
  const response = await page.request.get('/opengraph-image.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});
