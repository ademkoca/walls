'use client';

import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { useErrorMessage } from '@/lib/use-error-message';

/** Logs out and goes to the home page; `onLoggedOut` runs before the navigation. */
export function useLogout(onLoggedOut?: () => void) {
  const router = useRouter();
  const errorMessage = useErrorMessage();

  return async function logout() {
    try {
      await authApi.logout();
      onLoggedOut?.();
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
}
