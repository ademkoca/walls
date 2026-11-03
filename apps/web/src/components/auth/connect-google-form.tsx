'use client';

import { Button } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { GoogleSignInButton } from './google-sign-in-button';

type State = { status: 'idle' | 'submitting' | 'connected' } | { status: 'failed'; error: unknown };

/**
 * Connects a Google account to the Walls account the link was emailed to (SPEC §3.1). Only
 * on a click, so link scanners opening the link cannot connect it.
 */
export function ConnectGoogleForm({ token }: { token: string | null }) {
  const t = useTranslations('auth.connectGoogle');
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<State>({ status: 'idle' });

  if (!token) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;

  async function connect(currentToken: string) {
    setState({ status: 'submitting' });
    try {
      await authApi.confirmGoogleLink(currentToken);
      setState({ status: 'connected' });
    } catch (error) {
      setState({ status: 'failed', error });
    }
  }

  if (state.status === 'connected') {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t('success')}</FormAlert>
        <GoogleSignInButton />
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
        onClick={() => void connect(token)}
      >
        {state.status === 'submitting' && <Spinner />}
        {t('submit')}
      </Button>
    </div>
  );
}
