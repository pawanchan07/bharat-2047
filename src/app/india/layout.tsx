import type { Metadata } from 'next';

/**
 * This deployment exists to show Bharat 2047, and the bare domain redirects here, so the
 * route carries its own identity rather than inheriting the IsoCity engine's, which is
 * what a shared link or a search result would otherwise show.
 */

const TITLE = "Bharat 2047: how India's civic systems should work";
const DESCRIPTION =
  'An explorable isometric town where the civic systems actually run: blockchain voting with real SHA-256 and proof-of-work, an AI panchayat whose classifier trains in your browser, and a bank a regulator can audit without being allowed to read it.';

export const metadata: Metadata = {
  metadataBase: new URL('https://bharat.pawanchander.com'),
  title: {
    absolute: TITLE,
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    siteName: 'Bharat 2047',
    url: '/india',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bharat 2047',
  },
};

export default function IndiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
