import type { PublicProfile } from '@walls/shared';
import { publicProfilePath } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { BadgeCheckIcon, Building2Icon, MailIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PhoneContact } from '../profiles/phone-contact';
import { ProfileAvatar } from '../profiles/profile-avatar';

/**
 * Who advertises the listing, with the contact details they made public (SPEC §19). Phone
 * numbers always carry their verification status; agent approval is shown separately.
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
            {profile.approvedAgent ? (
              <Badge title={tProfile('approvedAgentHint')}>
                <BadgeCheckIcon data-icon="inline-start" aria-hidden />
                {tProfile('approvedAgent')}
              </Badge>
            ) : (
              <Badge variant="secondary">{tProfile('privateSeller')}</Badge>
            )}
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
