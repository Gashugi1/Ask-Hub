import Link from 'next/link';
import { t } from '@/lib/i18n';
import type { NeedCount } from '@/lib/public/types';

/**
 * PRD 5.1 item 4: five need types with live counts. The counts come from
 * `need_counts_public`, a `count(*) where status = 'live'` grouped in
 * Postgres -- a true number, not a stored one, so it needs no attestation
 * and cannot drift from the directory beneath it.
 *
 * A need with no live resource has no row in that view at all, so it renders
 * no chip: a chip reading "0 live" is an invitation to a dead end, and the
 * filter behind it would land the visitor on an empty directory.
 *
 * Each chip links into the directory rather than to a route of its own:
 * there is no /directory, and the query string is the shareable state.
 *
 * Chip order is the reader's, not this component's: `listNeedCounts` sorts by
 * the `need_type` enum, whose declaration order is the canonical NEED_KEYS
 * order in src/lib/reference.ts. This component preserves the order it is
 * given and imposes none of its own.
 */
export default function BrowseByNeed({ counts }: { counts: NeedCount[] }) {
  const withResources = counts.filter((c) => c.liveCount > 0);
  if (withResources.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-h2 font-extrabold text-navy">{t('home.browseHeading')}</h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {withResources.map((count) => (
          <li key={count.need}>
            <Link
              href={`/?need=${count.need}#directory`}
              className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-navy"
            >
              <span>{t(`need.${count.need}`)}</span>
              <span className="text-muted-light">
                {t('home.browseCount', { count: count.liveCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
