import { getTranslations } from 'next-intl/server';

const STEPS = ['list', 'review', 'publish'] as const;

/** Three-step seller journey, right before the call to list a property (SPEC §6, §39). */
export async function HowItWorks() {
  const t = await getTranslations('home.howItWorks');

  return (
    <section aria-labelledby="how-it-works" className="space-y-6">
      <h2 id="how-it-works" className="text-4xl">
        {t('title')}
      </h2>
      <ol className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-col gap-2">
            <span
              className="flex size-9 shrink-0 items-center justify-center border-2 border-foreground font-mono text-sm font-semibold"
              aria-hidden
            >
              {index + 1}
            </span>
            <h3 className="font-semibold">{t(`steps.${step}.title`)}</h3>
            <p className="text-sm text-muted-foreground">{t(`steps.${step}.text`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
