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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
