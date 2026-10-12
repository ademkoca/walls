import { describe, expect, it } from 'vitest';
import { AGENT_PROOF_RULES, FileIssue, checkProofFile } from './agent-application';

describe('agent proof files (SPEC §2.1)', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png'])('accepts %s', (mimeType) => {
    expect(checkProofFile({ mimeType, bytes: 1000 })).toEqual([]);
  });

  it.each(['image/webp', 'application/zip', null])('rejects the detected type %s', (mimeType) => {
    expect(checkProofFile({ mimeType, bytes: 1000 })).toEqual([FileIssue.UNSUPPORTED_TYPE]);
  });

  it('rejects empty and oversized files', () => {
    expect(checkProofFile({ mimeType: 'application/pdf', bytes: 0 })).toEqual([
      FileIssue.EMPTY_FILE,
    ]);
    expect(
      checkProofFile({ mimeType: 'application/pdf', bytes: AGENT_PROOF_RULES.maxBytes + 1 }),
    ).toEqual([FileIssue.FILE_TOO_LARGE]);
  });
});
