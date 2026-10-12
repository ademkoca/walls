'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type DefaultValues, type FieldValues, type Resolver, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useZodErrorMap } from '@/lib/use-zod-error-map';

/**
 * React Hook Form bound to a shared @walls/validation schema, so the browser validates
 * exactly what the API validates, with messages in the current language.
 */
export function useSchemaForm<T extends FieldValues>(
  schema: z.ZodType<T, T>,
  defaultValues: DefaultValues<T>,
) {
  const error = useZodErrorMap();
  return useForm<T>({
    resolver: zodResolver(schema, { error }) as Resolver<T>,
    defaultValues,
    mode: 'onTouched',
  });
}
