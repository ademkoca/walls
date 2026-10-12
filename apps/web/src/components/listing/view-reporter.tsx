'use client';

import { useEffect, useRef } from 'react';
import { inquiriesApi } from '@/lib/api/inquiries';

/**
 * Reports a view of the listing page from the browser (SPEC §23), so server renders and
 * link prefetches are never counted. The API decides whether the view counts.
 */
export function ViewReporter({ slug }: { slug: string }) {
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (reported.current === slug) return;
    reported.current = slug;
    inquiriesApi.reportView(slug).catch(() => {
      // Counting views must never disturb the visitor.
    });
  }, [slug]);
  return null;
}
