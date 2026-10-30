import { cn } from '@walls/ui/lib/utils';
import { useTranslations } from 'next-intl';

/**
 * Words someone wrote, such as a reviewer's rejection reason: quoted and in italics, so they
 * stand apart from Walls' own text around them.
 */
export function QuotedText({ text, className }: { text: string; className?: string }) {
  const t = useTranslations('common');
  return <p className={cn('whitespace-pre-line italic', className)}>{t('quoted', { text })}</p>;
}
