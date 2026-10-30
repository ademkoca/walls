'use client';

import { Button } from '@walls/ui/components/button';
import { Input } from '@walls/ui/components/input';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';

/** Password input with a show/hide toggle (instead of a "confirm password" field). */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const t = useTranslations('auth.fields');
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 right-1 my-auto"
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  );
}
