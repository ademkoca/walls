import { getTranslations } from 'next-intl/server';

export const MAIN_CONTENT_ID = 'main-content';

/** Lets keyboard users jump past the header (visible only when focused). */
export async function SkipLink() {
  const t = await getTranslations('common');
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
    >
      {t('skipToContent')}
    </a>
  );
}
