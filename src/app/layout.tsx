import type { Metadata } from 'next';
import './globals.css';
import { t } from '@/lib/i18n';

export const metadata: Metadata = {
  // From the locale file, not inline: <title> and <meta description> are
  // user-facing. SP1 Task 2 adds the self-hosted Outfit preload below.
  title: t('site.name'),
  description: t('site.tagline'),
  // Design doc 5.7: this build ships behind Vercel Deployment Protection
  // with no CSP, no Turnstile and no rate limiting. It must not be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Self-hosted Outfit (SP1 Task 2): preloaded to protect LCP since
            it is the body font. Self-hosted rather than loaded from
            Google's font CDN, to keep that round trip off the critical
            rendering path — see globals.css and the design doc. */}
        <link
          rel="preload"
          href="/fonts/outfit-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
