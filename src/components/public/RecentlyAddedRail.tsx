import Link from 'next/link';
import { t } from '@/lib/i18n';
import { sortResources } from '@/lib/public/filters';
import { deadlineLabel } from '@/lib/public/deadline-label';
import type { PublicResource } from '@/lib/public/types';
import PartnerLogo, { LOGO_ON_RAIL } from './PartnerLogo';

const RECENT_LIMIT = 6;

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 143-168: a horizontally scrolling rail of narrow 250px cards, each
 * with an 84px need-coloured banner over a compact body.
 *
 * PRD 5.1 item 7.
 *
 * **The rail has its own card, rather than reusing ResourceCard.** The
 * prototype's rail card is a different object from its directory card -- a
 * shorter banner, 14.5px title against the directory's larger one, one line
 * of clamped banner text, and no action links. Reusing the directory card
 * here and overriding its type would have produced neither.
 *
 * **The prototype's "added" label is not transcribed literally.** Its rail
 * shows when a resource was added; showing that here would mean formatting a
 * date in TypeScript for a public card, and src/lib/public/deadline-label.ts
 * is explicit that SQL owns date reasoning on this path so that there is one
 * answer to the question rather than two that drift. The slot instead carries
 * the deadline label the card already derives -- "Rolling", "Closed", "12
 * days left" -- which occupies the same position, needs no new date handling,
 * and tells a visitor something more actionable than an arrival date.
 */
export default function RecentlyAddedRail({ resources }: { resources: PublicResource[] }) {
  const recent = sortResources(resources, 'recent').slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

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
        {t('home.recentHeading')}
      </h2>

      <ul
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 14,
          overflowX: 'auto',
          paddingBottom: 8,
          listStyle: 'none',
          paddingLeft: 0,
        }}
      >
        {recent.map((resource) => (
          <li key={resource.id} style={{ flex: '0 0 250px' }}>
            <article
              className="proto-rail-card"
              style={{
                position: 'relative',
                border: '1px solid #DDE5EE',
                borderRadius: 14,
                overflow: 'hidden',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <div
                style={{
                  height: 84,
                  background: `var(--color-need-${resource.needPrimary})`,
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <PartnerLogo logoUrl={resource.partnerLogoUrl} style={LOGO_ON_RAIL} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '12px 16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.72)',
                      letterSpacing: '0.13em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {resource.partnerName}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '14px 16px 16px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  flex: 1,
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 99,
                      background: `var(--color-need-${resource.needPrimary}-bg)`,
                      color: `var(--color-need-${resource.needPrimary})`,
                    }}
                  >
                    {t(`need.${resource.needPrimary}`)}
                  </span>
                  {resource.isFeatured ? (
                    <span style={RAIL_BADGE}>{t('badge.featured')}</span>
                  ) : null}
                </div>

                <h3
                  style={{
                    fontSize: 14.5,
                    fontWeight: 800,
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {/* Stretched link: the anchor covers the whole card via
                      .proto-rail-card a::after, so the banner, pills and
                      deadline are all clickable -- the prototype opens the
                      resource from anywhere on the card. Kept as one anchor
                      rather than wrapping the card, so the accessibility tree
                      still has a single link with the resource's name, not a
                      link containing every scrap of text on the card. */}
                  <Link
                    href={`/resources/${resource.id}`}
                    className="proto-rail-open"
                    style={{ color: '#1A2332' }}
                  >
                    {resource.name}
                  </Link>
                </h3>

                <div
                  style={{
                    marginTop: 'auto',
                    fontSize: 11.5,
                    color: resource.isClosed ? '#C0392B' : '#5B6B8C',
                    fontWeight: 600,
                  }}
                >
                  {deadlineLabel(resource)}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

const RAIL_BADGE = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 99,
  background: '#EEF2FB',
  color: '#1F5FBF',
} as const;
