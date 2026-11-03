'use client';

import {
  ApiErrorCode,
  GoogleSignInIntent,
  GoogleSignInOutcome,
  type MyProfile,
} from '@walls/shared';
import { type EmailChangeInput, emailChangeInputSchema } from '@walls/validation';
import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/errors';
import { profileApi } from '@/lib/api/profile';
import { useErrorMessage } from '@/lib/use-error-message';
import { GoogleOutcomeAlert } from '../auth/google-outcome-alert';
import { GoogleSignInButton } from '../auth/google-sign-in-button';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { PasswordInput } from '../forms/password-input';
import { useSchemaForm } from '../forms/use-schema-form';

const PROFILE_PATH = '/dashboard/profile';

/** Accounts with a password must type it (the API says the same). */
const withPasswordSchema = emailChangeInputSchema.required({ currentPassword: true });

/**
 * Changing the sign-in email: the user proves who they are again, then a link goes to the new
 * address (SPEC §4). Accounts with a password type it; accounts that sign in only with Google
 * confirm with Google first (SPEC §3.1), which brings them back here with the form open.
 */
export function EmailChangeCard({
  profile,
  onChange,
  googleOutcome,
}: {
  profile: MyProfile;
  onChange: (profile: MyProfile) => void;
  googleOutcome: string | null;
}) {
  const t = useTranslations('profile.email');
  const tProfile = useTranslations('profile');
  const errorMessage = useErrorMessage();
  const confirmedWithGoogle = googleOutcome === GoogleSignInOutcome.REAUTHENTICATED;
  const [open, setOpen] = useState(confirmedWithGoogle && !profile.hasPassword);
  // Shown until the user confirms again (or the confirmation runs out).
  const [needsGoogle, setNeedsGoogle] = useState(!profile.hasPassword && !confirmedWithGoogle);
  const [error, setError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);
  const form = useSchemaForm<EmailChangeInput>(
    profile.hasPassword ? withPasswordSchema : emailChangeInputSchema,
    { newEmail: '', ...(profile.hasPassword ? { currentPassword: '' } : {}) },
  );
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      onChange(await profileApi.requestEmailChange(values));
      toast.success(t('sent', { email: values.newEmail }));
      form.reset();
      setOpen(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === ApiErrorCode.REAUTHENTICATION_REQUIRED) {
        setNeedsGoogle(true);
        setOpen(false);
      }
      setError(caught);
    }
  });

  async function cancel() {
    setCancelling(true);
    try {
      onChange(await profileApi.cancelEmailChange());
      toast.success(t('cancelled'));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-muted-foreground">{t('current')}</p>
        <p className="font-medium break-all">{profile.email}</p>
      </div>
      {profile.pendingEmail && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <p className="font-medium break-all">{t('pending', { email: profile.pendingEmail })}</p>
          <p className="text-muted-foreground">{t('pendingHint')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancelling}
            onClick={() => void cancel()}
          >
            {t('cancel')}
          </Button>
        </div>
      )}
      {!profile.hasPassword && (
        <div className="space-y-3">
          <GoogleOutcomeAlert outcome={googleOutcome} />
          {!needsGoogle && open && <FormAlert tone="success">{t('reauthenticated')}</FormAlert>}
          {!open && error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
          {needsGoogle && (
            <>
              <p className="text-muted-foreground">{t('googleOnly')}</p>
              <GoogleSignInButton
                intent={GoogleSignInIntent.REAUTHENTICATE}
                next={PROFILE_PATH}
                label={t('confirmWithGoogle')}
                className="w-auto"
              />
            </>
          )}
          <p className="text-muted-foreground">{t('setPassword')}</p>
        </div>
      )}
      {!open ? (
        !needsGoogle && (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {t('change')}
          </Button>
        )
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
          {profile.changesRequireApproval && (
            <p className="text-muted-foreground">{t('agentNote')}</p>
          )}
          {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
          <FieldGroup>
            <FormField id="newEmail" label={t('newEmail')} error={errors.newEmail}>
              <Input
                {...fieldAria('newEmail', errors.newEmail)}
                type="email"
                autoComplete="email"
                {...form.register('newEmail')}
              />
            </FormField>
            {profile.hasPassword && (
              <FormField
                id="currentPassword"
                label={t('currentPassword')}
                error={errors.currentPassword}
              >
                <PasswordInput
                  {...fieldAria('currentPassword', errors.currentPassword)}
                  autoComplete="current-password"
                  {...form.register('currentPassword')}
                />
              </FormField>
            )}
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {t('send')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tProfile('cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
