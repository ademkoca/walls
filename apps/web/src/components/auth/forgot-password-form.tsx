'use client';

import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { type EmailRequestInput, emailRequestInputSchema } from '@walls/validation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const form = useSchemaForm<EmailRequestInput>(emailRequestInputSchema, { email: '' });
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (caught) {
      setError(caught);
    }
  });

  if (sent) return <FormAlert tone="success">{t('forgotPassword.sent')}</FormAlert>;

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      <FieldGroup>
        <FormField id="email" label={t('fields.email')} error={errors.email}>
          <Input
            {...fieldAria('email', errors.email)}
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </FormField>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {t('forgotPassword.submit')}
      </Button>
    </form>
  );
}
