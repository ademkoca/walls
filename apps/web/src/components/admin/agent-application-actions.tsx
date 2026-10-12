'use client';

import { useTranslations } from 'next-intl';
import { agentApplicationsApi } from '@/lib/api/agent-applications';
import { ReviewActions } from './review-actions';

/** Approve or reject an agent application (SPEC §2.1). */
export function AgentApplicationActions({ id, canApprove }: { id: string; canApprove: boolean }) {
  const t = useTranslations('agentApplications');
  const tReview = useTranslations('review');
  return (
    <ReviewActions
      canApprove={canApprove}
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
      onApprove={() => agentApplicationsApi.approve(id)}
      onReject={(reason) => agentApplicationsApi.reject(id, reason)}
    />
  );
}
