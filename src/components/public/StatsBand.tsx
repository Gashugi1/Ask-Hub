import { t } from '@/lib/i18n';
import type { PublicStat } from '@/lib/public/types';

/** PRD 5.1 item 2: the first four hero stats. */
const HERO_LIMIT = 4;

/**
 * The headline reach strip.
 *
 * Renders exactly the figures that exist and nothing in place of the ones
 * that do not. `headline_stats` cannot hold a row without `source`,
 * `attested_by` and `attested_on` -- all NOT NULL and non-blank since
 * migration 0015 -- so a row here means a named person vouched for that
 * number against a named dataset. No rows means nobody has yet, and the band
 * disappears rather than showing zeros, dashes or a "coming soon".
 *
 * This is not a stylistic empty state. CLAUDE.md: this is a leadership
 * reporting surface for a UN programme, and a plausible fake number is a
 * launch-blocking defect. A partial set is expected -- the client supplies
 * the fifteen figures over time, not in one delivery -- so the band must
 * never wait for a complete set before rendering any of them.
 *
 * **Hero is the whole filter, with no fallback to "the first four of
 * anything".** This used to read `hero.length > 0 ? hero : stats.slice(0, 4)`,
 * which sounds harmless and is not: `headline_stats.is_hero` is `not null
 * default false` (0006_site.sql) and the admin Site Content screen creates
 * every new stat unticked, so "nothing is hero" is the *starting* state of the
 * table, not an edge case. Under that fallback the Hero checkbox did nothing
 * at all until the first tick, and the home strip showed four figures nobody
 * had chosen for it -- while PRD 5.1 item 2 says the strip is the first four
 * hero stats and PRD 5.6 gives the About page the job of showing all of them.
 * An editor who ticks nothing now gets no strip, which is visible and is fixed
 * by ticking a box; the fallback's failure was invisible and disagreed with
 * the spec.
 *
 * **This band has no counterpart in the prototype.** The prototype's home page
 * goes straight from the welcome band to the storefront column with no reach
 * strip at all, so there are no lines to transcribe. It is kept because PRD
 * 5.1 item 2 requires it and removing it would be deleting a feature, not
 * restyling one -- and in practice it is invisible today, since no stat is
 * ticked as hero. What is taken from the prototype is its vocabulary rather
 * than a specific element: the 1280px measure the home page uses, the #F4F6F9
 * panel, an 800-weight figure in the primary blue, and a 13px #5B6B8C label.
 */
export default function StatsBand({ stats }: { stats: PublicStat[] }) {
  const shown = stats.filter((s) => s.isHero).slice(0, HERO_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section style={{ background: '#F4F6F9' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 28px' }}>
        <h2 className="sr-only">{t('home.statsHeading')}</h2>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
            gap: 14,
            margin: 0,
          }}
        >
          {shown.map((s) => (
            <div key={s.id}>
              <dt style={{ fontSize: 26, fontWeight: 800, color: '#1F5FBF' }}>{s.value}</dt>
              <dd style={{ margin: '4px 0 0 0', fontSize: 13, color: '#5B6B8C' }}>
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
