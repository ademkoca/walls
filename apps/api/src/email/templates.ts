import type { Locale } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import { TOKEN_TTL_HOURS } from '../auth/token-policy';

export const EmailTemplate = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_SETUP: 'ACCOUNT_SETUP',
  LISTING_SUBMITTED: 'LISTING_SUBMITTED',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  LISTING_CHANGES_APPROVED: 'LISTING_CHANGES_APPROVED',
  LISTING_CHANGES_REJECTED: 'LISTING_CHANGES_REJECTED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  ACCOUNT_REACTIVATED: 'ACCOUNT_REACTIVATED',
} as const;
export type EmailTemplate = (typeof EmailTemplate)[keyof typeof EmailTemplate];

/** Variables each template needs. Stored in the outbox until the email is sent. */
export interface EmailPayloads {
  EMAIL_VERIFICATION: { displayName: string; link: string };
  ACCOUNT_EXISTS: { loginLink: string; resetLink: string };
  PASSWORD_RESET: { link: string };
  PASSWORD_CHANGED: { resetLink: string };
  ACCOUNT_SETUP: { displayName: string; link: string };
  LISTING_SUBMITTED: { displayName: string; listingTitle: string; link: string };
  LISTING_APPROVED: { displayName: string; listingTitle: string; link: string };
  LISTING_REJECTED: { displayName: string; listingTitle: string; reason: string; link: string };
  LISTING_CHANGES_APPROVED: { displayName: string; listingTitle: string; link: string };
  LISTING_CHANGES_REJECTED: {
    displayName: string;
    listingTitle: string;
    reason: string;
    link: string;
  };
  ACCOUNT_DEACTIVATED: { displayName: string; reason: string };
  ACCOUNT_REACTIVATED: { displayName: string; reason: string; loginLink: string };
}

interface EmailContent {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}

type Copy = { [T in EmailTemplate]: (payload: EmailPayloads[T]) => EmailContent };

const setupDays = TOKEN_TTL_HOURS.ACCOUNT_SETUP / 24;

