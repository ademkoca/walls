import { getTranslations } from 'next-intl/server';

/** Placeholder for public pages that later phases build out. */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations('placeholder');
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg font-medium">{t('title')}</p>
      <p className="mt-2 text-muted-foreground">{t('description')}</p>
    </section>
  );
}
