import type { AgentApplicationFileView } from '@walls/shared';
import { FileTextIcon } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { agentApplicationsApi } from '@/lib/api/agent-applications';

const BYTES_PER_KB = 1024;

/** An agent application's private proof files; each opens in a new tab (admins only). */
export async function ProofFileList({
  applicationId,
  files,
}: {
  applicationId: string;
  files: readonly AgentApplicationFileView[];
}) {
  const t = await getTranslations('agentApplications');
  const format = await getFormatter();
  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.id}>
          <a
            href={agentApplicationsApi.fileUrl(applicationId, file.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('openFile', { name: file.fileName })}
            className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{file.fileName}</span>
            <span className="shrink-0 text-muted-foreground">
              {format.number(Math.ceil(file.bytes / BYTES_PER_KB))} KB
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
