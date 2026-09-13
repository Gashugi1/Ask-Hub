import Link from 'next/link';
import { t } from '@/lib/i18n';
import { deadlineLabel } from '@/lib/public/deadline-label';
import { needBanner, bannerPartner } from '@/lib/public/need-banner';
import type { PublicResource } from '@/lib/public/types';

/**
 * Transcribed from the approved prototype's directory card: a 14px-radius card
 * with a 92px need-coloured banner carrying the providing organisation and,
 * below it, the title in white clamped to one line (the linked heading). The
 * body then carries the need pill, accent and neutral tag pills, the
 * description, and a "learn more"/apply line pinned to the bottom. The title
 * and partner appear once each, in the banner -- not repeated in the body.
 *
 * Pure presentation over a `resources_public` row: it derives nothing the
 * database did not already state, which is what keeps the deadline rule in
 * exactly one place.
 *
 * A closed resource is still listed and still links to its detail page
 * (PRD 4.2). The apply link is suppressed rather than the card, because a
 * closed opportunity is still worth reading about.
 *
 * **The apply link is kept, though the prototype's card has only "learn
 * more".** Dropping it would remove a working route to the opportunity from
 * every card in the directory, which is a reduction in what the product does
 * rather than a change in how it looks. It wears the same treatment as the
 * learn-more line beside it.
 *
 * **No partner mark on the banner**, though the prototype's `bnLogoDir` pins
 * one to its top-right corner. Most partners have no `logo_url`, so the slot
 * rendered for a handful of cards and not the rest, which read as a defect
 * rather than as data the grid did not have.
 *
 * **The banner colour is the need's, not the organisation's.** The prototype
 * paints it per card; this database holds no brand colour per partner, and
 * inventing one would be fabricating data. Read through `var(--color-need-*)`
 * so the two colours held deliberately darker than the prototype's for
 * contrast (spec D9) stay correct here too.
 *
 * No per-resource curation badge, per CLAUDE.md rule 10.8: curation is stated
 * once, globally, above the grid -- which is where the prototype states it too.
 * (Deliberately paraphrased: tests/unit/i18n.test.ts matches the word itself
 * anywhere under src/, comments included, so that no call site can reintroduce
 * the badge by quoting it.)
 */
export default function ResourceCard({ resource }: { resource: PublicResource }) {
  const label = deadlineLabel(resource);
  const needColour = `var(--color-need-${resource.needPrimary})`;

  // The prototype's neutral tags: secondary need, sector reach, geographic
  // scope. They are what tells a reader who a resource is for without opening
  // it, and this card had been showing none of them.
  const tags: string[] = [];
  if (resource.needSecondary) tags.push(t(`need.${resource.needSecondary}`));
  tags.push(
    resource.sectorsEligible.length > 0
      ? resource.sectorsEligible.join(' · ')
      : t('card.allSectorsShort'),
  );
  tags.push(
    resource.geoScope === 'specific' && resource.countriesEligible.length > 0
      ? resource.countriesEligible.join(', ')
      : t(`geo.short.${resource.geoScope}`),
  );

  return (
    <article
      className="proto-card"
      style={{
        border: '1px solid #DDE5EE',
        borderRadius: 14,
        padding: 0,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        animation: 'fadeUp 0.25s ease both',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div
        style={{
          height: 92,
          background: needBanner(resource.needPrimary),
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '13px 20px',
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
          {/* The title lives in the banner (white, one-line clamp), as the
              linked heading -- the prototype's directory card shows it once,
              here, not again in the body. */}
          <h3
            style={{
              margin: '3px 0 0 0',
              fontSize: 14.5,
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.25,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
            }}
          >
            <Link href={`/resources/${resource.id}`} style={{ color: '#fff' }}>
              {resource.name}
            </Link>
          </h3>
        </div>
      </div>

      <div
        style={{
          padding: '18px 20px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 99,
              background: `var(--color-need-${resource.needPrimary}-bg)`,
              color: needColour,
            }}
          >
            {t(`need.${resource.needPrimary}`)}
          </span>
          {resource.isFeatured ? (
            <span style={ACCENT_PILL}>{t('badge.featured')}</span>
          ) : null}
          {resource.exclusivity === 'exclusive' ? (
            <span style={ACCENT_PILL}>{t('badge.exclusive')}</span>
          ) : null}
          {resource.exclusivity === 'early_access' ? (
            <span style={ACCENT_PILL}>{t('badge.earlyAccess')}</span>
          ) : null}
          {tags.map((tag) => (
            <span key={tag} style={TAG_PILL}>
              {tag}
            </span>
          ))}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11.5,
              fontWeight: 600,
              color: resource.isClosed ? '#C0392B' : '#5B6B8C',
            }}
          >
            {label}
          </span>
        </div>

        {resource.description ? (
          // Clamped to three lines, as the recently-added rail clamps its own.
          // Descriptions are partner copy of no fixed length -- an imported
          // tracker row assembles one from a dozen columns and can run to a
          // thousand characters -- and the directory is a grid, so every card
          // in a row stretches to the tallest. Unclamped, a single long
          // description pushes its neighbours' action links a screen down and
          // leaves them sitting above that much empty white. The full text is
          // still in the DOM for a reader and a crawler, and the detail page
          // is where it is meant to be read.
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: '#42506E',
              margin: 0,
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
            paddingTop: 4,
            display: 'flex',
            gap: 16,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          <Link href={`/resources/${resource.id}`} style={{ color: '#1F5FBF' }}>
            {t('cta.viewDetail')}
          </Link>
          {resource.externalUrl && !resource.isClosed ? (
            <a
              href={resource.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1F5FBF' }}
            >
              {resource.actionLabel ?? t('cta.apply')}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** The prototype's neutral tag pill (reference line 270). */
const TAG_PILL = {
  fontSize: 11.5,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 99,
  background: '#F1F4FA',
  color: '#5B6B8C',
} as const;

const ACCENT_PILL = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 99,
  background: '#EEF2FB',
  color: '#1F5FBF',
} as const;
