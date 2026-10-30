'use client';

import { Button, buttonVariants } from '@walls/ui/components/button';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';

/** Shown instead of Next.js's generic error screen when a page fails unexpectedly. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo variant="stacked" className="w-28" />
      <h1 className="text-3xl font-semibold tracking-tight">{t('pageError.title')}</h1>
      <p className="text-muted-foreground">{t('pageError.description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          {t('pageError.retry')}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          {t('common.backToHome')}
        </Link>
      </div>
    </main>
  );
}
