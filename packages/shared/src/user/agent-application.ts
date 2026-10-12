const BYTES_PER_MB = 1024 * 1024;

/**
 * Supporting proof files of an agent application (SPEC §2.1): PDF, JPG or PNG, checked by
 * file content. The files are private: only Admins and Super Admins can open them.
 */
export const AGENT_PROOF_RULES = {
  allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 10 * BYTES_PER_MB,
  minFiles: 1,
  maxFiles: 5,
} as const;

export const FileIssue = {
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  EMPTY_FILE: 'EMPTY_FILE',
} as const;
export type FileIssue = (typeof FileIssue)[keyof typeof FileIssue];

/** Problems with one proof file, given its detected type (null when unrecognised). */
export function checkProofFile(file: { mimeType: string | null; bytes: number }): FileIssue[] {
  const issues: FileIssue[] = [];
  if (
    file.mimeType === null ||
    !(AGENT_PROOF_RULES.allowedMimeTypes as readonly string[]).includes(file.mimeType)
  ) {
    issues.push(FileIssue.UNSUPPORTED_TYPE);
  }
  if (file.bytes === 0) issues.push(FileIssue.EMPTY_FILE);
  if (file.bytes > AGENT_PROOF_RULES.maxBytes) issues.push(FileIssue.FILE_TOO_LARGE);
  return issues;
}
