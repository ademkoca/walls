import { brand } from '@walls/ui/brand';
import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import { FileWarningIcon } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate } from '@/lib/intl-locale';

/** When the legal texts were last changed; update it with every change to them. */
const LAST_UPDATED = new Date('2026-10-21T12:00:00Z');

export const PRIVACY_SECTIONS = [
  'controller',
  'collect',
  'use',
  'share',
  'providers',
  'cookies',
  'retention',
  'rights',
  'changes',
] as const;

export const TERMS_SECTIONS = [
  'service',
  'accounts',
  'listings',
  'conduct',
  'deactivation',
  'responsibility',
  'law',
  'changes',
] as const;

type LegalDocument =
  | { document: 'privacy'; sections: typeof PRIVACY_SECTIONS }
  | { document: 'terms'; sections: typeof TERMS_SECTIONS };

/**
 * A legal text (privacy policy, terms of use), marked as a draft until it has been reviewed.
 * Section bodies separate paragraphs with blank lines.
 */
export async function LegalPage({ document, sections }: LegalDocument) {
  const [t, tLegal, locale] = await Promise.all([
    getTranslations(`legal.${document}`),
    getTranslations('legal'),
    getLocale(),
  ]);
  const values = { brand: brand.name, domain: brand.domain, email: brand.company.email };
  // Each document has its own section keys; the union of both is looked up by key here.
  const section = (key: string, part: 'title' | 'body') =>
    t(`sections.${key}.${part}` as Parameters<typeof t>[0], values);

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {tLegal('lastUpdated', { date: formatDate(locale, LAST_UPDATED, { dateStyle: 'long' }) })}
        </p>
      </header>
      <Alert>
        <FileWarningIcon />
        <AlertTitle>{tLegal('draftTitle')}</AlertTitle>
        <AlertDescription>{tLegal('draftNotice', values)}</AlertDescription>
      </Alert>
      <p className="text-lg">{t('intro', values)}</p>
      {sections.map((key) => (
        <section key={key} aria-labelledby={`legal-${key}`} className="space-y-3">
          <h2 id={`legal-${key}`} className="text-xl font-semibold">
            {section(key, 'title')}
          </h2>
          {section(key, 'body')
            .split('\n\n')
            .map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
        </section>
      ))}
    </article>
  );
}
