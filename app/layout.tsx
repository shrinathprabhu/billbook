import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';
import {
  BASE_PATH,
  SITE_URL,
  TITLE,
  DESCRIPTION,
  OG_IMAGE,
} from '@/lib/site.mjs';
export const viewport: Viewport = { themeColor: '#227852' };
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Billbook',
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  creator: 'Shrinath Prabhu',
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
    types: { 'text/markdown': `${SITE_URL}/index.md` },
  },
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon.svg`, type: 'image/svg+xml' },
      { url: `${BASE_PATH}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: `${BASE_PATH}/apple-touch-icon.png`, sizes: '180x180' },
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Billbook by Lowkey Tools',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
  appleWebApp: { capable: true, title: 'Billbook', statusBarStyle: 'default' },
  category: 'business',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="describedby"
          href={`${SITE_URL}/llms.txt`}
          type="text/plain"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to bill generator
        </a>
        {children}
      </body>
    </html>
  );
}
