'use client';

import { type SubmissionIssue, SubmissionIssueCode } from '@walls/shared';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * What still blocks submission for review, computed with the shared rule
 * (`checkSubmissionRequirements`) from the current form values and images.
 */
export function SubmissionChecklist({ issues }: { issues: SubmissionIssue[] }) {
  const t = useTranslations('listings.editor.checklist');

  if (issues.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t('ready')}
      </p>
    );
  }

  // Latitude and longitude come from one map pin, so they are one item.
  const messages = [
    ...new Set(
      issues.map((issue) =>
        issue.code === SubmissionIssueCode.FLOOR_ABOVE_TOTAL_FLOORS
          ? t('floorAboveTotal')
          : t(`fields.${issue.field}`),
      ),
    ),
  ];

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-start gap-2">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        {t('missing')}
      </p>
      <ul className="list-disc space-y-1 pl-10 text-muted-foreground">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
