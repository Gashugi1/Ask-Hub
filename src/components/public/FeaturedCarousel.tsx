'use client';

import { useState } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { sortResources } from '@/lib/public/filters';
import { deadlineLabel } from '@/lib/public/deadline-label';
import type { PublicResource } from '@/lib/public/types';
import PartnerLogo, { LOGO_ON_FEATURED } from './PartnerLogo';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 85-129: one large featured card -- a need-coloured banner on the left
 * carrying the partner and title, details on the right -- with a row of dots
 * beneath it to move between the featured resources.
 *
 * This replaces a horizontally scrolling rail of small cards. The note that
 * rail carried is still honoured: PRD 5.1 item 5, and auto-advance is a WCAG
 * 2.2.2 problem that hides content from anyone not watching. **The prototype's
 * dots do not auto-advance either** -- each is a button that moves to its own
 * slide (reference line 122) -- so matching the prototype and avoiding
 * auto-advance turn out to be the same design, and nothing is given up by
 * transcribing it.
 *
 * With one card shown at a time, the dots are the only way to reach the
 * others, so they are real buttons with accessible names rather than the bare
 * decorative spans the prototype uses.
 *
 * **The banner colour is the need's, not the organisation's.** The prototype
 * paints this panel per featured card; this database holds no brand colour
 * per partner, and inventing one would be fabricating data. The need colour
 * is already defined, already distinguishes cards at a glance, and matches the
 * badge below it. Read through `var(--color-need-*)` so the two colours that
 * are deliberately darker than the prototype's for contrast (spec D9) stay
 * correct here too.
 *
 * **The prototype's scope pill is not transcribed.** It sits beside the need
 * pill and shows a short geography. This product's `geo.*` copy is a full
 * sentence -- "Open in the AI Hub partner countries" -- which is not pill
 * text, and abbreviating it here would be writing new copy rather than
 * styling existing copy.
 */
export default function FeaturedCarousel({ resources }: { resources: PublicResource[] }) {
  const featured = sortResources(
    resources.filter((r) => r.isFeatured),
    'featured',
  );
  const [index, setIndex] = useState(0);

  if (featured.length === 0) return null;

  const current = featured[Math.min(index, featured.length - 1)];
  if (!current) return null;

  const label = deadlineLabel(current);
  const needColour = `var(--color-need-${current.needPrimary})`;

  return (
    <section>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: '#1A2332',
        }}
      >
        {t('home.featuredHeading')}
      </h2>

      <article
        className="proto-feature-card"
        style={{
          marginTop: 14,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#fff',
          border: '1px solid #DDE5EE',
          display: 'flex',
          flexWrap: 'wrap',
          boxShadow: '0 2px 20px rgba(0,60,100,0.08)',
        }}
      >
        <div
          style={{
            flex: 1.1,
            minWidth: 260,
            minHeight: 220,
            background: needColour,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 16,
              display: 'flex',
              gap: 7,
              flexWrap: 'wrap',
            }}
          >
            {current.isFeatured ? (
              <span style={BANNER_BADGE}>{t('badge.featured')}</span>
            ) : null}
            {current.exclusivity === 'exclusive' ? (
              <span style={BANNER_BADGE}>{t('badge.exclusive')}</span>
            ) : null}
            {current.exclusivity === 'early_access' ? (
              <span style={BANNER_BADGE}>{t('badge.earlyAccess')}</span>
            ) : null}
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '22px 24px 20px 24px',
            }}
          >
            {/* Prototype line 34 opens the banner with the partner's mark
                above the name. The dot trio that sits beside it there is not
                transcribed -- see WelcomeBand for why the marker is gone. */}
            <PartnerLogo logoUrl={current.partnerLogoUrl} style={LOGO_ON_FEATURED} />
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {current.partnerName}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.2,
                marginTop: 5,
                letterSpacing: '-0.01em',
              }}
            >
              {current.name}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 280,
            padding: '26px 28px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 99,
                background: `var(--color-need-${current.needPrimary}-bg)`,
                color: needColour,
              }}
            >
              {t(`need.${current.needPrimary}`)}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11.5,
                fontWeight: 600,
                color: current.isClosed ? '#C0392B' : '#5B6B8C',
              }}
            >
              {label}
            </span>
          </div>

          <h3
            style={{
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.22,
              marginTop: 12,
              marginBottom: 0,
            }}
          >
            <Link href={`/resources/${current.id}`} style={{ color: '#1A2332' }}>
              {current.name}
            </Link>
          </h3>

          <div
            style={{ fontSize: 12.5, fontWeight: 700, color: '#1F5FBF', marginTop: 5 }}
          >
            {current.partnerName}
          </div>

          {current.description ? (
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: '#42506E',
                marginTop: 9,
              }}
            >
              {current.description}
            </div>
          ) : null}

          <Link
            href={`/resources/${current.id}`}
            style={{
              marginTop: 'auto',
              paddingTop: 14,
              fontSize: 13.5,
              fontWeight: 800,
              color: '#1F5FBF',
            }}
          >
            {t('cta.viewDetail')}
          </Link>
        </div>
      </article>

      {featured.length > 1 ? (
        <div
          style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 12 }}
        >
          {featured.map((resource, dot) => (
            <button
              key={resource.id}
              type="button"
              onClick={() => setIndex(dot)}
              aria-current={dot === index}
              aria-label={resource.name}
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                border: 'none',
                background: dot === index ? '#1F5FBF' : '#fff',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 0 0 1px #C9D3E8 inset',
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const BANNER_BADGE = {
  fontSize: 11.5,
  fontWeight: 800,
  padding: '4px 11px',
  borderRadius: 99,
  background: 'rgba(255,255,255,0.9)',
  color: '#1A2332',
} as const;
