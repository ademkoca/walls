'use client';

import { Button } from '@walls/ui/components/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog, ReasonDialog } from '@/components/dashboard/dialogs';
import { useRouter } from '@/i18n/navigation';
import { useErrorMessage } from '@/lib/use-error-message';

interface ReviewText {
  approve: string;
  approveTitle: string;
  approveDescription: string;
  approved: string;
  reject: string;
  rejectTitle: string;
  rejectDescription: string;
  reason: string;
  rejected: string;
  cancel: string;
}

/**
 * Approve / reject-with-reason buttons for a review queue item (agent applications,
 * profile changes). The API authorizes both; the page refreshes afterwards.
 */
export function ReviewActions({
  text,
  canApprove = true,
  onApprove,
  onReject,
}: {
  text: ReviewText;
  canApprove?: boolean;
  onApprove: () => Promise<unknown>;
  onReject: (reason: string) => Promise<unknown>;
}) {
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await task();
      toast.success(success);
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && (
        <Button type="button" onClick={() => setDialog('approve')}>
          {text.approve}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => setDialog('reject')}>
        {text.reject}
      </Button>
      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(open) => setDialog(open ? 'approve' : null)}
        title={text.approveTitle}
        description={text.approveDescription}
        confirmLabel={text.approve}
        cancelLabel={text.cancel}
        busy={busy}
        onConfirm={() => void run(onApprove, text.approved)}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(open) => setDialog(open ? 'reject' : null)}
        title={text.rejectTitle}
        description={text.rejectDescription}
        confirmLabel={text.reject}
        cancelLabel={text.cancel}
        reasonLabel={text.reason}
        destructive
        busy={busy}
        onConfirm={(reason) => void run(() => onReject(reason), text.rejected)}
      />
    </div>
  );
}
