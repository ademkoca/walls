import { PhoneVerificationStatus, type PublicPhoneContact } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import { BadgeCheckIcon, PhoneIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Digits and a leading + only, for a tel: link. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * A public phone number. Only a number a trusted verification process marked as verified
 * gets a "Verified" badge; unverified numbers carry no label (SPEC §3–4). The MVP has no
 * phone verification, so no number shows the badge until it is built after launch.
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
      {verified && (
        <Badge variant="secondary">
          <BadgeCheckIcon data-icon="inline-start" aria-hidden />
          {t('phoneVerified')}
        </Badge>
      )}
    </div>
  );
}
