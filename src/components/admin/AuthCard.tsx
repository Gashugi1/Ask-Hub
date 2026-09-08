import Link from 'next/link';
import { t } from '@/lib/i18n';

/**
 * The prototype's signed-out shell (docs/prototype/prototype.html lines
 * 634-664): a 420px card centred on a #F4F6F9 field, under the wordmark with
 * its accent dot and a "team admin" note, with a route back to the public site
 * beneath.
 *
 * It exists as a component because two screens wear it -- sign-in, and
 * set-password, which has no counterpart in the prototype at all and is
 * styled by analogy with sign-in (spec: the plan's one sanctioned
 * extrapolation). Transcribing the same measurements twice is how those two
 * would come to disagree; sharing them is what makes "reads as the same
 * family" a fact rather than an intention.
 *
 * Deliberately carries no 'use client' and imports nothing server-only, so
 * either kind of component can render it.
 */
export default function AuthCard({
  heading,
  intro,
  children,
  footer,
}: {
  heading: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F4F6F9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div style={{ width: 420, maxWidth: '100%' }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            justifyContent: 'center',
            marginBottom: 26,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#1F5FBF',
              letterSpacing: '-0.02em',
            }}
          >
            {t('site.wordmark')}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: 'var(--acc, #F06428)',
            }}
          />
          <span style={{ fontSize: 12, color: '#5B6B8C' }}>{t('admin.login.teamAdmin')}</span>
        </Link>

        <div
          style={{
            background: '#fff',
            border: '1px solid #DDE5EE',
            borderRadius: 16,
            padding: 30,
            boxShadow: '0 10px 30px rgba(20,32,60,0.06)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{heading}</h1>
          {intro ? (
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#5B6B8C' }}>{intro}</p>
          ) : null}
          {children}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link
            href="/"
            className="proto-back-link"
            style={{ color: '#5B6B8C', fontSize: 13, fontWeight: 600 }}
          >
            {t('admin.login.backToSite')}
          </Link>
        </div>

        {footer}
      </div>
    </main>
  );
}

/** Prototype line 647: uppercase micro-label above each field. */
export const FIELD_LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
} as const;

/** Prototype line 648. */
export const FIELD = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #C9D3E8',
  borderRadius: 9,
  fontSize: 14,
  color: '#1A2332',
  outline: 'none',
} as const;

/** Prototype line 656: the card's full-width primary action. */
export const CARD_BUTTON = {
  marginTop: 16,
  width: '100%',
  background: '#1F5FBF',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: 13,
  fontSize: 14.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;
