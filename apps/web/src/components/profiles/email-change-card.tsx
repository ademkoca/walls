'use client';

import type { MyProfile } from '@walls/shared';
import { type EmailChangeInput, emailChangeInputSchema } from '@walls/validation';
import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { profileApi } from '@/lib/api/profile';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { PasswordInput } from '../forms/password-input';
import { useSchemaForm } from '../forms/use-schema-form';

/** Changing the sign-in email: password check, then a link to the new address (SPEC §4). */
export function EmailChangeCard({
  profile,
  onChange,
}: {
  profile: MyProfile;
  onChange: (profile: MyProfile) => void;
}) {
  const t = useTranslations('profile.email');
  const tProfile = useTranslations('profile');
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);
  const form = useSchemaForm<EmailChangeInput>(emailChangeInputSchema, {
    newEmail: '',
    currentPassword: '',
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      onChange(await profileApi.requestEmailChange(values));
      toast.success(t('sent', { email: values.newEmail }));
      form.reset();
      setOpen(false);
    } catch (caught) {
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
      {!open ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {t('change')}
        </Button>
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
