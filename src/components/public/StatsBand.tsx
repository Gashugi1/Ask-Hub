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
 */
export default function StatsBand({ stats }: { stats: PublicStat[] }) {
  const hero = stats.filter((s) => s.isHero).slice(0, HERO_LIMIT);
  const shown = hero.length > 0 ? hero : stats.slice(0, HERO_LIMIT);
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
