'use client';

import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { AUTH_INPUT_LIMITS, type RegisterInput, registerInputSchema } from '@walls/validation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { PasswordInput } from '../forms/password-input';
import { useSchemaForm } from '../forms/use-schema-form';
import { ResendVerification } from './resend-verification';

/** Private-seller registration (SPEC §3). There is no role choice; agents apply separately. */
export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const form = useSchemaForm<RegisterInput>(registerInputSchema, {
    displayName: '',
    email: '',
    password: '',
    locale,
  });
  const [error, setError] = useState<unknown>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authApi.register(values);
      setRegisteredEmail(values.email);
    } catch (caught) {
      setError(caught);
    }
  });

  if (registeredEmail) {
    return (
      <div className="space-y-4" aria-live="polite">
        <h2 className="text-lg font-semibold">{t('register.checkEmailTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('register.checkEmailDescription', { email: registeredEmail })}
        </p>
        <ResendVerification
          email={registeredEmail}
          label={t('register.resend')}
          sentMessage={t('register.resent')}
        />
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      <FieldGroup>
        <FormField id="displayName" label={t('fields.displayName')} error={errors.displayName}>
          <Input
            {...fieldAria('displayName', errors.displayName)}
            autoComplete="name"
            {...form.register('displayName')}
          />
        </FormField>
        <FormField id="email" label={t('fields.email')} error={errors.email}>
          <Input
            {...fieldAria('email', errors.email)}
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </FormField>
        <FormField
          id="password"
          label={t('fields.password')}
          description={t('fields.passwordHint', { min: AUTH_INPUT_LIMITS.passwordMinLength })}
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
        {t('register.submit')}
      </Button>
    </form>
  );
}
