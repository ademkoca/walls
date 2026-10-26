'use client';

import { keepsSentInquiries } from '@walls/shared';
import { type InquiryData, inquiryFormSchema } from '@walls/validation';
import { Button, buttonVariants } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { Textarea } from '@walls/ui/components/textarea';
import { CheckCircle2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { inquiriesApi } from '@/lib/api/inquiries';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';
import { useSession } from '../session/session-provider';

const EMPTY: InquiryData = { name: '', email: '', phone: '', message: '', website: '' };

/**
 * The visitor's message to the advertiser (SPEC §20); no account needed. The API decides
 * who receives it. `website` is a trap field that people never see and bots fill in.
 *
 * Signed-in private sellers and agents send under their account (the API uses the
 * account's name and email) and find the inquiry under "Sent" in their dashboard. The
 * listing's own seller or agent sees a note instead of the form.
 */
export function InquiryForm({
  slug,
  recipientName,
  ownerSlugs,
}: {
  slug: string;
  recipientName: string;
  /** Public profile slugs of the advertiser and the assigned agent. */
  ownerSlugs: string[];
}) {
  const t = useTranslations('inquiry');
  const errorMessage = useErrorMessage();
  const { session } = useSession();
  const form = useSchemaForm<InquiryData>(inquiryFormSchema, EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;
  const user = session.status === 'authenticated' ? session.user : null;
  const account = user && keepsSentInquiries(user.role) ? user : null;

  // The account's name and email stand in for the hidden fields (the API uses them anyway).
  useEffect(() => {
    if (!account) return;
    form.setValue('name', account.displayName);
    form.setValue('email', account.email);
  }, [account, form]);

  if (user && ownerSlugs.includes(user.slug)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('ownListing')}</p>
        <Link href="/dashboard/inquiries" className={buttonVariants({ variant: 'outline' })}>
          {t('openInquiries')}
        </Link>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await inquiriesApi.send(slug, values);
      setSentTo(values.email);
      form.reset(account ? { ...EMPTY, name: account.displayName, email: account.email } : EMPTY);
    } catch (caught) {
      setError(caught);
    }
  });

  if (sentTo) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon className="size-5 text-emphasis" aria-hidden />
          {t('sentTitle')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('sentDescription', { name: recipientName, email: sentTo })}
        </p>
        {account && (
          <p className="text-sm text-muted-foreground">
            {t('sentHistory')}{' '}
            <Link
              href="/dashboard/inquiries/sent"
              className="font-medium underline-offset-4 hover:underline"
            >
              {t('viewSent')}
            </Link>
          </p>
        )}
        <Button type="button" variant="outline" onClick={() => setSentTo(null)}>
          {t('sendAnother')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('to', { name: recipientName })}</p>
      {error !== null && <FormAlert tone="error">{errorMessage(error)}</FormAlert>}
      {account && (
        <p className="text-sm">
          {t('sendingAs', { name: account.displayName, email: account.email })}
        </p>
      )}
      <FieldGroup className="gap-4">
        {!account && (
          <>
            <FormField id="inquiry-name" label={t('fields.name')} error={errors.name}>
              <Input
                {...fieldAria('inquiry-name', errors.name)}
                autoComplete="name"
                {...form.register('name')}
              />
            </FormField>
            <FormField id="inquiry-email" label={t('fields.email')} error={errors.email}>
              <Input
                {...fieldAria('inquiry-email', errors.email)}
                type="email"
                autoComplete="email"
                {...form.register('email')}
              />
            </FormField>
          </>
        )}
        <FormField id="inquiry-phone" label={t('fields.phone')} error={errors.phone}>
          <Input
            {...fieldAria('inquiry-phone', errors.phone)}
            type="tel"
            autoComplete="tel"
            {...form.register('phone')}
          />
        </FormField>
        <FormField id="inquiry-message" label={t('fields.message')} error={errors.message}>
          <Textarea
            {...fieldAria('inquiry-message', errors.message)}
            rows={5}
            placeholder={t('messagePlaceholder')}
            {...form.register('message')}
          />
        </FormField>
      </FieldGroup>
      {/* Trap field: hidden from people and assistive technology, filled in by bots. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="inquiry-website">{t('fields.website')}</label>
        <input
          id="inquiry-website"
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
      <p className="text-xs text-muted-foreground">{t('privacy')}</p>
    </form>
  );
}
