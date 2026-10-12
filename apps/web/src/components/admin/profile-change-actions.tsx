'use client';

import { useTranslations } from 'next-intl';
import { profileChangesApi } from '@/lib/api/profile';
import { ReviewActions } from './review-actions';

/** Approve or reject an agent's profile changes (SPEC §4). */
export function ProfileChangeActions({ id }: { id: string }) {
  const t = useTranslations('profileChanges');
  const tReview = useTranslations('review');
  return (
    <ReviewActions
      text={{
        approve: t('approve'),
        approveTitle: t('approveTitle'),
        approveDescription: t('approveDescription'),
        approved: t('approved'),
        reject: t('reject'),
        rejectTitle: t('rejectTitle'),
        rejectDescription: t('rejectDescription'),
        reason: t('reason'),
        rejected: t('rejected'),
        cancel: tReview('cancel'),
      }}
      onApprove={() => profileChangesApi.approve(id)}
      onReject={(reason) => profileChangesApi.reject(id, reason)}
    />
  );
}
