import Link from 'next/link';
import { t } from '@/lib/i18n';
import { sortResources } from '@/lib/public/filters';
import { deadlineLabel } from '@/lib/public/deadline-label';
import { needBanner, bannerPartner } from '@/lib/public/need-banner';
import type { PublicResource } from '@/lib/public/types';

const RECENT_LIMIT = 6;

/**
 * Transcribed from the approved prototype's recentRail card: a horizontally
 * scrolling rail of 262px cards, each a 128px need-coloured banner over a
 * compact body. The banner carries the provider eyebrow and, below it, the
 * title in white clamped to two lines; the body carries the need pill (and a
 * featured badge), the description, and the deadline label.
 *
 * PRD 5.1 item 7.
 *
 * **The rail has its own card, rather than reusing ResourceCard.** The
 * prototype's rail card is a different object from its directory card -- the
 * title lives in the banner rather than the body, and it carries no action
 * links. Reusing the directory card here and overriding its type would have
 * produced neither.
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
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
          flex: 1,
          alignItems: 'stretch',
        }}
      >
        {recent.map((resource) => (
          <li key={resource.id} style={{ flex: '0 0 262px', display: 'flex' }}>
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
                minHeight: 378,
                height: '100%',
              }}
            >
              {/* The banner uses flex flow (not the prototype's absolute
                  overlay) to bottom-align its content: it must NOT be a
                  positioning context, or the stretched-link ::after below would
                  scope to the banner instead of the whole card. Same visual,
                  and the article stays the positioning context for the stretch. */}
              <div
                style={{
                  height: 128,
                  background: needBanner(resource.needPrimary),
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '14px 18px',
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
                  {bannerPartner(resource.partnerName)}
                </div>
                {/* Prototype: the title sits in the banner, white, clamped to
                    two lines, below the partner eyebrow. Kept as the
                    stretched-link anchor (.proto-rail-card .proto-rail-open::after
                    covers the card), so the whole card opens the resource and the
                    accessibility tree still has one link named for it. */}
                <h3
                  style={{
                    margin: '3px 0 0 0',
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  <Link
                    href={`/resources/${resource.id}`}
                    className="proto-rail-open"
                    style={{ color: '#fff' }}
                  >
                    {resource.name}
                  </Link>
                </h3>
              </div>

              <div
                style={{
                  padding: '16px 18px 18px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
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

                {resource.description ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: '#42506E',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {resource.description}
                  </p>
                ) : null}

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
