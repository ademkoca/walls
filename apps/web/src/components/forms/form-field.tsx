import { Field, FieldDescription, FieldError, FieldLabel } from '@walls/ui/components/field';
import type { ReactNode } from 'react';
import type { FieldError as HookFormError } from 'react-hook-form';

/** Label, control, optional hint and translated validation error for one form field. */
export function FormField({
  id,
  label,
  description,
  error,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  error?: HookFormError;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description && !error && (
        <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
      )}
      <FieldError id={`${id}-error`} errors={error ? [error] : undefined} />
    </Field>
  );
}

/** Accessibility attributes linking an input to its hint and error. */
export function fieldAria(id: string, error: HookFormError | undefined, hasHint = false) {
  const describedBy = [error ? `${id}-error` : null, hasHint && !error ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
}
