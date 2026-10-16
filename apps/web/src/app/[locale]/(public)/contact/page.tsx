import { brand } from '@walls/ui/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { ArrowRightIcon, MailIcon, MapPinIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '@/components/contact/contact-form';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'contact' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, '/contact'),
  };
}

const SHORTCUTS = [
  { key: 'property', href: '/properties' },
  { key: 'agent', href: '/for-agents' },
  { key: 'faq', href: { pathname: '/', hash: 'home-faq' } },
] as const;

/** Contact page: where to write, shortcuts for common questions, company details, the form. */
export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  await resolveLocale(params);
  const t = await getTranslations('contact');
  const { company } = brand;
  const pending = t('company.pending');
  const details = [
    { label: t('company.name'), value: brand.name },
    { label: t('company.legalName'), value: company.legalName },
    { label: t('company.address'), value: company.streetAddress },
    { label: t('company.registrationNumber'), value: company.registrationNumber },
    { label: t('company.taxId'), value: company.taxId },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:px-8">
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="max-w-prose text-muted-foreground">{t('intro')}</p>
        </div>

        <section aria-labelledby="contact-channels" className="space-y-3">
          <h2 id="contact-channels" className="text-lg font-semibold">
            {t('channelsTitle')}
          </h2>
          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <MailIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="text-sm text-muted-foreground">{t('emailLabel')}</dt>
                <dd>
                  <a
                    href={`mailto:${company.email}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {company.email}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="text-sm text-muted-foreground">{t('locationLabel')}</dt>
                <dd className="font-medium">{t('location')}</dd>
              </div>
            </div>
          </dl>
        </section>

        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {SHORTCUTS.map(({ key, href }) => (
            <li key={key} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <h2 className="font-semibold">{t(`shortcuts.${key}.title`)}</h2>
              <p className="text-sm text-muted-foreground">
                {t(`shortcuts.${key}.text`, { brand: brand.name })}
              </p>
              <Link
                href={href}
                className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                {t(`shortcuts.${key}.action`)}
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="company-details" className="space-y-3">
          <h2 id="company-details" className="text-lg font-semibold">
            {t('company.title')}
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {details.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={value ? 'font-medium' : 'text-muted-foreground italic'}>
                  {value ?? pending}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>{t('form.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
