import { brand } from '@walls/ui/brand';
import horizontal from '@walls/ui/brand-assets/walls-logo-horizontal.svg';
import horizontalInverse from '@walls/ui/brand-assets/walls-logo-horizontal-inverse.svg';
import stacked from '@walls/ui/brand-assets/walls-logo-stacked.svg';
import stackedInverse from '@walls/ui/brand-assets/walls-logo-stacked-inverse.svg';
import { cn } from '@walls/ui/lib/utils';
import Image, { type StaticImageData } from 'next/image';

// Next.js types SVG imports as `any`; they are static image objects.
const LOGOS = {
  horizontal: {
    default: horizontal as StaticImageData,
    inverse: horizontalInverse as StaticImageData,
  },
  stacked: { default: stacked as StaticImageData, inverse: stackedInverse as StaticImageData },
};

interface LogoProps {
  /** Horizontal for headers; stacked where there is vertical room. */
  variant?: keyof typeof LOGOS;
  /** Inverse is for dark surfaces such as the footer. */
  tone?: 'default' | 'inverse';
  className?: string;
  priority?: boolean;
}

/** The brand logo, from the generated outlined SVGs (packages/ui/brand). */
export function Logo({ variant = 'horizontal', tone = 'default', className, priority }: LogoProps) {
  return (
    <Image
      src={LOGOS[variant][tone]}
      alt={`${brand.name} ${brand.descriptor}`}
      className={cn('h-auto', className)}
      {...(priority ? { priority } : {})}
    />
  );
}
