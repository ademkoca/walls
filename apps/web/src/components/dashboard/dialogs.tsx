'use client';

import { REASON_MAX_LENGTH, reasonSchema } from '@walls/validation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@walls/ui/components/alert-dialog';
import { Field, FieldError, FieldLabel } from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { Textarea } from '@walls/ui/components/textarea';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

interface DialogText {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface BaseProps extends DialogText {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destructive?: boolean;
  busy?: boolean;
}

/** Asks for confirmation before an action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  onConfirm,
}: BaseProps & { onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Asks for a written reason (rejections, deactivations). The reason is validated with the
 * same schema the API uses.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  destructive,
  busy,
  onConfirm,
}: BaseProps & { reasonLabel: string; onConfirm: (reason: string) => void }) {
  const tValidation = useTranslations('validation');
  const id = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = reasonSchema.safeParse(reason).success;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field data-invalid={touched && !valid ? true : undefined}>
          <FieldLabel htmlFor={id}>{reasonLabel}</FieldLabel>
          <Textarea
            id={id}
            rows={4}
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            aria-invalid={touched && !valid ? true : undefined}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          <FieldError
            errors={touched && !valid ? [{ message: tValidation('required') }] : undefined}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (valid) onConfirm(reason.trim());
            }}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** For irreversible actions: the user types `confirmWord` before confirming (SPEC §24). */
export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmWord,
  confirmWordLabel,
  busy,
  onConfirm,
}: BaseProps & { confirmWord: string; confirmWordLabel: string; onConfirm: () => void }) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === confirmWord;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={id}>{confirmWordLabel}</FieldLabel>
          <Input
            id={id}
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={!matches || busy} onClick={onConfirm}>
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
