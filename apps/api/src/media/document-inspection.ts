const SIGNATURES: readonly { mimeType: string; bytes: readonly number[] }[] = [
  { mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/**
 * Detects a document's type from its first bytes (file signature), never from the
 * client-supplied name or type (SPEC §37). Returns null for anything unrecognised.
 */
export function detectDocumentType(data: Buffer): string | null {
  const match = SIGNATURES.find(({ bytes }) => bytes.every((byte, index) => data[index] === byte));
  return match?.mimeType ?? null;
}

/** The extension stored with a document of a detected type. */
export const DOCUMENT_EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
