import { brand } from '@walls/ui/brand';
import { describe, expect, it } from 'vitest';
import { renderEmail } from './templates';

const ORIGIN = 'https://preview.walls.rs';

const inquiry = () =>
  renderEmail(
    'INQUIRY_RECEIVED',
    'sr',
    {
      displayName: 'Dragan',
      listingTitle: 'Stan <b>na</b> Vračaru',
      visitorName: 'Milica "M" <script>alert(1)</script>',
      visitorEmail: 'milica@example.com',
      visitorPhone: null,
      message: 'Zdravo,\nda li je stan dostupan?',
      link: `${ORIGIN}/dashboard/inquiries/1?a=1&b=2`,
    },
    ORIGIN,
  );

describe('email layout', () => {
  it('escapes everything a user wrote, in the body, the heading and the title', () => {
    const { html } = inquiry();
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>na</b>');
    expect(html).toContain('Milica &quot;M&quot; &lt;script&gt;');
    expect(html).toContain('Stan &lt;b&gt;na&lt;/b&gt; Vračaru');
  });

  it('quotes words someone else wrote, in italics, with the language’s quotation marks', () => {
    const { html, text } = inquiry();
    expect(text).toContain('„Zdravo,\nda li je stan dostupan?“');
    expect(html).toMatch(/<p style="[^"]*font-style:italic[^"]*">„Zdravo,<br>/);
    const rejected = renderEmail(
      'LISTING_REJECTED',
      'en',
      { displayName: 'Ana', listingTitle: 'Flat', reason: 'Add photos.', link: `${ORIGIN}/l` },
      ORIGIN,
    );
    expect(rejected.text).toContain('“Add photos.”');
    expect(rejected.html).toMatch(/font-style:italic[^>]*>“Add photos\.”<\/p>/);
  });

  it('keeps line breaks in messages and escapes links', () => {
    const { html } = inquiry();
    expect(html).toContain('Zdravo,<br>da li je stan dostupan?');
    expect(html).toContain('href="https://preview.walls.rs/dashboard/inquiries/1?a=1&amp;b=2"');
  });

  it('shows the logo from the web origin, with its size and alt text', () => {
    const { html } = inquiry();
    expect(html).toContain(`src="${ORIGIN}${brand.emailLogo.path}"`);
    expect(html).toContain(`width="${brand.emailLogo.width}" height="${brand.emailLogo.height}"`);
    expect(html).toContain(`alt="${brand.name} ${brand.descriptor}"`);
  });

  it('previews the first paragraph after the greeting, and has a footer in the email language', () => {
    const sr = renderEmail('PASSWORD_RESET', 'sr', { link: `${ORIGIN}/r` }, ORIGIN).html;
    const en = renderEmail(
      'LISTING_APPROVED',
      'en',
      {
        displayName: 'Ana',
        listingTitle: 'Flat',
        link: `${ORIGIN}/p`,
      },
      ORIGIN,
    ).html;
    expect(en).toMatch(/mso-hide:all[^>]*>[^<]*Flat/);
    expect(en).not.toMatch(/mso-hide:all[^>]*>Hello Ana,/);
    expect(en).toContain('Questions? Write to us at');
    expect(sr).toContain('Pitanja? Pišite nam na');
    expect(sr).toContain(`mailto:${brand.company.email}`);
  });

  it('adds a plain link under the button for clients that break it, and leaves the text version unchanged', () => {
    const { html, text } = renderEmail('PASSWORD_RESET', 'en', { link: `${ORIGIN}/r?t=1` }, ORIGIN);
    expect(html).toContain('If the button doesn&#39;t work, open this link:');
    expect(text).toContain(`Set a new password: ${ORIGIN}/r?t=1`);
    expect(text).not.toContain('<');
  });
});
