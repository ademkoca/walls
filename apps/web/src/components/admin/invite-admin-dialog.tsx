'use client';

import { Locale, enumValues } from '@walls/shared';
import { type InviteAdminInput, inviteAdminInputSchema } from '@walls/validation';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@walls/ui/components/alert-dialog';
import { Button } from '@walls/ui/components/button';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { UserPlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField, fieldAria } from '@/components/forms/form-field';
import { useSchemaForm } from '@/components/forms/use-schema-form';
import { EnumSelect } from '@/components/listings/editor/enum-select';
import { useRouter } from '@/i18n/navigation';
import { usersApi } from '@/lib/api/users';
import { useErrorMessage } from '@/lib/use-error-message';

/** Super Admin: invite an Admin, who sets their own password from the emailed link. */
export function InviteAdminDialog() {
  const t = useTranslations('users');
  const tLanguage = useTranslations('language');
  const tReview = useTranslations('review');
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const form = useSchemaForm<InviteAdminInput>(inviteAdminInputSchema, {
    email: '',
    displayName: '',
    locale,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await usersApi.inviteAdmin(values);
      toast.success(t('invited'));
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <UserPlusIcon data-icon="inline-start" />
        {t('invite')}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('inviteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('inviteDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <FieldGroup>
              <FormField id="invite-name" label={t('inviteName')} error={errors.displayName}>
                <Input
                  {...fieldAria('invite-name', errors.displayName)}
                  autoComplete="off"
                  {...form.register('displayName')}
                />
              </FormField>
              <FormField id="invite-email" label={t('inviteEmail')} error={errors.email}>
                <Input
                  {...fieldAria('invite-email', errors.email)}
                  type="email"
                  autoComplete="off"
                  {...form.register('email')}
                />
              </FormField>
              <Controller
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <FormField id="invite-locale" label={t('inviteLanguage')}>
                    <EnumSelect
                      id="invite-locale"
                      value={field.value}
                      onChange={(value) => field.onChange(value || field.value)}
                      placeholder={t('inviteLanguage')}
                      options={enumValues(Locale).map((value) => ({
                        value,
                        label: tLanguage(value),
                      }))}
                    />
                  </FormField>
                )}
              />
            </FieldGroup>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">{tReview('cancel')}</AlertDialogCancel>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {t('inviteSubmit')}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
