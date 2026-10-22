import type { PublicProfilePage } from '@walls/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { Building2Icon, MailIcon } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate } from '@/lib/intl-locale';
import { PhoneContact } from '../profiles/phone-contact';
import { ProfileAvatar } from '../profiles/profile-avatar';
import { SellerTypeBadge } from '../profiles/seller-type-badge';
import type { Pricing } from '@/lib/currency';
import { ListingGrid } from './listing-card';

/**
 * A public page of a professional (agent, agency, investor) or private seller (SPEC §19):
 * profile, contact and listings.
 */
export async function PublicProfileView({
  page,
  pricing,
}: {
  page: PublicProfilePage;
  pricing: Pricing;
}) {
  const t = await getTranslations('publicProfile');
  const locale = await getLocale();
  const { profile, listings } = page;
  const hasContact = profile.phone !== null || profile.email !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <ProfileAvatar
            name={profile.displayName}
            url={profile.avatarUrl}
            alt={t('avatarAlt', { name: profile.displayName })}
            className="size-28 text-3xl"
          />
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <SellerTypeBadge sellerType={profile.sellerType} />
                {profile.agencyName && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2Icon className="size-4" aria-hidden />
                    {profile.agencyName}
                  </span>
                )}
              </div>
            </div>
            {profile.bio && <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>}
            <p className="text-sm text-muted-foreground">
              {t('memberSince', {
                date: formatDate(locale, profile.memberSince, { month: 'long', year: 'numeric' }),
              })}
            </p>
          </div>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">{t('contact')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {profile.phone && <PhoneContact contact={profile.phone} />}
            {profile.email && (
              <div className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" aria-hidden />
                <a
                  href={`mailto:${profile.email}`}
                  className="font-medium break-all hover:underline"
                >
                  {profile.email}
                </a>
              </div>
            )}
            {!hasContact && <p className="text-muted-foreground">{t('noContact')}</p>}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="profile-listings">
        <h2 id="profile-listings" className="text-xl font-semibold">
          {t('listingsTitle')}
        </h2>
        {listings.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('noListings')}
          </p>
        ) : (
          <ListingGrid listings={listings} pricing={pricing} />
        )}
      </section>
    </div>
  );
}
