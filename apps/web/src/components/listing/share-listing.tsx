'use client';

import { Button } from '@walls/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@walls/ui/components/dropdown-menu';
import { LinkIcon, MessageCircleIcon, Share2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { SocialIcon } from '../brand/social-icon';

/**
 * Phones and tablets get the system share sheet, which offers the apps people actually use
 * (Viber, WhatsApp, Instagram…). Desktop browsers that have one offer only system apps, so they
 * get the menu instead.
 */
function hasShareSheet(): boolean {
  return typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Shares a listing page: the share sheet on touch devices, otherwise a menu. */
export function ShareListing({ title, url }: { title: string; url: string }) {
  const t = useTranslations('listing.share');
  const [open, setOpen] = useState(false);

  function onOpenChange(next: boolean) {
    if (next && hasShareSheet()) {
      navigator.share({ title, url }).catch((error: unknown) => {
        // Closing the sheet rejects with AbortError; any other failure falls back to the menu.
        if (!(error instanceof DOMException && error.name === 'AbortError')) setOpen(true);
      });
      return;
    }
    setOpen(next);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Share2Icon data-icon="inline-start" />
        {t('action')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem onClick={() => void copyLink()}>
          <LinkIcon />
          {t('copyLink')}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
              {...external}
            />
          }
        >
          <MessageCircleIcon />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
              {...external}
            />
          }
        >
          <SocialIcon network="facebook" />
          Facebook
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
