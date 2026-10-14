'use client';

import { Button } from '@walls/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@walls/ui/components/dialog';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ViewerImage {
  url: string;
  alt: string;
}

/**
 * Shows one photo at full size on a dark background, with previous/next buttons and the
 * arrow keys to move through the set. Open when `index` is a position; Escape or the close
 * button calls `onClose`.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ViewerImage[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('imageViewer');
  const count = images.length;
  const current = index === null ? undefined : images[index];
  const go = (next: number) => onIndexChange((next + count) % count);

  return (
    <Dialog open={current !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-3 right-3 bottom-3 left-3 grid h-auto w-auto max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 bg-black p-0 text-white ring-0 sm:max-w-none"
        onKeyDown={(event) => {
          if (count < 2 || index === null) return;
          if (event.key === 'ArrowLeft') go(index - 1);
          if (event.key === 'ArrowRight') go(index + 1);
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <DialogTitle className="text-sm font-medium text-white">
            {t('title', { position: (index ?? 0) + 1, count })}
          </DialogTitle>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15 hover:text-white"
              />
            }
          >
            <XIcon />
            <span className="sr-only">{t('close')}</span>
          </DialogClose>
        </div>
        <div className="relative flex min-h-0 items-center justify-center px-2 pb-2 sm:px-14">
          {current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-full max-w-full rounded object-contain"
            />
          )}
          {count > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-white/25 hover:text-white"
                aria-label={t('previous')}
                onClick={() => index !== null && go(index - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-white/25 hover:text-white"
                aria-label={t('next')}
                onClick={() => index !== null && go(index + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
