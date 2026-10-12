import type messages from '../../messages/sr.json';
import type { routing } from './routing';

declare global {
  /** Shape of the translation catalogues; Serbian is the reference. */
  type IntlMessages = typeof messages;
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
