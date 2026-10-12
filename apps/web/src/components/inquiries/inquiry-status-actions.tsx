'use client';

import { InquiryStatus } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { inquiriesApi } from '@/lib/api/inquiries';
import { useErrorMessage } from '@/lib/use-error-message';

const ACTIONS = [
  { status: InquiryStatus.CONTACTED, labelKey: 'markContacted' },
  { status: InquiryStatus.CLOSED, labelKey: 'close' },
  { status: InquiryStatus.NEW, labelKey: 'reopen' },
] as const;

/** Moves an inquiry between new, contacted and closed (SPEC §20). The API authorizes it. */
export function InquiryStatusActions({ id, status }: { id: string; status: InquiryStatus }) {
  const t = useTranslations('inquiries');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<InquiryStatus | null>(null);

  async function change(next: InquiryStatus) {
    setBusy(next);
    try {
      await inquiriesApi.setStatus(id, next);
      toast.success(t('statusChanged'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.filter((action) => action.status !== status).map((action) => (
        <Button
          key={action.status}
          type="button"
          variant={action.status === InquiryStatus.CONTACTED ? 'default' : 'outline'}
          disabled={busy !== null}
          onClick={() => void change(action.status)}
        >
          {busy === action.status && <Spinner />}
          {t(action.labelKey)}
        </Button>
      ))}
    </div>
  );
}
