'use client';

import { AVATAR_IMAGE_RULES, ApiErrorCode, type ImageIssue, type MyProfile } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/errors';
import { profileApi } from '@/lib/api/profile';
import { AVATAR_SHRINK, prepareImageForUpload } from '@/lib/shrink-image';
import { useErrorMessage } from '@/lib/use-error-message';
import { ProfileAvatar } from './profile-avatar';

const ACCEPT = AVATAR_IMAGE_RULES.allowedMimeTypes.join(',');

/** Uploads or removes the profile picture; agents' pictures wait for approval (SPEC §4). */
export function AvatarField({
  name,
  avatarUrl,
  awaitsApproval,
  onChange,
}: {
  name: string;
  avatarUrl: string | null;
  awaitsApproval: boolean;
  onChange: (profile: MyProfile) => void;
}) {
  const t = useTranslations('profile.avatar');
  const tImages = useTranslations('listings.editor.images.issues');
  const errorMessage = useErrorMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function describe(error: unknown): string {
    if (error instanceof ApiError && error.code === ApiErrorCode.INVALID_IMAGE) {
      const issues = (error.details as { issues?: ImageIssue[] } | undefined)?.issues ?? [];
      if (issues.length > 0)
        return `${errorMessage(error)} ${issues.map((issue) => tImages(issue)).join(', ')}`;
    }
    return errorMessage(error);
  }

  async function run(task: () => Promise<MyProfile>, success: string) {
    setBusy(true);
    try {
      onChange(await task());
      toast.success(success);
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ProfileAvatar name={name} url={avatarUrl} alt={t('alt', { name })} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {avatarUrl ? t('replace') : t('upload')}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => profileApi.removeAvatar(), t('removed'))}
            >
              {t('remove')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('rules')}</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={t('upload')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              void run(
                async () =>
                  profileApi.uploadAvatar(await prepareImageForUpload(file, AVATAR_SHRINK)),
                awaitsApproval ? t('uploadedForReview') : t('uploaded'),
              );
            }
          }}
        />
      </div>
    </div>
  );
}
