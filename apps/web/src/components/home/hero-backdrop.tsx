'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { HERO_PHOTOS, HERO_PHOTO_INTERVAL_MS } from './hero-photos';

/**
 * The home page hero's background: the hero photos, cross-fading every few seconds. Purely
 * decorative. It stays on the first photo for visitors who ask for reduced motion, and does not
 * advance while the tab is hidden.
 */
export function HeroBackdrop() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (HERO_PHOTOS.length < 2) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setInterval(() => {
      if (document.hidden || reducedMotion.matches) return;
      setActive((index) => (index + 1) % HERO_PHOTOS.length);
    }, HERO_PHOTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div aria-hidden className="absolute inset-0">
      {HERO_PHOTOS.map((photo, index) => (
        <Image
          key={photo.src.src}
          src={photo.src}
          alt=""
          fill
          sizes="100vw"
          {...(index === 0 ? { preload: true, placeholder: 'blur' as const } : {})}
          data-active={index === active || undefined}
          className="object-cover opacity-0 transition-opacity duration-1000 ease-in-out data-active:opacity-100 motion-reduce:transition-none"
          style={photo.position ? { objectPosition: photo.position } : undefined}
        />
      ))}
    </div>
  );
}
