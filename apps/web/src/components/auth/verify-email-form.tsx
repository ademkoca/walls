'use client';

import { Button, buttonVariants } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';

type State = { status: 'idle' | 'submitting' | 'verified' } | { status: 'failed'; error: unknown };

/**
 * Confirms the email only when the user clicks: opening the link alone changes nothing,
 * so email security scanners that prefetch links cannot verify an account by accident.
 */
export function VerifyEmailForm({ token }: { token: string | null }) {
  const t = useTranslations('auth.verifyEmail');
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<State>({ status: 'idle' });

  if (!token) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;

  async function verify(currentToken: string) {
    setState({ status: 'submitting' });
    try {
      await authApi.verifyEmail(currentToken);
      setState({ status: 'verified' });
    } catch (error) {
      setState({ status: 'failed', error });
    }
  }

  if (state.status === 'verified') {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t('success')}</FormAlert>
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          {t('goToLogin')}
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
        onClick={() => void verify(token)}
      >
        {state.status === 'submitting' && <Spinner />}
        {t('submit')}
      </Button>
    </div>
  );
}
