'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { z } from 'zod';

type Issue = z.core.$ZodRawIssue;

/**
 * Translates Zod validation issues into the current language. Passed to the form
 * resolver so shared schemas (@walls/validation) produce localized messages.
 */
export function useZodErrorMap(): (issue: Issue) => string {
  const t = useTranslations('validation');
  return useCallback(
    (issue: Issue) => {
      switch (issue.code) {
        case 'too_small':
          return issue.origin === 'string' && Number(issue.minimum) > 1
            ? t('tooShort', { min: Number(issue.minimum) })
            : t('required');
        case 'too_big':
          return t('tooLong', { max: Number(issue.maximum) });
        case 'invalid_format':
          if (issue.input === '') return t('required');
          return issue.format === 'email' ? t('email') : t('invalid');
        case 'invalid_type':
          return issue.input === undefined ? t('required') : t('invalid');
        default:
          return t('invalid');
      }
    },
    [t],
  );
}
