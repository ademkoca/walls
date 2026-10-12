import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { brand } from '@walls/ui/brand';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl),
  title: brand.name,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
