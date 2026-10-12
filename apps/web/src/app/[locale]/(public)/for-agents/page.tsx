import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AgentApplicationForm } from '@/components/agents/agent-application-form';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/for-agents'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'agentApplication' });
  return {
    title: t('title'),
    description: t('intro'),
    alternates: localizedAlternates(locale, '/for-agents'),
  };
}

const STEPS = ['apply', 'review', 'setup'] as const;

/** The separate "For real-estate agents" entry point (SPEC §2.1, §3). */
export default async function ForAgentsPage({ params }: PageProps<'/[locale]/for-agents'>) {
  await resolveLocale(params);
  const t = await getTranslations('agentApplication');

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:px-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="max-w-prose text-muted-foreground">{t('intro')}</p>
        </div>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('stepsTitle')}</h2>
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{t(`steps.${step}`)}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className="text-sm text-muted-foreground">
          {t('sellerNote')}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t('sellerLink')}
          </Link>
        </p>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>{t('formTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentApplicationForm />
        </CardContent>
      </Card>
    </div>
  );
}
