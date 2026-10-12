'use client';

import { Button } from '@walls/ui/components/button';
import { Spinner } from '@walls/ui/components/spinner';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { listingsApi } from '@/lib/api/listings';
import { useErrorMessage } from '@/lib/use-error-message';

/** Creates an empty draft and opens it in the editor. */
export function NewListingButton() {
  const t = useTranslations('listings');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const { id } = await listingsApi.create();
      router.push(`/dashboard/listings/${id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  return (
    <Button type="button" disabled={creating} onClick={() => void create()}>
      {creating ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
      {t('new')}
    </Button>
  );
}
