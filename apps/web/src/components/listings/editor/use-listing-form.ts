'use client';

import { listingInputSchema } from '@walls/validation';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { type FieldErrors, type Resolver, useForm } from 'react-hook-form';
import { useZodErrorMap } from '@/lib/use-zod-error-map';
import { type ListingFormValues, formPathFor, toListingInput } from './listing-form-model';

/** Sets `value` at a dotted path inside a nested errors object. */
function setAt(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    node[key] ??= {};
    node = node[key] as Record<string, unknown>;
  }
  const last = keys.at(-1)!;
  node[last] ??= value;
}

/**
 * The listing editor form. Validation runs the shared `listingInputSchema` (the same one the
 * API uses) on the PATCH body built from the form, and maps issues back to form fields.
 */
export function useListingForm(defaultValues: ListingFormValues) {
  const errorMap = useZodErrorMap();
  const t = useTranslations('listings.editor.checklist');
  const tValidation = useTranslations('validation');

  const resolver = useMemo<Resolver<ListingFormValues>>(
    () => (values) => {
      const result = listingInputSchema.safeParse(toListingInput(values), { error: errorMap });
      if (result.success) return { values, errors: {} };

      const errors: Record<string, unknown> = {};
      for (const issue of result.error.issues) {
        const path = formPathFor(issue.path);
        if (!path) continue;
        // Refinements carry English messages from the schema. The floor check has its own
        // text; the other one the form can trigger is the missing rental period.
        const message =
          issue.code !== 'custom'
            ? issue.message
            : path === 'attributes.floor'
              ? t('floorAboveTotal')
              : tValidation('required');
        setAt(errors, path, { type: issue.code, message });
      }
      return { values: {}, errors: errors as FieldErrors<ListingFormValues> };
    },
    [errorMap, t, tValidation],
  );

  return useForm<ListingFormValues>({ resolver, defaultValues, mode: 'onTouched' });
}
