import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@walls/ui/components/accordion';
import { brand } from '@walls/ui/brand';
import { getTranslations } from 'next-intl/server';
import { jsonLd } from '@/lib/seo';

const QUESTIONS = [
  'free',
  'agentRequired',
  'review',
  'editPublished',
  'phonePublic',
  'currency',
] as const;

/** Frequently asked questions, with FAQPage structured data (SPEC §32). */
export async function HomeFaq() {
  const t = await getTranslations('home.faq');
  const question = (key: (typeof QUESTIONS)[number]) =>
    t(`items.${key}.question`, { brand: brand.name });
  const entities = QUESTIONS.map((key) => ({
    '@type': 'Question',
    name: question(key),
    acceptedAnswer: { '@type': 'Answer', text: t(`items.${key}.answer`) },
  }));

  return (
    <section aria-labelledby="home-faq" className="space-y-6">
      <script
        type="application/ld+json"
        // JSON-LD, escaped by jsonLd() so the text cannot close the script tag.
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: entities,
          }),
        }}
      />
      <h2 id="home-faq" className="text-2xl font-semibold tracking-tight">
        {t('title')}
      </h2>
      <Accordion>
        {QUESTIONS.map((key) => (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger>{question(key)}</AccordionTrigger>
            <AccordionContent>{t(`items.${key}.answer`)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
