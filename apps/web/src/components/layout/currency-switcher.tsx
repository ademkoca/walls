'use client';

import { Currency, DEFAULT_DISPLAY_CURRENCY, enumValues } from '@walls/shared';
import { cn } from '@walls/ui/lib/utils';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE, parseCurrency } from '@/lib/currency';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCookie(): Currency {
  const entry = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CURRENCY_COOKIE}=`));
  return parseCurrency(entry?.slice(CURRENCY_COOKIE.length + 1));
}

function writeCookie(currency: Currency) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  for (const listener of listeners) listener();
}

/**
 * Switches the currency prices are shown in (SPEC §12). The choice is a preference cookie;
 * the page is then rendered again on the server with converted prices.
 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations('currency');
  const router = useRouter();
  const current = useSyncExternalStore(subscribe, readCookie, () => DEFAULT_DISPLAY_CURRENCY);

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn('flex items-center text-sm', className)}
    >
      {enumValues(Currency).map((currency, index) => (
        <span key={currency} className="flex items-center">
          {index > 0 && (
            <span aria-hidden className="px-1.5 text-muted-foreground">
              /
            </span>
          )}
          <button
            type="button"
            aria-pressed={currency === current}
            title={t(currency)}
            onClick={() => {
              if (currency === current) return;
              writeCookie(currency);
              router.refresh();
            }}
            className={cn(
              'rounded px-1 py-0.5 font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              currency === current ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {currency}
          </button>
        </span>
      ))}
    </div>
  );
}
