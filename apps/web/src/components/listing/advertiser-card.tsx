import type { PublicProfile } from '@walls/shared';
import { publicProfilePath } from '@walls/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { Building2Icon, MailIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PhoneContact } from '../profiles/phone-contact';
import { ProfileAvatar } from '../profiles/profile-avatar';
import { SellerTypeBadge } from '../profiles/seller-type-badge';

/**
 * Who advertises the listing, with the contact details they made public (SPEC §19). A badge
 * names the kind of advertiser; phone numbers always carry their verification status.
 */
export function AdvertiserCard({ title, profile }: { title: string; profile: PublicProfile }) {
  const t = useTranslations('listing');
  const tProfile = useTranslations('publicProfile');
  const profilePath = publicProfilePath(profile.role, profile.slug);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={profile.displayName}
            url={profile.avatarUrl}
            alt={tProfile('avatarAlt', { name: profile.displayName })}
            className="size-14 text-lg"
          />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-base font-semibold">{profile.displayName}</p>
            <SellerTypeBadge sellerType={profile.sellerType} />
          </div>
        </div>
        {profile.agencyName && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Building2Icon className="size-4" aria-hidden />
            {profile.agencyName}
          </p>
        )}
        {profile.phone && <PhoneContact contact={profile.phone} />}
        {profile.email && (
          <div className="flex items-center gap-2">
            <MailIcon className="size-4 text-muted-foreground" aria-hidden />
            <a href={`mailto:${profile.email}`} className="font-medium break-all hover:underline">
              {profile.email}
            </a>
          </div>
        )}
        {profilePath && (
          <Link
            href={profilePath}
            className="inline-block font-medium underline-offset-4 hover:underline"
          >
            {t('viewProfile')}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
