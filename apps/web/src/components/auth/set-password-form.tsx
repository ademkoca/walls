'use client';

import { Button, buttonVariants } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Spinner } from '@walls/ui/components/spinner';
import { AUTH_INPUT_LIMITS, newPasswordSchema } from '@walls/validation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { PasswordInput } from '../forms/password-input';
import { useSchemaForm } from '../forms/use-schema-form';

const passwordFormSchema = z.object({ password: newPasswordSchema });
type PasswordForm = z.infer<typeof passwordFormSchema>;

/**
 * Sets a password from an emailed link: either a password reset or the first-time setup
 * of an invited account (approved agent or admin).
 */
export function SetPasswordForm({
  token,
  mode,
}: {
  token: string | null;
  mode: 'reset' | 'setup';
}) {
  const t = useTranslations(mode === 'reset' ? 'auth.resetPassword' : 'auth.setupAccount');
  const fields = useTranslations('auth.fields');
  const errorMessage = useErrorMessage();
  const form = useSchemaForm<PasswordForm>(passwordFormSchema, { password: '' });
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    if (!token) return;
    setError(null);
    try {
      const submit = mode === 'reset' ? authApi.resetPassword : authApi.setupAccount;
      await submit({ token, password });
      setDone(true);
    } catch (caught) {
      setError(caught);
    }
  });

  if (!token) return <FormAlert tone="error">{t('missingToken')}</FormAlert>;
  if (done) {
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
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      <FieldGroup>
        <FormField
          id="password"
          label={fields('newPassword')}
          description={fields('passwordHint', { min: AUTH_INPUT_LIMITS.passwordMinLength })}
          error={errors.password}
        >
          <PasswordInput
            {...fieldAria('password', errors.password, true)}
            autoComplete="new-password"
            {...form.register('password')}
          />
        </FormField>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {t('submit')}
      </Button>
    </form>
  );
}
