'use client';

import { AGENT_PROOF_RULES, ApiErrorCode, type FileIssue } from '@walls/shared';
import { type AgentApplicationInput, agentApplicationInputSchema } from '@walls/validation';
import { Button } from '@walls/ui/components/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@walls/ui/components/field';
import { Input } from '@walls/ui/components/input';
import { Spinner } from '@walls/ui/components/spinner';
import { FileTextIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { agentApplicationsApi } from '@/lib/api/agent-applications';
import { ApiError } from '@/lib/api/errors';
import { useErrorMessage } from '@/lib/use-error-message';
import { FormAlert } from '../forms/form-alert';
import { FormField, fieldAria } from '../forms/form-field';
import { useSchemaForm } from '../forms/use-schema-form';

const BYTES_PER_MB = 1024 * 1024;
const MAX_MB = AGENT_PROOF_RULES.maxBytes / BYTES_PER_MB;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png)$/i;

/** The API's per-file problems, from an INVALID_FILE error. */
function fileProblems(error: unknown): { name: string; issues: FileIssue[] }[] {
  if (!(error instanceof ApiError) || error.code !== ApiErrorCode.INVALID_FILE) return [];
  return (error.details as { files?: { name: string; issues: FileIssue[] }[] }).files ?? [];
}

/**
 * The "For real-estate agents" application (SPEC §2.1): professional details plus proof
 * files. The browser checks files for quick feedback; the API checks their content.
 */
export function AgentApplicationForm() {
  const t = useTranslations('agentApplication');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const filesId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useSchemaForm<AgentApplicationInput>(agentApplicationInputSchema, {
    fullName: '',
    email: '',
    phone: '',
    agencyName: '',
    locale: locale,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { errors, isSubmitting } = form.formState;

  function addFiles(selected: File[]) {
    const problems: string[] = [];
    const accepted = selected.filter((file) => {
      if (!ALLOWED_EXTENSIONS.test(file.name)) {
        problems.push(t('fileWrongType', { name: file.name }));
        return false;
      }
      if (file.size > AGENT_PROOF_RULES.maxBytes) {
        problems.push(t('fileTooLarge', { name: file.name, maxMb: MAX_MB }));
        return false;
      }
      return true;
    });
    const next = [...files, ...accepted];
    if (next.length > AGENT_PROOF_RULES.maxFiles) {
      problems.push(t('tooManyFiles', { max: AGENT_PROOF_RULES.maxFiles }));
    }
    setFiles(next.slice(0, AGENT_PROOF_RULES.maxFiles));
    setFileError(problems.length > 0 ? problems.join(' ') : null);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    if (files.length === 0) {
      setFileError(t('noFiles'));
      return;
    }
    const body = new FormData();
    for (const [name, value] of Object.entries(values)) body.append(name, value);
    for (const file of files) body.append('files', file, file.name);
    try {
      await agentApplicationsApi.submit(body);
      setSentTo(values.email);
    } catch (caught) {
      setError(caught);
    }
  });

  if (sentTo) {
    return (
      <div className="space-y-2" aria-live="polite">
        <h2 className="text-lg font-semibold">{t('successTitle')}</h2>
        <p className="text-muted-foreground">{t('successDescription', { email: sentTo })}</p>
      </div>
    );
  }

  const problems = fileProblems(error);

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-6">
      {error !== null && (
        <FormAlert tone="error">
          {errorMessage(error)}
          {problems.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem.name}>
                  {problem.name ? `${problem.name}: ` : ''}
                  {problem.issues.map((issue) => t(`fileIssues.${issue}`)).join(', ')}
                </li>
              ))}
            </ul>
          )}
        </FormAlert>
      )}
      <FieldGroup>
        <FormField id="fullName" label={t('fields.fullName')} error={errors.fullName}>
          <Input
            {...fieldAria('fullName', errors.fullName)}
            autoComplete="name"
            {...form.register('fullName')}
          />
        </FormField>
        <FormField
          id="email"
          label={t('fields.email')}
          description={t('fields.emailHint')}
          error={errors.email}
        >
          <Input
            {...fieldAria('email', errors.email, true)}
            type="email"
            autoComplete="email"
            {...form.register('email')}
          />
        </FormField>
        <FormField
          id="phone"
          label={t('fields.phone')}
          description={t('fields.phoneHint')}
          error={errors.phone}
        >
          <Input
            {...fieldAria('phone', errors.phone, true)}
            type="tel"
            autoComplete="tel"
            {...form.register('phone')}
          />
        </FormField>
        <FormField id="agencyName" label={t('fields.agencyName')} error={errors.agencyName}>
          <Input
            {...fieldAria('agencyName', errors.agencyName)}
            autoComplete="organization"
            {...form.register('agencyName')}
          />
        </FormField>

        <Field data-invalid={fileError ? true : undefined}>
          <FieldLabel htmlFor={filesId}>{t('fields.files')}</FieldLabel>
          <FieldDescription>
            {t('filesHint', { max: AGENT_PROOF_RULES.maxFiles, maxMb: MAX_MB })}
          </FieldDescription>
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                >
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('removeFile', { name: file.name })}
                    onClick={() => setFiles(files.filter((_, position) => position !== index))}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={files.length >= AGENT_PROOF_RULES.maxFiles}
              onClick={() => inputRef.current?.click()}
            >
              <PaperclipIcon data-icon="inline-start" />
              {t('chooseFiles')}
            </Button>
          </div>
          <input
            ref={inputRef}
            id={filesId}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={t('fields.files')}
            onChange={(event) => {
              const selected = [...(event.target.files ?? [])];
              event.target.value = '';
              addFiles(selected);
            }}
          />
          <FieldError errors={fileError ? [{ message: fileError }] : undefined} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        {t('submit')}
      </Button>
    </form>
  );
}