const COPY: Record<Locale, Copy> = {
  sr: {
    EMAIL_VERIFICATION: ({ displayName, link }) => ({
      subject: 'Potvrdite svoju email adresu',
      paragraphs: [
        `Zdravo ${displayName},`,
        `hvala što ste se registrovali na ${brand.name}. Potvrdite email adresu da biste aktivirali nalog i počeli da objavljujete oglase.`,
        `Link važi ${TOKEN_TTL_HOURS.EMAIL_VERIFICATION} sata. Ako niste vi napravili nalog, zanemarite ovu poruku.`,
      ],
      action: { label: 'Potvrdi email adresu', url: link },
    }),
    ACCOUNT_EXISTS: ({ loginLink, resetLink }) => ({
      subject: 'Već imate nalog',
      paragraphs: [
        `Neko je pokušao da napravi nalog na ${brand.name} sa ovom email adresom, ali nalog već postoji.`,
        `Ako ste to bili vi, prijavite se: ${loginLink}`,
        `Ako ste zaboravili lozinku, možete je resetovati: ${resetLink}`,
        'Ako niste vi, zanemarite ovu poruku — vaš nalog nije promenjen.',
      ],
    }),
    PASSWORD_RESET: ({ link }) => ({
      subject: 'Resetovanje lozinke',
      paragraphs: [
        `Primili smo zahtev za resetovanje lozinke za vaš ${brand.name} nalog.`,
        `Link važi ${TOKEN_TTL_HOURS.PASSWORD_RESET} sat. Ako niste vi poslali zahtev, zanemarite ovu poruku — lozinka ostaje ista.`,
      ],
      action: { label: 'Postavi novu lozinku', url: link },
    }),
    PASSWORD_CHANGED: ({ resetLink }) => ({
      subject: 'Lozinka je promenjena',
      paragraphs: [
        `Lozinka vašeg ${brand.name} naloga je upravo promenjena i odjavljeni ste sa svih uređaja.`,
        `Ako to niste bili vi, odmah resetujte lozinku: ${resetLink}`,
      ],
    }),
    ACCOUNT_SETUP: ({ displayName, link }) => ({
      subject: 'Podesite svoj nalog',
      paragraphs: [
        `Zdravo ${displayName},`,
        `za vas je otvoren nalog na ${brand.name}. Postavite lozinku da biste ga aktivirali.`,
        `Link važi ${setupDays} dana.`,
      ],
      action: { label: 'Podesi nalog', url: link },
    }),
    LISTING_SUBMITTED: ({ displayName, listingTitle, link }) => ({
      subject: 'Oglas je poslat na proveru',
      paragraphs: [
        `Zdravo ${displayName},`,
        `oglas „${listingTitle}" je poslat na proveru. Naš tim će ga pregledati i javiti vam kada bude objavljen ili ako je potrebno nešto da izmenite.`,
        'Dok je oglas na proveri, ne može se menjati.',
      ],
      action: { label: 'Pogledaj oglas', url: link },
    }),
    LISTING_APPROVED: ({ displayName, listingTitle, link }) => ({
      subject: 'Oglas je objavljen',
      paragraphs: [
        `Zdravo ${displayName},`,
        `oglas „${listingTitle}" je odobren i sada je javno objavljen.`,
      ],
      action: { label: 'Pogledaj oglas', url: link },
    }),
    LISTING_REJECTED: ({ displayName, listingTitle, reason, link }) => ({
      subject: 'Oglas nije odobren',
      paragraphs: [
        `Zdravo ${displayName},`,
        `oglas „${listingTitle}" nije odobren. Razlog:`,
        reason,
        'Vratite oglas u nacrt, izmenite ga i pošaljite ponovo na proveru.',
      ],
      action: { label: 'Izmeni oglas', url: link },
    }),
    LISTING_CHANGES_APPROVED: ({ displayName, listingTitle, link }) => ({
      subject: 'Izmene oglasa su objavljene',
      paragraphs: [
        `Zdravo ${displayName},`,
        `izmene oglasa „${listingTitle}" su odobrene i sada su javno vidljive.`,
      ],
      action: { label: 'Pogledaj oglas', url: link },
    }),
    LISTING_CHANGES_REJECTED: ({ displayName, listingTitle, reason, link }) => ({
      subject: 'Izmene oglasa nisu odobrene',
      paragraphs: [
        `Zdravo ${displayName},`,
        `izmene oglasa „${listingTitle}" nisu odobrene. Objavljena verzija oglasa ostaje nepromenjena. Razlog:`,
        reason,
      ],
      action: { label: 'Izmeni oglas', url: link },
    }),
    ACCOUNT_DEACTIVATED: ({ displayName, reason }) => ({
      subject: 'Vaš nalog je deaktiviran',
      paragraphs: [
        `Zdravo ${displayName},`,
        `vaš ${brand.name} nalog je deaktiviran. Razlog:`,
        reason,
        'Dok je nalog deaktiviran, ne možete se prijaviti, a vaši oglasi nisu javno vidljivi. Ako mislite da je došlo do greške, odgovorite na ovu poruku.',
      ],
    }),
    ACCOUNT_REACTIVATED: ({ displayName, reason, loginLink }) => ({
      subject: 'Vaš nalog je ponovo aktivan',
      paragraphs: [
        `Zdravo ${displayName},`,
        `vaš ${brand.name} nalog je ponovo aktiviran. Napomena:`,
        reason,
      ],
      action: { label: 'Prijavite se', url: loginLink },
    }),
  },
  en: {
    EMAIL_VERIFICATION: ({ displayName, link }) => ({
      subject: 'Confirm your email address',
      paragraphs: [
        `Hi ${displayName},`,
        `thanks for registering with ${brand.name}. Confirm your email address to activate your account and start listing properties.`,
        `The link is valid for ${TOKEN_TTL_HOURS.EMAIL_VERIFICATION} hours. If you didn't create an account, you can ignore this email.`,
      ],
      action: { label: 'Confirm email address', url: link },
    }),
    ACCOUNT_EXISTS: ({ loginLink, resetLink }) => ({
      subject: 'You already have an account',
      paragraphs: [
        `Someone tried to create a ${brand.name} account with this email address, but an account already exists.`,
        `If this was you, log in: ${loginLink}`,
        `If you've forgotten your password, you can reset it: ${resetLink}`,
        "If this wasn't you, ignore this email — your account has not changed.",
      ],
    }),
    PASSWORD_RESET: ({ link }) => ({
      subject: 'Reset your password',
      paragraphs: [
        `We received a request to reset the password for your ${brand.name} account.`,
        `The link is valid for ${TOKEN_TTL_HOURS.PASSWORD_RESET} hour. If you didn't ask for this, ignore this email — your password stays the same.`,
      ],
      action: { label: 'Set a new password', url: link },
    }),
    PASSWORD_CHANGED: ({ resetLink }) => ({
      subject: 'Your password was changed',
      paragraphs: [
        `The password for your ${brand.name} account was just changed, and you were signed out on all devices.`,
        `If this wasn't you, reset your password now: ${resetLink}`,
      ],
    }),
    ACCOUNT_SETUP: ({ displayName, link }) => ({
      subject: 'Set up your account',
      paragraphs: [
        `Hi ${displayName},`,
        `an account has been created for you on ${brand.name}. Set a password to activate it.`,
        `The link is valid for ${setupDays} days.`,
      ],
      action: { label: 'Set up account', url: link },
    }),
    LISTING_SUBMITTED: ({ displayName, listingTitle, link }) => ({
      subject: 'Your listing was submitted for review',
      paragraphs: [
        `Hello ${displayName},`,
        `your listing "${listingTitle}" has been submitted for review. Our team will check it and let you know when it is published or if anything needs to change.`,
        'The listing cannot be edited while it is in review.',
      ],
      action: { label: 'View listing', url: link },
    }),
    LISTING_APPROVED: ({ displayName, listingTitle, link }) => ({
      subject: 'Your listing is published',
      paragraphs: [
        `Hello ${displayName},`,
        `your listing "${listingTitle}" has been approved and is now public.`,
      ],
      action: { label: 'View listing', url: link },
    }),
    LISTING_REJECTED: ({ displayName, listingTitle, reason, link }) => ({
      subject: 'Your listing was not approved',
      paragraphs: [
        `Hello ${displayName},`,
        `your listing "${listingTitle}" was not approved. Reason:`,
        reason,
        'Turn the listing back into a draft, update it and submit it for review again.',
      ],
      action: { label: 'Edit listing', url: link },
    }),
    LISTING_CHANGES_APPROVED: ({ displayName, listingTitle, link }) => ({
      subject: 'Your listing changes are published',
      paragraphs: [
        `Hello ${displayName},`,
        `the changes to your listing "${listingTitle}" have been approved and are now public.`,
      ],
      action: { label: 'View listing', url: link },
    }),
    LISTING_CHANGES_REJECTED: ({ displayName, listingTitle, reason, link }) => ({
      subject: 'Your listing changes were not approved',
      paragraphs: [
        `Hello ${displayName},`,
        `the changes to your listing "${listingTitle}" were not approved. The published version stays as it was. Reason:`,
        reason,
      ],
      action: { label: 'Edit listing', url: link },
    }),
    ACCOUNT_DEACTIVATED: ({ displayName, reason }) => ({
      subject: 'Your account has been deactivated',
      paragraphs: [
        `Hello ${displayName},`,
        `your ${brand.name} account has been deactivated. Reason:`,
        reason,
        "While the account is deactivated you can't sign in and your listings aren't publicly visible. If you think this is a mistake, reply to this email.",
      ],
    }),
    ACCOUNT_REACTIVATED: ({ displayName, reason, loginLink }) => ({
      subject: 'Your account is active again',
      paragraphs: [
        `Hello ${displayName},`,
        `your ${brand.name} account has been reactivated. Note:`,
        reason,
      ],
      action: { label: 'Log in', url: loginLink },
    }),
  },
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** Renders a template into a plain-text and a minimal, escaped HTML version. */
export function renderEmail<T extends EmailTemplate>(
  template: T,
  locale: Locale,
  payload: EmailPayloads[T],
): { subject: string; html: string; text: string } {
  const content = (COPY[locale][template] as (payload: EmailPayloads[T]) => EmailContent)(payload);
  const subject = `${content.subject} – ${brand.name}`;

  const text = [
    ...content.paragraphs,
    ...(content.action ? [`${content.action.label}: ${content.action.url}`] : []),
    `— ${brand.name} · ${brand.domain}`,
  ].join('\n\n');

  const html = [
    `<div style="font-family:Arial,sans-serif;color:${brand.colors.charcoal};max-width:560px">`,
    ...content.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    content.action
      ? `<p><a href="${escapeHtml(content.action.url)}" style="background:${brand.colors.orange};color:${brand.colors.charcoal};padding:12px 20px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(content.action.label)}</a></p>`
      : '',
    `<p style="color:${brand.colors.slate}">${escapeHtml(brand.name)} · ${escapeHtml(brand.domain)}</p>`,
    '</div>',
  ].join('');

  return { subject, html, text };
}
