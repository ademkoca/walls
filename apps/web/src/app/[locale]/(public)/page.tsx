import { buttonVariants } from '@walls/ui/components/button';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';

/** Home page. Search, featured and latest listings arrive with the public site (Phase 8). */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  const t = await getTranslations('home');

  return (
    <section className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        {t('title')}
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{t('subtitle')}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/properties" className={buttonVariants({ size: 'lg' })}>
          {t('browse')}
        </Link>
        <Link href="/register" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          {t('advertise')}
        </Link>
      </div>
    </section>
  );
}
