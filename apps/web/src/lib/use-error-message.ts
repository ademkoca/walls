'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError, NetworkError } from './api/errors';

/** Turns any thrown error into a translated, user-facing message. */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) return t(error.code);
      if (error instanceof NetworkError) return t('network');
      return t('INTERNAL_ERROR');
    },
    [t],
  );
}
