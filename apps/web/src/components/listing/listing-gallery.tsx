'use client';

import type { PublicListingImage } from '@walls/shared';
import { Button } from '@walls/ui/components/button';
import { cn } from '@walls/ui/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** The listing's photos: one large photo with previous/next buttons and thumbnails. */
export function ListingGallery({ images, title }: { images: PublicListingImage[]; title: string }) {
  const t = useTranslations('listing.gallery');
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = images[index];
  const go = (next: number) => setIndex((next + count) % count);

  if (!current) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageIcon className="size-10" aria-hidden />
      </div>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('label')}
      className="space-y-3"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') go(index - 1);
        if (event.key === 'ArrowRight') go(index + 1);
      }}
    >
      <div className="relative overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={t('alt', { title, index: index + 1 })}
          width={current.width ?? undefined}
          height={current.height ?? undefined}
          className="aspect-[16/10] w-full object-cover"
        />
        {count > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full"
              aria-label={t('previous')}
              onClick={() => go(index - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full"
              aria-label={t('next')}
              onClick={() => go(index + 1)}
            >
              <ChevronRightIcon />
            </Button>
            <p
              className="absolute right-3 bottom-3 rounded-md bg-foreground/80 px-2 py-1 text-xs font-medium text-background"
              aria-live="polite"
            >
              {t('position', { index: index + 1, count })}
            </p>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, position) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                aria-label={t('show', { index: position + 1 })}
                aria-current={position === index ? 'true' : undefined}
                onClick={() => setIndex(position)}
                className={cn(
                  'block overflow-hidden rounded-md border-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  position === index
                    ? 'border-primary'
                    : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" loading="lazy" className="h-16 w-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
