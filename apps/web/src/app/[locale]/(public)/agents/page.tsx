import { buttonVariants } from '@walls/ui/components/button';
import { Building2Icon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { pageParam } from '@/components/admin/pager';
import { ProfileAvatar } from '@/components/profiles/profile-avatar';
import { metadataLocale, resolveLocale } from '@/i18n/locale-param';
import { Link } from '@/i18n/navigation';
import { getPublicAgents } from '@/lib/api/public';
import { localizedAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/agents'>): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: 'publicProfile' });
  return {
    title: t('agentsTitle'),
    description: t('agentsDescription'),
    alternates: localizedAlternates(locale, '/agents'),
  };
}

/** Directory of approved agents (SPEC §16, §46: visitors can browse agent profiles). */
export default async function AgentsPage({ params, searchParams }: PageProps<'/[locale]/agents'>) {
  await resolveLocale(params);
  // Rendered per request (with a short data cache), never at build time.
  await connection();
  const t = await getTranslations('publicProfile');
  const page = pageParam((await searchParams).page);
  const result = await getPublicAgents(page);
  const agents = result?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agentsTitle')}</h1>
        <p className="text-muted-foreground">{t('agentsDescription')}</p>
      </div>

      {agents.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t('agentsEmpty')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <li key={agent.slug}>
              <Link
                href={`/agents/${agent.slug}`}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ProfileAvatar
                  name={agent.displayName}
                  url={agent.avatarUrl}
                  alt={t('avatarAlt', { name: agent.displayName })}
                  className="size-16 text-lg"
                />
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold">{agent.displayName}</p>
                  {agent.agencyName && (
                    <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <Building2Icon className="size-4 shrink-0" aria-hidden />
                      {agent.agencyName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('listingCount', { count: agent.listingCount })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && (page > 1 || result.hasMore) && (
        <nav className="flex justify-between gap-2" aria-label={t('agentsTitle')}>
          {page > 1 ? (
            <Link
              href={{ pathname: '/agents', query: { page: String(page - 1) } }}
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
              href={{ pathname: '/agents', query: { page: String(page + 1) } }}
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
