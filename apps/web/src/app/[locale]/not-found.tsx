import { buttonVariants } from '@walls/ui/components/button';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/brand/logo';

export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo variant="stacked" className="w-28" />
      <h1 className="text-3xl font-semibold tracking-tight">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.description')}</p>
      <Link href="/" className={buttonVariants({ size: 'lg' })}>
        {t('common.backToHome')}
      </Link>
    </main>
  );
}
