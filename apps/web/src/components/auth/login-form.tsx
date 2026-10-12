'use client';

import { ApiErrorCode } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { type LoginInput, loginInputSchema } from '@walls/validation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';
import { DEFAULT_AFTER_LOGIN } from '@/lib/routes';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { PasswordInput } from '../forms/password-input';
import { useSchemaForm } from '../forms/use-schema-form';
import { ResendVerification } from './resend-verification';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const form = useSchemaForm<LoginInput>(loginInputSchema, { email: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setUnverifiedEmail(null);
    try {
      await authApi.login(values);
      router.replace(safeRedirectPath(next, DEFAULT_AFTER_LOGIN));
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === ApiErrorCode.EMAIL_NOT_VERIFIED) {
        setUnverifiedEmail(values.email);
      } else {
        setError(caught);
      }
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      {unverifiedEmail && (
        <div className="space-y-3">
          <FormAlert tone="error">{t('login.notVerified')}</FormAlert>
          <ResendVerification
            email={unverifiedEmail}
            label={t('login.resend')}
            sentMessage={t('login.resent')}
          />
        </div>
      )}
      <FieldGroup>
        <FormField id="email" label={t('fields.email')} error={errors.email}>
          <Input
            {...fieldAria('email', errors.email)}
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </FormField>
        <FormField id="password" label={t('fields.password')} error={errors.password}>
          <PasswordInput
            {...fieldAria('password', errors.password)}
            autoComplete="current-password"
            {...form.register('password')}
          />
        </FormField>
      </FieldGroup>
      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {t('login.submit')}
        </Button>
        <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
          {t('login.forgotPassword')}
        </Link>
      </div>
    </form>
  );
}
