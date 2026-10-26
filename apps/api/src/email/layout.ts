import type { Locale } from '@walls/shared';
import { brand } from '@walls/ui/brand';

/**
 * The HTML frame shared by every email: ink header with the logo, a green rule, the message
 * on a white card, and a footer. Built for email clients rather than browsers: nested tables,
 * inline styles, no web fonts or SVG (Gmail and Outlook drop them), a button that keeps its
 * padding in Outlook, and a light-only color scheme so Apple Mail does not invert it.
 */

const COLOR = brand.colors;
const FONT = 'Arial, Helvetica, sans-serif';
/** The site's headings are a heavy grotesk; Helvetica and Arial are what every client has. */
const HEADING_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const CONTENT_WIDTH = 600;

const CHROME: Record<
  Locale,
  { tagline: string; questions: string; buttonFallback: string; logoAlt: string }
> = {
  sr: {
    tagline:
      'Pronađite stanove, kuće, poslovne prostore i placeve za prodaju i izdavanje širom Srbije.',
    questions: 'Pitanja? Pišite nam na',
    buttonFallback: 'Ako dugme ne radi, otvorite ovu adresu:',
    logoAlt: `${brand.name} ${brand.descriptor}`,
  },
  en: {
    tagline: 'Find apartments, houses, commercial spaces and land for sale and rent across Serbia.',
    questions: 'Questions? Write to us at',
    buttonFallback: "If the button doesn't work, open this link:",
    logoAlt: `${brand.name} ${brand.descriptor}`,
  },
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** Escapes text and keeps its line breaks (Outlook ignores `white-space: pre-line`). */
const textToHtml = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');

/**
 * Inbox preview text. Without it, clients preview the logo's alt text and the greeting; this
 * uses the first paragraph after a greeting ("Hello Ana,") instead.
 */
function previewText(paragraphs: string[]): string {
  const [first = '', second] = paragraphs;
  return second !== undefined && first.trimEnd().endsWith(',') ? second : first;
}

/** Fills the rest of the preview so clients don't pull body text into it. */
const PREVIEW_FILLER = '&#8199;&#65279;&#847; '.repeat(60);

export interface EmailLayoutInput {
  locale: Locale;
  /** Shown as the heading and the document title. */
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** The web app's origin, which serves the logo and is linked from it. */
  webOrigin: string;
}

function button(action: { label: string; url: string }): string {
  const url = escapeHtml(action.url);
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:8px 0 0">
<tr><td bgcolor="${COLOR.green}" style="background:${COLOR.green};mso-padding-alt:14px 28px">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:bold;line-height:20px;color:${COLOR.paper};text-decoration:none">${escapeHtml(action.label)}</a>
</td></tr></table>`;
}

export function renderEmailLayout({
  locale,
  title,
  paragraphs,
  action,
  webOrigin,
}: EmailLayoutInput): string {
  const chrome = CHROME[locale];
  const site = escapeHtml(webOrigin);
  const logo = escapeHtml(new URL(brand.emailLogo.path, webOrigin).href);
  const contact = escapeHtml(brand.company.email);
  const year = new Date().getFullYear();

  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${COLOR.ink}">${textToHtml(paragraph)}</p>`,
    )
    .join('\n');

  const actionBlock = action
    ? `${button(action)}
<p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:19px;color:${COLOR.graphite}">${escapeHtml(chrome.buttonFallback)}<br><a href="${escapeHtml(action.url)}" target="_blank" style="color:${COLOR.ink};text-decoration:underline;word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root { color-scheme: light; supported-color-schemes: light; }
body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
@media (max-width: 620px) {
  .px { padding-left: 20px !important; padding-right: 20px !important; }
  .title { font-size: 26px !important; line-height: 30px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.stone}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.stone}">${escapeHtml(previewText(paragraphs))}${PREVIEW_FILLER}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${COLOR.stone}" style="background:${COLOR.stone}">
<tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="${CONTENT_WIDTH}" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:${CONTENT_WIDTH}px">
<tr><td class="px" bgcolor="${COLOR.ink}" style="background:${COLOR.ink};padding:24px 40px">
<a href="${site}" target="_blank"><img src="${logo}" width="${brand.emailLogo.width}" height="${brand.emailLogo.height}" alt="${escapeHtml(chrome.logoAlt)}" style="display:block;width:${brand.emailLogo.width}px;height:${brand.emailLogo.height}px;font-family:${FONT};font-size:20px;font-weight:bold;letter-spacing:4px;color:${COLOR.stone}"></a>
</td></tr>
<tr><td height="6" bgcolor="${COLOR.green}" style="background:${COLOR.green};height:6px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td class="px" bgcolor="${COLOR.paper}" style="background:${COLOR.paper};padding:36px 40px 32px;border:1px solid ${COLOR.ink};border-top:0">
<h1 class="title" style="margin:0 0 24px;font-family:${HEADING_FONT};font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.5px;color:${COLOR.ink}">${escapeHtml(title)}</h1>
${body}
${actionBlock}
</td></tr>
<tr><td class="px" style="padding:28px 40px 8px">
<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:19px;color:${COLOR.graphite}">${escapeHtml(chrome.tagline)}</p>
<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:19px;color:${COLOR.graphite}">${escapeHtml(chrome.questions)} <a href="mailto:${contact}" style="color:${COLOR.ink};text-decoration:underline">${contact}</a></p>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:19px;color:${COLOR.graphite}">© ${year} ${escapeHtml(brand.name)} · <a href="${site}" target="_blank" style="color:${COLOR.ink};text-decoration:underline">${escapeHtml(new URL(webOrigin).host)}</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
