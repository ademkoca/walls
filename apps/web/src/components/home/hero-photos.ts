import type { StaticImageData } from 'next/image';
import livingRoom from '@/assets/hero/living-room.jpg';
import modernVilla from '@/assets/hero/modern-villa.jpg';
import savaRiversideWinter from '@/assets/hero/sava-riverside-winter.jpg';
import zemunRooftops from '@/assets/hero/zemun-rooftops.jpg';

/** How long each home page hero photo stays before fading to the next one. */
export const HERO_PHOTO_INTERVAL_MS = 5000;

export interface HeroPhoto {
  src: StaticImageData;
  /** CSS `object-position`: the part of the photo kept when the hero crops it. */
  position?: string;
  /** Where the photo came from. The Unsplash Licence does not require a visible credit. */
  credit: { photographer: string; url: string };
}

/**
 * The home page hero photos, shown in this order; the first loads with the page. Sources are
 * 2400 px JPEGs in `src/assets/hero`; Next.js serves resized copies.
 */
export const HERO_PHOTOS: readonly HeroPhoto[] = [
  {
    src: zemunRooftops,
    credit: { photographer: 'Nikola Ćirković', url: 'https://unsplash.com/photos/t0sXKOz9qtk' },
  },
  {
    src: modernVilla,
    position: '60% 40%',
    credit: { photographer: 'Yaroslav Alekseenko', url: 'https://unsplash.com/photos/_TPTXZd9mOo' },
  },
  {
    src: livingRoom,
    credit: { photographer: 'Clay Banks', url: 'https://unsplash.com/photos/7pvC_d2iXSE' },
  },
  {
    src: savaRiversideWinter,
    credit: { photographer: 'Ljubomir Žarković', url: 'https://unsplash.com/photos/xHnomVS0SiU' },
  },
];
