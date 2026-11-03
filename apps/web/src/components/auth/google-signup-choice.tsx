'use client';

import { FOR_PROFESSIONALS_PATH, type GooglePendingSignup } from '@walls/shared';
import { Button, buttonVariants } from '@walls/ui/components/button';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { type GoogleSignupInput, googleSignupInputSchema } from '@walls/validation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/routes';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';
import { GoogleSignInButton } from './google-sign-in-button';

type Pending =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'failed'; error: unknown }
  | { status: 'ready'; signup: GooglePendingSignup };

/**
 * A Google account without a Walls account (SPEC §3.1): a private-seller account now, or the
 * professional application, which still needs Admin approval. Nothing is created until the
 * visitor chooses.
 */
export function GoogleSignupChoice() {
  const t = useTranslations('auth.continueWithGoogle');
  const tFields = useTranslations('auth.fields');
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState<Pending>({ status: 'loading' });
  const [error, setError] = useState<unknown>(null);
  const form = useSchemaForm<GoogleSignupInput>(googleSignupInputSchema, {
    displayName: '',
    locale,
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    let active = true;
    authApi.googlePending().then(
      (signup) => {
        if (!active) return;
        setPending(signup ? { status: 'ready', signup } : { status: 'none' });
        if (signup?.name) form.setValue('displayName', signup.name);
      },
      (caught: unknown) => {
        if (active) setPending({ status: 'failed', error: caught });
      },
    );
    return () => {
      active = false;
    };
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authApi.googleRegister(values);
      router.replace(DEFAULT_AFTER_LOGIN);
      router.refresh();
    } catch (caught) {
      setError(caught);
    }
  });

  if (pending.status === 'loading') {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (pending.status !== 'ready') {
    return (
      <div className="space-y-4">
        <FormAlert tone="error">
          {pending.status === 'failed' ? errorMessage(pending.error) : t('expired')}
        </FormAlert>
        <GoogleSignInButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('description', { email: pending.signup.email })}
      </p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4 border p-4">
        <div className="space-y-1">
          <h2 className="font-semibold">{t('sellerTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('sellerDescription')}</p>
        </div>
        {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
        <FormField id="displayName" label={tFields('displayName')} error={errors.displayName}>
          <Input
            {...fieldAria('displayName', errors.displayName)}
            autoComplete="name"
            {...form.register('displayName')}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {t('sellerSubmit')}
        </Button>
      </form>
      <div className="space-y-4 border p-4">
        <div className="space-y-1">
          <h2 className="font-semibold">{t('professionalTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('professionalDescription')}</p>
        </div>
        <Link
          href={{ pathname: FOR_PROFESSIONALS_PATH, query: { from: 'google' } }}
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}
        >
          {t('professionalLink')}
        </Link>
      </div>
    </div>
  );
}
