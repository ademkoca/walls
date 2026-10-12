'use client';

import { Button, buttonVariants } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { profileApi } from '@/lib/api/profile';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';

type State =
  | { status: 'idle' | 'submitting' }
  | { status: 'confirmed'; awaitingApproval: boolean }
  | { status: 'failed'; error: unknown };

/**
 * Confirms a new sign-in email when the user clicks (like email verification, so link
 * scanners cannot confirm it by opening the link).
 */
export function ConfirmEmailForm({ token }: { token: string | null }) {
  const t = useTranslations('auth.confirmEmail');
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<State>({ status: 'idle' });

  if (!token) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;

  async function confirm(currentToken: string) {
    setState({ status: 'submitting' });
    try {
      const { awaitingApproval } = await profileApi.confirmEmailChange(currentToken);
      setState({ status: 'confirmed', awaitingApproval });
    } catch (error) {
      setState({ status: 'failed', error });
    }
  }

  if (state.status === 'confirmed') {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">
          {state.awaitingApproval ? t('awaitingApproval') : t('changed')}
        </FormAlert>
        <Link href="/dashboard/profile" className={buttonVariants({ size: 'lg' })}>
          {t('goToProfile')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.status === 'failed' && (
        <FormAlert tone="error">
          {errorMessage(state.error)} {t('requestNew')}
        </FormAlert>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={state.status === 'submitting'}
        onClick={() => void confirm(token)}
      >
        {state.status === 'submitting' && <Spinner />}
        {t('submit')}
      </Button>
    </div>
  );
}
