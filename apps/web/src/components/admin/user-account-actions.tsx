'use client';

import type { UserDetail } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReasonDialog } from '@/components/dashboard/dialogs';
import { useRouter } from '@/i18n/navigation';
import { usersApi } from '@/lib/api/users';
import { useErrorMessage } from '@/lib/use-error-message';

/** Deactivate or reactivate an account, with a written reason (SPEC §2.1). */
export function UserAccountActions({ user }: { user: UserDetail }) {
  const t = useTranslations('users');
  const tReview = useTranslations('review');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [dialog, setDialog] = useState<'deactivate' | 'reactivate' | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: 'deactivate' | 'reactivate', reason: string) {
    setBusy(true);
    try {
      await usersApi[action](user.id, reason);
      toast.success(t(action === 'deactivate' ? 'deactivated' : 'reactivated'));
      setDialog(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const { canDeactivate, canReactivate } = user.permissions;
  if (!canDeactivate && !canReactivate) return null;

  return (
    <>
      {canDeactivate && (
        <Button type="button" variant="destructive" onClick={() => setDialog('deactivate')}>
          {t('deactivate')}
        </Button>
      )}
      {canReactivate && (
        <Button type="button" onClick={() => setDialog('reactivate')}>
          {t('reactivate')}
        </Button>
      )}
      <ReasonDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => setDialog(open ? 'deactivate' : null)}
        title={t('deactivateTitle')}
        description={t('deactivateDescription')}
        confirmLabel={t('deactivate')}
        cancelLabel={tReview('cancel')}
        reasonLabel={t('reason')}
        destructive
        busy={busy}
        onConfirm={(reason) => void run('deactivate', reason)}
      />
      <ReasonDialog
        open={dialog === 'reactivate'}
        onOpenChange={(open) => setDialog(open ? 'reactivate' : null)}
        title={t('reactivateTitle')}
        description={t('reactivateDescription')}
        confirmLabel={t('reactivate')}
        cancelLabel={tReview('cancel')}
        reasonLabel={t('reason')}
        busy={busy}
        onConfirm={(reason) => void run('reactivate', reason)}
      />
    </>
  );
}
