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
  AGENT_APPLICATION_RECEIVED: 'AGENT_APPLICATION_RECEIVED',
  AGENT_APPLICATION_EMAIL_IN_USE: 'AGENT_APPLICATION_EMAIL_IN_USE',
  AGENT_APPLICATION_DUPLICATE: 'AGENT_APPLICATION_DUPLICATE',
  AGENT_APPLICATION_APPROVED: 'AGENT_APPLICATION_APPROVED',
  AGENT_APPLICATION_REJECTED: 'AGENT_APPLICATION_REJECTED',
  EMAIL_CHANGE_VERIFICATION: 'EMAIL_CHANGE_VERIFICATION',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
  PROFILE_CHANGES_APPROVED: 'PROFILE_CHANGES_APPROVED',
  PROFILE_CHANGES_REJECTED: 'PROFILE_CHANGES_REJECTED',
  INQUIRY_RECEIVED: 'INQUIRY_RECEIVED',
  CONTACT_MESSAGE: 'CONTACT_MESSAGE',
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
  AGENT_APPLICATION_RECEIVED: { fullName: string };
  AGENT_APPLICATION_EMAIL_IN_USE: { fullName: string; loginLink: string; applyLink: string };
  AGENT_APPLICATION_DUPLICATE: { fullName: string };
  AGENT_APPLICATION_APPROVED: { displayName: string; link: string };
  AGENT_APPLICATION_REJECTED: { fullName: string; reason: string };
  EMAIL_CHANGE_VERIFICATION: { displayName: string; newEmail: string; link: string };
  EMAIL_CHANGED: { displayName: string; newEmail: string };
  PROFILE_CHANGES_APPROVED: { displayName: string; link: string };
  PROFILE_CHANGES_REJECTED: { displayName: string; reason: string; link: string };
  INQUIRY_RECEIVED: {
    displayName: string;
    listingTitle: string;
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string | null;
    message: string;
    link: string;
  };
  CONTACT_MESSAGE: {
    name: string;
    email: string;
    subject: string;
    message: string;
    /** The language of the page the visitor wrote from. */
    pageLocale: Locale;
  };
}

