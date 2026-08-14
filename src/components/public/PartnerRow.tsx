import { t } from '@/lib/i18n';
import type { PublicPartner } from '@/lib/public/types';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 130-142: a cyan eyebrow and one line of explanation over a bordered
 * white strip in which the partners scroll continuously.
 *
 * PRD 5.1 item 6: each logo links to the partner's own official site, and
 * calls this a "scrolling partner logo row". The prototype implements that
 * literally, with `@keyframes marquee` rather than `overflow-x: auto` -- the
 * row moves on its own instead of waiting to be dragged.
 *
 * **The list is rendered twice.** `marquee` translates the track by -50%, so
 * at the end of the animation the second copy sits exactly where the first
 * began and the loop is seamless. With a single copy the row would visibly
 * snap back. The duplicate is `aria-hidden` and its links are removed from
 * the tab order: it is the same information twice, and a screen reader or a
 * keyboard user should meet each partner once.
 *
 * **Motion is opt-out.** `prefers-reduced-motion` stops the animation and
 * restores normal horizontal scrolling, so the band stays usable for anyone
 * who has asked the system for less movement -- the prototype does not do
 * this, and a continuously moving strip is exactly what that setting exists
 * for.
 *
 * The rows reaching this band are the AI Hub's own partners, already
 * narrowed by `partners_public` (0019_ai_hub_partners.sql filters it on
 * `is_ai_hub_partner`) -- not the whole `partners` table, most of which is
 * the provider registry behind `resources.partner`. This component applies
 * no filter of its own and renders exactly what it is given.
 *
 * Content rule 10.10 is enforced in the database as a CHECK
 * (`logo_url is null or website_url is not null`), so a logo without a site
 * to link to cannot exist. Logos and URLs are a client deliverable; until
 * they arrive a partner renders as its name, which is a complete row rather
 * than a gap -- the band only disappears when there are no partners at all.
 */
export default function PartnerRow({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;

  const track = (duplicate: boolean) =>
    partners.map((partner) => {
      const body = (
        <>
          {partner.logoUrl ? (
            // Partner logos are arbitrary remote hosts, so next/image
            // would need each one allow-listed in next.config.ts; SP4
            // owns the image policy. The directive must sit on the
            // line immediately above the <img>, not above this
            // explanation, or it suppresses nothing and reports itself
            // as unused.
            // eslint-disable-next-line @next/next/no-img-element
            <img style={{ height: 26, width: 'auto' }} src={partner.logoUrl} alt="" />
          ) : null}
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#5B6B8C',
              letterSpacing: '0.04em',
            }}
          >
            {partner.name}
          </span>
        </>
      );

      return partner.websiteUrl ? (
        <a
          key={`${partner.name}-${duplicate}`}
          href={partner.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={duplicate ? -1 : undefined}
          className="proto-marquee-item"
          style={MARQUEE_ITEM}
        >
          {body}
        </a>
      ) : (
        <span key={`${partner.name}-${duplicate}`} style={MARQUEE_ITEM}>
          {body}
        </span>
      );
    });

  return (
    <section>
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          color: '#2E9BD6',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {t('home.partnersHeading')}
      </h2>
      <div style={{ fontSize: 12, color: '#5B6B8C', marginTop: 3 }}>
        {t('home.partnersSubtitle')}
      </div>

      <div
        className="proto-marquee"
        style={{
          background: '#fff',
          border: '1px solid #DDE5EE',
          borderRadius: 12,
          padding: '12px 0',
          overflow: 'hidden',
          marginTop: 12,
        }}
      >
        {/*
          Each copy is its own flex row that is at least as wide as the panel.
          That is what makes the loop work at any partner count: the track
          travels -50%, so the second copy must land exactly where the first
          began, which is only true if each copy spans the full container.

          With `width: max-content` and a handful of short names -- three, as
          the database currently holds -- the whole track was narrower than the
          panel, so -50% slid it left and left a gap rather than looping. It
          only looked right with the dozen partners the prototype's fixtures
          carry. `space-around` spreads a short list across the width instead
          of bunching it at the left.
        */}
        <div className="proto-marquee-track" style={{ display: 'flex' }}>
          <div style={MARQUEE_COPY}>{track(false)}</div>
          <div aria-hidden="true" style={MARQUEE_COPY}>
            {track(true)}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One full-width copy of the partner list; two of these make the loop. */
const MARQUEE_COPY = {
  display: 'flex',
  alignItems: 'center',
  flex: '0 0 auto',
  minWidth: '100%',
  justifyContent: 'space-around',
} as const;

const MARQUEE_ITEM = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  padding: '4px 26px',
  borderRight: '1px solid #F1F4FA',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
} as const;
