import Link from 'next/link';
import { t } from '@/lib/i18n';
import { deadlineLabel } from '@/lib/public/deadline-label';
import type { PublicResource } from '@/lib/public/types';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 253-278: a 14px-radius card with a 92px need-coloured banner carrying
 * the providing organisation, then pills, a 17px title, the partner, the
 * description, and a "learn more" line pinned to the bottom.
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
 * **No partner logo.** The banner carried the providing organisation's mark
 * where one existed; this release removes partner and programme logos
 * everywhere, so the banner names the organisation in text alone. The
 * `partner_logo_url` column and its data are untouched -- only the rendering
 * is gone -- so reinstating the mark later is a render change, not a
 * migration.
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
          background: needColour,
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
            {resource.partnerName}
          </div>
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

        <h3 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, margin: 0 }}>
          <Link href={`/resources/${resource.id}`} style={{ color: '#1A2332' }}>
            {resource.name}
          </Link>
        </h3>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1F5FBF' }}>
          {resource.partnerName}
        </div>

        {resource.description ? (
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: '#42506E',
              margin: 0,
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

const ACCENT_PILL = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: 99,
  background: '#EEF2FB',
  color: '#1F5FBF',
} as const;
