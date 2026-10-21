import { FOR_PROFESSIONALS_PATH, PARTNERS_PATH } from '@walls/shared';
import { brand } from '@walls/ui/brand';
import { buttonVariants } from '@walls/ui/components/button';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  ClipboardCheckIcon,
  EyeOffIcon,
  HandCoinsIcon,
  HomeIcon,
  type LucideIcon,
  MegaphoneIcon,
  PhoneIcon,
  SearchIcon,
  UserCheckIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HomeStats } from '@/components/home/home-stats';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getPublicHome } from '@/lib/api/public';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'nav' }),
  ]);
  return {
    title: tNav('about'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, '/about'),
  };
}

const STORY = ['problem', 'solution', 'trust'] as const;

const WAYS: { key: 'find' | 'sell' | 'agent'; href: string; icon: LucideIcon }[] = [
  { key: 'find', href: '/properties', icon: SearchIcon },
  { key: 'sell', href: '/register', icon: MegaphoneIcon },
  { key: 'agent', href: PARTNERS_PATH, icon: UserCheckIcon },
];

const TRUST: { key: 'reviewed' | 'agents' | 'address' | 'phone' | 'free'; icon: LucideIcon }[] = [
  { key: 'reviewed', icon: ClipboardCheckIcon },
  { key: 'agents', icon: BadgeCheckIcon },
  { key: 'address', icon: EyeOffIcon },
  { key: 'phone', icon: PhoneIcon },
  { key: 'free', icon: HandCoinsIcon },
];

/** About page: why Walls exists, the three ways to use it, and how it stays trustworthy. */
export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  await resolveLocale(params);
  const [t, tHome, home] = await Promise.all([
    getTranslations('about'),
    getTranslations('home'),
    getPublicHome(),
  ]);
  const values = { brand: brand.name };

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
      <section aria-labelledby="about-title" className="max-w-3xl space-y-6">
        <HomeIcon className="size-8 text-primary" aria-hidden />
        <h1 id="about-title" className="text-4xl font-semibold tracking-tight text-balance">
          {t('title')}
        </h1>
        <p className="text-xl text-muted-foreground">{t('lead')}</p>
        <div className="space-y-4 text-lg leading-relaxed">
          {STORY.map((key) => (
            <p key={key}>{t(`story.${key}`, values)}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-ways" className="space-y-6">
        <h2 id="about-ways" className="text-2xl font-semibold tracking-tight">
          {t('waysTitle', values)}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {WAYS.map(({ key, href, icon: Icon }) => (
            <li key={key} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
              <Icon className="size-6 text-primary" aria-hidden />
              <h3 className="text-lg font-semibold">{t(`ways.${key}.title`)}</h3>
              <p className="text-muted-foreground">{t(`ways.${key}.text`)}</p>
              <Link
                href={href}
                className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                {t(`ways.${key}.action`)}
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-trust" className="space-y-6">
        <h2 id="about-trust" className="text-2xl font-semibold tracking-tight">
          {t('trustTitle', values)}
        </h2>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-4">
              <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                <h3 className="font-semibold">{t(`trustPoints.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`trustPoints.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {home.stats && (
        <section aria-labelledby="about-numbers" className="space-y-4">
          <h2 id="about-numbers" className="text-2xl font-semibold tracking-tight">
            {t('numbersTitle', values)}
          </h2>
          <HomeStats stats={home.stats} />
        </section>
      )}

      <section className="flex flex-col gap-6 rounded-xl bg-sidebar p-6 text-sidebar-foreground sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t('ctaTitle')}</h2>
          <p className="text-sidebar-foreground/85">{t('ctaText')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/properties" className={buttonVariants({ size: 'xl' })}>
            {tHome('browse')}
          </Link>
          {/* The dark surface's light text would otherwise carry over onto the light buttons. */}
          {[
            { href: '/register', label: tHome('advertise') },
            { href: FOR_PROFESSIONALS_PATH, label: tHome('agentBanner.action') },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={buttonVariants({
                size: 'xl',
                variant: 'outline',
                className: 'text-foreground',
              })}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
