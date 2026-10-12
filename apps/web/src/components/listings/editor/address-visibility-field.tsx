'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@walls/ui/components/alert-dialog';
import { Label } from '@walls/ui/components/label';
import { Switch } from '@walls/ui/components/switch';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { ListingFormValues } from './listing-form-model';

/**
 * Exact address visibility (SPEC §13). Hidden by default; turning it on requires confirming
 * that the street address and map location become visible to everyone.
 */
export function AddressVisibilityField({ editable }: { editable: boolean }) {
  const t = useTranslations('listings.editor');
  const { control } = useFormContext<ListingFormValues>();
  const [confirming, setConfirming] = useState(false);

  return (
    <Controller
      control={control}
      name="isExactAddressPublic"
      render={({ field }) => (
        <>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Switch
              id="isExactAddressPublic"
              checked={field.value}
              disabled={!editable}
              onCheckedChange={(checked) => {
                if (checked) setConfirming(true);
                else field.onChange(false);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="isExactAddressPublic">{t('address.public')}</Label>
              <p className="text-sm text-muted-foreground">{t('address.publicHint')}</p>
            </div>
          </div>
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('address.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('address.confirmDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    field.onChange(true);
                    setConfirming(false);
                  }}
                >
                  {t('address.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    />
  );
}
