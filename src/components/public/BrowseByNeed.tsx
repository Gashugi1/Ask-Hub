import Link from 'next/link';
import { t } from '@/lib/i18n';
import type { NeedCount } from '@/lib/public/types';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 50-82: the storefront's left-hand department menu -- a 232px card
 * that sticks below the header, listing each need with a colour swatch, a
 * left rule in that need's colour, and its live count.
 *
 * This replaces a row of pill chips. The prototype's home page is two
 * columns, and this is the left one; `src/app/(public)/page.tsx` carries the
 * matching flex row.
 *
 * PRD 5.1 item 4: five need types with live counts. The counts come from
 * `need_counts_public`, a `count(*) where status = 'live'` grouped in
 * Postgres -- a true number, not a stored one, so it needs no attestation
 * and cannot drift from the directory beneath it.
 *
 * A need with no live resource has no row in that view at all, so it renders
 * no entry: an entry reading "0 live" is an invitation to a dead end, and the
 * filter behind it would land the visitor on an empty directory.
 *
 * Each entry links into the directory rather than to a route of its own:
 * there is no /directory, and the query string is the shareable state.
 *
 * **The one-line need definitions are transcribed after all.** They were
 * omitted at first on the grounds that writing five descriptions of a UN
 * programme's offer is the client's call rather than a styling task. That was
 * the wrong reading: the prototype is the client's own approved artefact, so
 * its definitions are already their words. Transcribing them is what parity
 * means here; inventing five of my own would have been the overreach.
 *
 * **Colours come from the tokens, not from the prototype's literals.** Every
 * other value here is transcribed verbatim, but `--color-need-training` and
 * `--color-need-funding` are deliberately darker than the prototype's own
 * (spec D9): the prototype's values measure 4.44:1 and 3.74:1 against their
 * badge backgrounds, under the WCAG AA 4.5:1 bar. Reading the swatch and rule
 * from `var(--color-need-*)` keeps this component correct by construction.
 *
 * Entry order is the reader's, not this component's: `listNeedCounts` sorts by
 * the `need_type` enum, whose declaration order is the canonical NEED_KEYS
 * order in src/lib/reference.ts. This component preserves the order it is
 * given and imposes none of its own.
 */
export default function BrowseByNeed({ counts }: { counts: NeedCount[] }) {
  const withResources = counts.filter((c) => c.liveCount > 0);
  if (withResources.length === 0) return null;

  return (
    <nav
      aria-label={t('home.browseHeading')}
      style={{
        flex: '0 0 232px',
        minWidth: 232,
        background: '#fff',
        border: '1px solid #DDE5EE',
        borderRadius: 14,
        padding: '16px 12px',
        position: 'sticky',
        top: 80,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 800,
          color: '#5B6B8C',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '0 10px',
        }}
      >
        {t('home.browseLabel')}
      </div>

      <ul
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          listStyle: 'none',
          padding: 0,
        }}
      >
        {withResources.map((count) => (
          <li key={count.need}>
            <Link
              href={`/?need=${count.need}#directory`}
              className="proto-dept-item"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderLeft: `3px solid var(--color-need-${count.need})`,
                borderRadius: '0 8px 8px 0',
                padding: '10px 10px',
                textAlign: 'left',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: `var(--color-need-${count.need})`,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#1A2332',
                  }}
                >
                  {t(`need.${count.need}`)}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: '#5B6B8C',
                    marginTop: 2,
                    fontWeight: 400,
                  }}
                >
                  {t(`need.${count.need}.def`)}
                </span>
              </span>
              {/* The prototype shows a bare number in this column. On its own
                  that is "4" of nothing, so the unit stays for screen readers
                  while the column reads as the prototype's does. */}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#5B6B8C',
                  flexShrink: 0,
                }}
              >
                <span aria-hidden="true">{count.liveCount}</span>
                <span className="sr-only">
                  {t('home.browseCount', { count: count.liveCount })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