interface EmailContent {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  replyTo?: string;
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
    AGENT_APPLICATION_RECEIVED: ({ fullName }) => ({
      subject: 'Primili smo vašu prijavu za profesionalni nalog',
      paragraphs: [
        `Zdravo ${fullName},`,
        `hvala na prijavi za profesionalni nalog na ${brand.name}. Naš tim će pregledati vaše podatke i dokaze i javiti vam ishod emailom.`,
      ],
    }),
    AGENT_APPLICATION_EMAIL_IN_USE: ({ fullName, loginLink, applyLink }) => ({
      subject: 'Prijava za profesionalni nalog nije primljena',
      paragraphs: [
        `Zdravo ${fullName},`,
        `primili smo prijavu za profesionalni nalog sa ove email adrese, ali ona već pripada nalogu na ${brand.name}. Profesionalni nalog mora imati svoju email adresu, pa vas molimo da se prijavite ponovo sa drugom adresom.`,
        `Ako niste vi poslali prijavu, zanemarite ovu poruku. Svom postojećem nalogu možete pristupiti ovde: ${loginLink}`,
      ],
      action: { label: 'Pošalji novu prijavu', url: applyLink },
    }),
    AGENT_APPLICATION_DUPLICATE: ({ fullName }) => ({
      subject: 'Vaša prijava za profesionalni nalog je već u obradi',
      paragraphs: [
        `Zdravo ${fullName},`,
        'sa ove email adrese već imamo prijavu za profesionalni nalog koja čeka proveru, pa novu prijavu nismo sačuvali. Javićemo vam ishod emailom.',
      ],
    }),
    AGENT_APPLICATION_APPROVED: ({ displayName, link }) => ({
      subject: 'Vaša prijava za profesionalni nalog je odobrena',
      paragraphs: [
        `Zdravo ${displayName},`,
        `vaša prijava za profesionalni nalog na ${brand.name} je odobrena. Postavite lozinku da biste aktivirali nalog i počeli da objavljujete oglase.`,
        `Link važi ${setupDays} dana.`,
      ],
      action: { label: 'Podesi nalog', url: link },
    }),
    AGENT_APPLICATION_REJECTED: ({ fullName, reason }) => ({
      subject: 'Vaša prijava za profesionalni nalog nije odobrena',
      paragraphs: [
        `Zdravo ${fullName},`,
        'vaša prijava za profesionalni nalog nije odobrena. Razlog:',
        reason,
      ],
    }),
    EMAIL_CHANGE_VERIFICATION: ({ displayName, newEmail, link }) => ({
      subject: 'Potvrdite novu email adresu',
      paragraphs: [
        `Zdravo ${displayName},`,
        `potvrdite da želite da ${newEmail} bude nova email adresa vašeg naloga na ${brand.name}.`,
        `Link važi ${TOKEN_TTL_HOURS.EMAIL_CHANGE} sata. Ako niste vi zatražili promenu, zanemarite ovu poruku.`,
      ],
      action: { label: 'Potvrdi adresu', url: link },
    }),
    EMAIL_CHANGED: ({ displayName, newEmail }) => ({
      subject: 'Email adresa naloga je promenjena',
      paragraphs: [
        `Zdravo ${displayName},`,
        `email adresa vašeg naloga na ${brand.name} je promenjena u ${newEmail}. Od sada se prijavljujete tom adresom.`,
        'Ako niste vi napravili ovu promenu, odmah nam odgovorite na ovaj email.',
      ],
    }),
    PROFILE_CHANGES_APPROVED: ({ displayName, link }) => ({
      subject: 'Izmene profila su odobrene',
      paragraphs: [`Zdravo ${displayName},`, 'izmene vašeg profila su odobrene i sada su javne.'],
      action: { label: 'Pogledaj profil', url: link },
    }),
    PROFILE_CHANGES_REJECTED: ({ displayName, reason, link }) => ({
      subject: 'Izmene profila nisu odobrene',
      paragraphs: [
        `Zdravo ${displayName},`,
        'izmene vašeg profila nisu odobrene; javni profil je ostao isti. Razlog:',
        reason,
      ],
      action: { label: 'Uredi profil', url: link },
    }),
    INQUIRY_RECEIVED: ({
      displayName,
      listingTitle,
      visitorName,
      visitorEmail,
      visitorPhone,
      message,
      link,
    }) => ({
      subject: `Novi upit za oglas: ${listingTitle}`,
      paragraphs: [
        `Zdravo ${displayName},`,
        `${visitorName} vam je poslao/la upit za oglas „${listingTitle}”:`,
        message,
        `Email: ${visitorEmail}` + (visitorPhone ? ` · Telefon: ${visitorPhone}` : ''),
        'Odgovorom na ovu poruku pišete direktno pošiljaocu. Status upita menjate na kontrolnoj tabli.',
      ],
      action: { label: 'Otvori upit', url: link },
      replyTo: visitorEmail,
    }),
    CONTACT_MESSAGE: ({ name, email, subject, message, pageLocale }) => ({
      subject: `Kontakt forma: ${subject}`,
      paragraphs: [
        `${name} (${email}) je poslao/la poruku preko kontakt stranice:`,
        message,
        `Poslato sa ${pageLocale === 'en' ? 'engleske' : 'srpske'} verzije sajta. Odgovorom na ovu poruku pišete direktno pošiljaocu.`,
      ],
      replyTo: email,
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
    AGENT_APPLICATION_RECEIVED: ({ fullName }) => ({
      subject: 'We received your application for a professional account',
      paragraphs: [
        `Hello ${fullName},`,
        `thank you for applying for a professional account on ${brand.name}. Our team will review your details and proof and email you the outcome.`,
      ],
    }),
    AGENT_APPLICATION_EMAIL_IN_USE: ({ fullName, loginLink, applyLink }) => ({
      subject: 'Your application for a professional account was not received',
      paragraphs: [
        `Hello ${fullName},`,
        `we received an application for a professional account from this email address, but it already belongs to a ${brand.name} account. A professional account needs its own email address, so please apply again with a different one.`,
        `If you didn't send this application, you can ignore this email. You can log in to your existing account here: ${loginLink}`,
      ],
      action: { label: 'Apply again', url: applyLink },
    }),
    AGENT_APPLICATION_DUPLICATE: ({ fullName }) => ({
      subject: 'Your application for a professional account is already in review',
      paragraphs: [
        `Hello ${fullName},`,
        "we already have an application for a professional account from this email address waiting for review, so we didn't save the new one. We'll email you the outcome.",
      ],
    }),
    AGENT_APPLICATION_APPROVED: ({ displayName, link }) => ({
      subject: 'Your application for a professional account was approved',
      paragraphs: [
        `Hello ${displayName},`,
        `your application for a professional account on ${brand.name} has been approved. Set a password to activate your account and start publishing listings.`,
        `The link is valid for ${setupDays} days.`,
      ],
      action: { label: 'Set up account', url: link },
    }),
    AGENT_APPLICATION_REJECTED: ({ fullName, reason }) => ({
      subject: 'Your application for a professional account was not approved',
      paragraphs: [
        `Hello ${fullName},`,
        'your application for a professional account was not approved. Reason:',
        reason,
      ],
    }),
    EMAIL_CHANGE_VERIFICATION: ({ displayName, newEmail, link }) => ({
      subject: 'Confirm your new email address',
      paragraphs: [
        `Hello ${displayName},`,
        `please confirm that you want ${newEmail} to be the new email address of your ${brand.name} account.`,
        `The link is valid for ${TOKEN_TTL_HOURS.EMAIL_CHANGE} hours. If you didn't ask for this change, ignore this email.`,
      ],
      action: { label: 'Confirm address', url: link },
    }),
    EMAIL_CHANGED: ({ displayName, newEmail }) => ({
      subject: 'Your account email address was changed',
      paragraphs: [
        `Hello ${displayName},`,
        `the email address of your ${brand.name} account was changed to ${newEmail}. From now on, log in with that address.`,
        "If you didn't make this change, reply to this email right away.",
      ],
    }),
    PROFILE_CHANGES_APPROVED: ({ displayName, link }) => ({
      subject: 'Your profile changes were approved',
      paragraphs: [
        `Hello ${displayName},`,
        'your profile changes have been approved and are now public.',
      ],
      action: { label: 'View profile', url: link },
    }),
    PROFILE_CHANGES_REJECTED: ({ displayName, reason, link }) => ({
      subject: 'Your profile changes were not approved',
      paragraphs: [
        `Hello ${displayName},`,
        'your profile changes were not approved; your public profile stays as it was. Reason:',
        reason,
      ],
      action: { label: 'Edit profile', url: link },
    }),
    INQUIRY_RECEIVED: ({
      displayName,
      listingTitle,
      visitorName,
      visitorEmail,
      visitorPhone,
      message,
      link,
    }) => ({
      subject: `New inquiry about: ${listingTitle}`,
      paragraphs: [
        `Hello ${displayName},`,
        `${visitorName} sent you an inquiry about your listing "${listingTitle}":`,
        message,
        `Email: ${visitorEmail}` + (visitorPhone ? ` · Phone: ${visitorPhone}` : ''),
        'Reply to this email to write to the sender directly. Change the inquiry status in your dashboard.',
      ],
      action: { label: 'Open inquiry', url: link },
      replyTo: visitorEmail,
    }),
    CONTACT_MESSAGE: ({ name, email, subject, message, pageLocale }) => ({
      subject: `Contact form: ${subject}`,
      paragraphs: [
        `${name} (${email}) sent a message through the contact page:`,
        message,
        `Sent from the ${pageLocale === 'en' ? 'English' : 'Serbian'} site. Reply to this email to write to the sender directly.`,
      ],
      replyTo: email,
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
): { subject: string; html: string; text: string; replyTo?: string } {
  const content = (COPY[locale][template] as (payload: EmailPayloads[T]) => EmailContent)(payload);
  const subject = `${content.subject} – ${brand.name}`;

  const text = [
    ...content.paragraphs,
    ...(content.action ? [`${content.action.label}: ${content.action.url}`] : []),
    `— ${brand.name} · ${brand.domain}`,
  ].join('\n\n');

  const html = [
    `<div style="font-family:Arial,sans-serif;color:${brand.colors.charcoal};max-width:560px">`,
    ...content.paragraphs.map(
      (paragraph) => `<p style="white-space:pre-line">${escapeHtml(paragraph)}</p>`,
    ),
    content.action
      ? `<p><a href="${escapeHtml(content.action.url)}" style="background:${brand.colors.orange};color:${brand.colors.cream};padding:12px 20px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(content.action.label)}</a></p>`
      : '',
    `<p style="color:${brand.colors.slate}">${escapeHtml(brand.name)} · ${escapeHtml(brand.domain)}</p>`,
    '</div>',
  ].join('');

  return { subject, html, text, ...(content.replyTo ? { replyTo: content.replyTo } : {}) };
}
