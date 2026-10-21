import { SellerType } from '@walls/shared';
import { Badge } from '@walls/ui/components/badge';
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  HardHatIcon,
  type LucideIcon,
  UserIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const ICONS: Record<SellerType, LucideIcon> = {
  [SellerType.PRIVATE_SELLER]: UserIcon,
  [SellerType.REAL_ESTATE_AGENT]: BriefcaseBusinessIcon,
  [SellerType.AGENCY]: Building2Icon,
  [SellerType.INVESTOR]: HardHatIcon,
};

/**
 * What kind of advertiser someone is: private seller, agent, agency or investor (SPEC §19).
 * It names the kind only; professionals are approved before their account exists, so there
 * is no separate "verified" label.
 */
export function SellerTypeBadge({
  sellerType,
  className,
}: {
  sellerType: SellerType;
  className?: string;
}) {
  const t = useTranslations('enums.sellerType');
  const Icon = ICONS[sellerType];
  return (
    <Badge variant="secondary" className={className}>
      <Icon data-icon="inline-start" aria-hidden />
      {t(sellerType)}
    </Badge>
  );
}
