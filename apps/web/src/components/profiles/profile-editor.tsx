'use client';

import {
  type MyProfile,
  type ProfileView,
  ReviewStatus,
  hasAgencyName,
  isPhoneAlwaysPublic,
} from '@walls/shared';
import { type ProfileInput, PROFILE_INPUT_LIMITS, profileInputSchema } from '@walls/validation';
import { Alert, AlertDescription, AlertTitle } from '@walls/ui/components/alert';
import { Button, buttonVariants } from '@walls/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@walls/ui/components/card';
import { FieldGroup } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Label } from '@walls/ui/components/label';
import { Spinner } from '@walls/ui/components/spinner';
import { Switch } from '@walls/ui/components/switch';
import { Textarea } from '@walls/ui/components/textarea';
import { CircleAlertIcon, ExternalLinkIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/dashboard/dialogs';
import { Link, useRouter } from '@/i18n/navigation';
import { profileApi } from '@/lib/api/profile';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';
import { AvatarField } from './avatar-field';
import { EmailChangeCard } from './email-change-card';
import { QuotedText } from '@/components/dashboard/quoted-text';

/** The version the form edits: the pending proposal when there is one, else the live profile. */
function editedVersion(profile: MyProfile): ProfileView {
  return profile.changeRequest?.status === ReviewStatus.PENDING
    ? profile.changeRequest.proposed
    : profile.live;
}

function toInput(view: ProfileView): ProfileInput {
  return {
    displayName: view.displayName,
    bio: view.bio ?? '',
    agencyName: view.agencyName ?? '',
    phone: view.phone ?? '',
    isPhonePublic: view.isPhonePublic,
    isEmailPublic: view.isEmailPublic,
  };
}

/**
 * The signed-in seller's or agent's profile (SPEC §4). Sellers' changes apply at once;
 * agents' changes go to a single pending request that an Admin reviews.
 */
export function ProfileEditor({ initialProfile }: { initialProfile: MyProfile }) {
  const t = useTranslations('profile');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const form = useSchemaForm<ProfileInput>(profileInputSchema, toInput(editedVersion(profile)));
  const { errors, isDirty, isSubmitting } = form.formState;

  const needsApproval = profile.changesRequireApproval;
  const request = profile.changeRequest;
  const pending = request?.status === ReviewStatus.PENDING;
  const displayed = editedVersion(profile);

  function apply(next: MyProfile) {
    setProfile(next);
    form.reset(toInput(editedVersion(next)));
    router.refresh();
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const next = await profileApi.update(values);
      apply(next);
      const sentForReview = next.changeRequest?.status === ReviewStatus.PENDING;
      toast.success(needsApproval && sentForReview ? t('sentForReview') : t('saved'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  async function discard() {
    setDiscarding(true);
    try {
      apply(await profileApi.discardChanges());
      setConfirmDiscard(false);
      toast.success(t('discarded'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {profile.publicPath && (
          <Link
            href={profile.publicPath}
            className={buttonVariants({ variant: 'outline' })}
            target="_blank"
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {t('viewPublic')}
          </Link>
        )}
      </div>

      {needsApproval && !pending && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{t('approvalNotice')}</AlertDescription>
        </Alert>
      )}
      {pending && (
        <Alert>
          <InfoIcon />
          <AlertDescription className="space-y-3">
            <p>{t('pendingNotice')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDiscard(true)}
            >
              {t('discard')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {request?.status === ReviewStatus.REJECTED && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{t('rejectedNotice')}</AlertTitle>
          <AlertDescription>
            {request.rejectionReason && <QuotedText text={request.rejectionReason} />}
          </AlertDescription>
        </Alert>
      )}

      <Section title={t('sections.picture')}>
        <AvatarField
          name={displayed.displayName}
          avatarUrl={displayed.avatarUrl}
          awaitsApproval={needsApproval}
          onChange={apply}
        />
      </Section>

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
        <Section title={t('sections.public')}>
          <FieldGroup>
            <FormField id="displayName" label={t('fields.displayName')} error={errors.displayName}>
              <Input
                {...fieldAria('displayName', errors.displayName)}
                autoComplete="name"
                {...form.register('displayName')}
              />
            </FormField>
            {hasAgencyName(profile.sellerType) && (
              <FormField id="agencyName" label={t('fields.agencyName')} error={errors.agencyName}>
                <Input
                  {...fieldAria('agencyName', errors.agencyName)}
                  autoComplete="organization"
                  {...form.register('agencyName')}
                />
              </FormField>
            )}
            <FormField
              id="bio"
              label={t('fields.bio')}
              description={t('fields.bioHint')}
              error={errors.bio}
            >
              <Textarea
                {...fieldAria('bio', errors.bio, true)}
                rows={5}
                maxLength={PROFILE_INPUT_LIMITS.bioMaxLength}
                {...form.register('bio')}
              />
            </FormField>
          </FieldGroup>
        </Section>

        <Section title={t('sections.contact')}>
          <FieldGroup>
            <FormField id="phone" label={t('fields.phone')} error={errors.phone}>
              <Input
                {...fieldAria('phone', errors.phone)}
                type="tel"
                autoComplete="tel"
                className="max-w-xs"
                {...form.register('phone')}
              />
            </FormField>
            {isPhoneAlwaysPublic(profile.role) ? (
              <p className="text-sm text-muted-foreground">{t('fields.phoneAlwaysPublic')}</p>
            ) : (
              <SwitchField
                name="isPhonePublic"
                label={t('fields.phonePublic')}
                control={form.control}
              />
            )}
            <SwitchField
              name="isEmailPublic"
              label={t('fields.emailPublic')}
              control={form.control}
            />
          </FieldGroup>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {needsApproval ? t('submitForReview') : t('save')}
          </Button>
        </div>
      </form>

      <Section title={t('sections.email')}>
        <EmailChangeCard profile={profile} onChange={apply} />
      </Section>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discard')}
        cancelLabel={t('cancel')}
        destructive
        busy={discarding}
        onConfirm={() => void discard()}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SwitchField({
  name,
  label,
  control,
}: {
  name: 'isPhonePublic' | 'isEmailPublic';
  label: string;
  control: ReturnType<typeof useSchemaForm<ProfileInput>>['control'];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-3">
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} />
          <Label htmlFor={name}>{label}</Label>
        </div>
      )}
    />
  );
}
