import {
  PARTNERS_PATH,
  PROFESSIONAL_SELLER_TYPES,
  type ProfessionalSellerType,
} from '@walls/shared';
import { buttonVariants } from '@walls/ui/components/button';
import { cn } from '@walls/ui/lib/utils';
import { Building2Icon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { pageParam } from '@/components/admin/pager';
import { ProfileAvatar } from '@/components/profiles/profile-avatar';
import { SellerTypeBadge } from '@/components/profiles/seller-type-badge';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getPublicPartners } from '@/lib/api/public';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/partners'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'publicProfile' });
  return {
    title: t('partnersTitle'),
    description: t('partnersDescription'),
    alternates: localizedAlternates(locale, PARTNERS_PATH),
  };
}

/** Reads `?type=`: one kind of professional, or all of them when absent or unknown. */
function typeParam(value: string | string[] | undefined): ProfessionalSellerType | undefined {
  return PROFESSIONAL_SELLER_TYPES.find((type) => type === value);
}

const TABS = [undefined, ...PROFESSIONAL_SELLER_TYPES] as const;

/**
 * Directory of approved professionals: agents, agencies and investors, with a tab per kind
 * (SPEC §16, §46: visitors can browse their profiles).
 */
export default async function PartnersPage({
  params,
  searchParams,
}: PageProps<'/[locale]/partners'>) {
  await resolveLocale(params);
  // Rendered per request (with a short data cache), never at build time.
  await connection();
  const t = await getTranslations('publicProfile');
  const query = await searchParams;
  const type = typeParam(query.type);
  const page = pageParam(query.page);
  const result = await getPublicPartners({ type, page });
  const partners = result?.items ?? [];
  const href = (target: { type?: ProfessionalSellerType; page?: number }) => ({
    pathname: PARTNERS_PATH,
    query: {
      ...(target.type ? { type: target.type } : {}),
      ...(target.page && target.page > 1 ? { page: String(target.page) } : {}),
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('partnersTitle')}</h1>
        <p className="text-muted-foreground">{t('partnersDescription')}</p>
      </div>

      <nav aria-label={t('partnersTitle')} className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab ?? 'all'}
            href={href({ type: tab })}
            aria-current={tab === type ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === type
                ? 'border-emphasis text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tab ?? 'all'}`)}
          </Link>
        ))}
      </nav>

      {partners.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('partnersEmpty')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => (
            <li key={partner.slug}>
              <Link
                href={`${PARTNERS_PATH}/${partner.slug}`}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ProfileAvatar
                  name={partner.displayName}
                  url={partner.avatarUrl}
                  alt={t('avatarAlt', { name: partner.displayName })}
                  className="size-16 text-lg"
                />
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold">{partner.displayName}</p>
                  <SellerTypeBadge sellerType={partner.sellerType} />
                  {partner.agencyName && (
                    <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <Building2Icon className="size-4 shrink-0" aria-hidden />
                      {partner.agencyName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('listingCount', { count: partner.listingCount })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && (page > 1 || result.hasMore) && (
        <nav className="flex justify-between gap-2" aria-label={t('partnersTitle')}>
          {page > 1 ? (
            <Link
              href={href({ type, page: page - 1 })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              {t('previous')}
            </Link>
          ) : (
            <span />
          )}
          {result.hasMore && (
            <Link
              href={href({ type, page: page + 1 })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t('next')}
              <ChevronRightIcon data-icon="inline-end" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
