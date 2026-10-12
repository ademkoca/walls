/**
 * Accepts only same-site relative paths for post-login redirects, so a crafted
 * `?next=https://evil.example` or `//evil.example` link cannot send users elsewhere.
 */
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
