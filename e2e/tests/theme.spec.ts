import { expect, test } from '../support/fixtures';

// Walls has a light theme only; an OS-level dark mode must not restyle components.
test('the home page looks the same with the OS in dark mode', async ({ browser }) => {
  async function ctaStyle(colorScheme: 'light' | 'dark') {
    const page = await browser.newPage({ colorScheme });
    await page.goto('/en');
    const style = await page
      .getByRole('region', { name: 'Find the walls that feel like home.' })
      .getByRole('link', { name: 'List a property' })
      .evaluate((element) => {
        const computed = getComputedStyle(element);
        return { border: computed.borderColor, background: computed.backgroundColor };
      });
    await page.close();
    return style;
  }

  const light = await ctaStyle('light');
  expect(light.border, 'outline buttons have a visible border').not.toBe('rgba(0, 0, 0, 0)');
  expect(await ctaStyle('dark')).toEqual(light);
});
