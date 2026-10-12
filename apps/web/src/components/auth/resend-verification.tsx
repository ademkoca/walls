'use client';

import { Button } from '@walls/ui/components/button';
import { useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';

/** Sends a fresh verification link to `email`; the response never reveals if it exists. */
export function ResendVerification({
  email,
  label,
  sentMessage,
}: {
  email: string;
  label: string;
  sentMessage: string;
}) {
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<
    { status: 'idle' | 'sending' | 'sent' } | { status: 'error'; error: unknown }
  >({
    status: 'idle',
  });

  async function resend() {
    setState({ status: 'sending' });
    try {
      await authApi.resendVerification({ email });
      setState({ status: 'sent' });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }

  if (state.status === 'sent') return <FormAlert tone="success">{sentMessage}</FormAlert>;
  return (
    <div className="space-y-3">
      {state.status === 'error' && <FormAlert tone="error">{errorMessage(state.error)}</FormAlert>}
      <Button variant="outline" disabled={state.status === 'sending'} onClick={() => void resend()}>
        {label}
      </Button>
    </div>
  );
}
