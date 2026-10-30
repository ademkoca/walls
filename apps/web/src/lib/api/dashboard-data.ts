import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { NotAccessibleError } from './server';

/**
 * Loads a dashboard page's data. A signed-out visitor is sent to log in and back to `page`:
 * the dashboard layout checks the session only when it renders, and Next.js keeps it when
 * moving between dashboard pages, so a session that ended in another tab is noticed here.
 * When the API answers "not yours" or "doesn't exist", the page is a 404.
 */
export async function dashboardData<T>(request: Promise<T | null>, page: string): Promise<T> {
  let data: T | null;
  try {
    data = await request;
  } catch (error) {
    if (error instanceof NotAccessibleError) notFound();
    throw error;
  }
  if (data === null) {
    return redirect({
      href: { pathname: '/login', query: { next: page } },
      locale: await getLocale(),
    });
  }
  return data;
}
