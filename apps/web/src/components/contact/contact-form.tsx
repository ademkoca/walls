'use client';

import type { Locale } from '@walls/shared';
import { type ContactData, contactFormSchema } from '@walls/validation';
import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { Textarea } from '@walls/ui/components/textarea';
import { CheckCircle2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { contactApi } from '@/lib/api/contact';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';

/**
 * The contact page form. The API emails it to the company inbox with replies going to the
 * visitor. `website` is a trap field that people never see and bots fill in.
 */
export function ContactForm() {
  const t = useTranslations('contact.form');
  const locale = useLocale() as Locale;
  const errorMessage = useErrorMessage();
  const empty: ContactData = { name: '', email: '', subject: '', message: '', locale, website: '' };
  const form = useSchemaForm<ContactData>(contactFormSchema, empty);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await contactApi.send(values);
      setSent({ name: values.name, email: values.email });
      form.reset(empty);
    } catch (caught) {
      setError(caught);
    }
  });

  if (sent) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon className="size-5 text-primary" aria-hidden />
          {t('sentTitle')}
        </p>
        <p className="text-sm text-muted-foreground">{t('sentDescription', sent)}</p>
        <Button type="button" variant="outline" onClick={() => setSent(null)}>
          {t('sendAnother')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      <FieldGroup className="gap-4">
        <FormField id="contact-name" label={t('fields.name')} error={errors.name}>
          <Input
            {...fieldAria('contact-name', errors.name)}
            autoComplete="name"
            {...form.register('name')}
          />
        </FormField>
        <FormField id="contact-email" label={t('fields.email')} error={errors.email}>
          <Input
            {...fieldAria('contact-email', errors.email)}
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </FormField>
        <FormField id="contact-subject" label={t('fields.subject')} error={errors.subject}>
          <Input {...fieldAria('contact-subject', errors.subject)} {...form.register('subject')} />
        </FormField>
        <FormField id="contact-message" label={t('fields.message')} error={errors.message}>
          <Textarea
            {...fieldAria('contact-message', errors.message)}
            rows={6}
            placeholder={t('messagePlaceholder')}
            {...form.register('message')}
          />
        </FormField>
      </FieldGroup>
      {/* Trap field: hidden from people and assistive technology, filled in by bots. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">{t('fields.website')}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register('website')}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {t('submit')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t('privacy')}{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          {t('privacyLink')}
        </Link>
      </p>
    </form>
  );
}
