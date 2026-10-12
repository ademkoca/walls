import { Alert, AlertDescription } from '@walls/ui/components/alert';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Form-level message: an error from the API, or a success confirmation. */
export function FormAlert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <Alert
      variant={tone === 'error' ? 'destructive' : 'default'}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {tone === 'error' ? <CircleAlertIcon /> : <CircleCheckIcon />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
