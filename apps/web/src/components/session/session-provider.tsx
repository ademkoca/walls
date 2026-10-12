'use client';

import type { CurrentUser } from '@walls/shared';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

const STATUS_UNAUTHORIZED = 401;

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'anonymous'; user: null };

interface SessionContextValue {
  session: SessionState;
  /** Re-reads the session, e.g. after logging out elsewhere. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSession(signal?: AbortSignal): Promise<SessionState> {
  try {
    const { user } = await authApi.me(signal);
    return { status: 'authenticated', user };
  } catch (error) {
    if (!(error instanceof ApiError && error.status === STATUS_UNAUTHORIZED) && !signal?.aborted) {
      console.warn('Could not load the session', error);
    }
    return { status: 'anonymous', user: null };
  }
}

/**
 * Loads the signed-in user in the browser, so public pages can stay statically rendered
 * while the header still reflects the session. Authorization never relies on this: the
 * API checks every request.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading', user: null });

  useEffect(() => {
    const controller = new AbortController();
    void fetchSession(controller.signal).then((next) => {
      if (!controller.signal.aborted) setSession(next);
    });
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    setSession(await fetchSession());
  }, []);

  const value = useMemo(() => ({ session, refresh }), [session, refresh]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
