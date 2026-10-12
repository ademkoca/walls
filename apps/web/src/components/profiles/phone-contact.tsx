import { PhoneVerificationStatus, type PublicPhoneContact } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { BadgeCheckIcon, PhoneIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Digits and a leading + only, for a tel: link. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * A public phone number with its verification status, which must always be shown next to
 * the number and never claim "verified" for an unverified number (SPEC §3–4).
 */
export function PhoneContact({ contact }: { contact: PublicPhoneContact }) {
  const t = useTranslations('publicProfile');
  const verified = contact.verificationStatus === PhoneVerificationStatus.VERIFIED;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PhoneIcon className="size-4 text-muted-foreground" aria-hidden />
      <a href={telHref(contact.phone)} className="font-medium hover:underline">
        {contact.phone}
      </a>
      {verified ? (
        <Badge variant="secondary">
          <BadgeCheckIcon data-icon="inline-start" aria-hidden />
          {t('phoneVerified')}
        </Badge>
      ) : (
        <Badge variant="outline" title={t('phoneUnverifiedHint')}>
          {t('phoneUnverified')}
        </Badge>
      )}
    </div>
  );
}
