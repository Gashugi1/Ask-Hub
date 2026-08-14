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
 */
export default function StatsBand({ stats }: { stats: PublicStat[] }) {
  const shown = stats.filter((s) => s.isHero).slice(0, HERO_LIMIT);
  if (shown.length === 0) return null;

  return (
    <section className="bg-tint-1">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="sr-only">{t('home.statsHeading')}</h2>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((s) => (
            <div key={s.id}>
              <dt className="text-3xl font-semibold text-primary">{s.value}</dt>
              <dd className="mt-1 text-sm text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
