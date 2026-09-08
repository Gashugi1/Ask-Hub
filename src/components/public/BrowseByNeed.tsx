import Link from 'next/link';
import { t } from '@/lib/i18n';
import { EMPTY_CRITERIA, browseHref, directoryHref } from '@/lib/public/filters';
import type { NeedMenuEntry } from '@/lib/public/need-menu';
import type { NeedKey } from '@/lib/public/types';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 50-82: the storefront's left-hand department menu -- a 232px card
 * that sticks below the header, listing each need with a colour swatch, a
 * left rule, its live count, and, under whichever need is currently
 * filtering the directory, that need's sub-categories.
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
 * **This component is presentational and pure.** Everything it renders is
 * decided by `buildNeedMenu` (the entries) and by the caller (which need is
 * active). It holds no state, reads no URL and computes no list, which is
 * what lets `BrowseByNeedClient` and the static `Suspense` fallback in
 * page.tsx render the same markup from two different sources of the active
 * need -- see BrowseByNeedClient for why there are two.
 *
 * **The expanded state is the filter, not a disclosure.** The prototype's
 * `expanded: on` is `filters.need === n` (reference line 3251): a category's
 * sub-items are showing precisely because that category is what the directory
 * is currently filtered to. There is no independent open/closed state to
 * track, so there is no toggle button, no `aria-expanded` and nothing that
 * can disagree with the URL. Selecting the active category again clears the
 * filter, which is the prototype's own toggle (line 3250).
 *
 * **Sub-items are a search, not a facet.** Selecting one sets the need *and*
 * the free-text query to the sub-category's own text -- the prototype sets a
 * text chip and the search draft to exactly that (line 3253). It works here
 * because `matchesQuery` in filters.ts already searches `sub_category`
 * alongside name, partner and description. So the sub-item needs no filter
 * dimension of its own: it is the same `need` + `q` pair the directory's
 * chips read and write, serialised by the same `directoryHref`, and a
 * sub-item link is therefore shareable, back-buttonable and identical to what
 * a visitor would have got by typing that phrase into the search box.
 *
 * **The counts beside them are not in the prototype** (its sub-items are bare
 * labels, reference line 68). They are added at the client's instruction, and
 * they are real: `buildNeedMenu` tallies the live rows carrying each label,
 * using the same need predicate the directory filters by, so the number is
 * exactly how many cards the link leads to. The colour is inherited rather
 * than set, so the count warms to the primary blue with its label on hover
 * instead of staying grey against it.
 *
 * A need with no live resource has no row in `need_counts_public` at all, so
 * `buildNeedMenu` drops it and it renders no entry: an entry reading "0 live"
 * is an invitation to a dead end, and the filter behind it would land the
 * visitor on an empty directory.
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
 * **Colours come from the tokens, not from the prototype's literals**, for
 * the swatch: `--color-need-training` and `--color-need-funding` are
 * deliberately darker than the prototype's own (spec D9), because the
 * prototype's values measure 4.44:1 and 3.74:1 against their badge
 * backgrounds, under the WCAG AA 4.5:1 bar. Reading the swatch from
 * `var(--color-need-*)` keeps this component correct by construction.
 *
 * The left rule is *not* the need's colour. It had been, which was a
 * misreading: the prototype's `m.bd` is `on ? '#1F5FBF' : 'transparent'`
 * (line 3249) -- a selection indicator, not a category colour, and the only
 * thing besides the tinted background that marks which entry is expanded.
 * The need's colour appears once per entry, in the 9px swatch, exactly as
 * `m.color` does.
 *
 * Entry order is the reader's, not this component's: `listNeedCounts` sorts
 * by the `need_type` enum, whose declaration order is the canonical NEED_KEYS
 * order in src/lib/reference.ts, and `buildNeedMenu` preserves it. This
 * component preserves the order it is given and imposes none of its own.
 */
export default function BrowseByNeed({
  entries,
  activeNeed,
}: {
  entries: readonly NeedMenuEntry[];
  /** The need the directory is currently filtered to, if any. */
  activeNeed: NeedKey | null;
}) {
  if (entries.length === 0) return null;

  return (
    // The 232px basis and the sticky behaviour live in globals.css, because
    // both have to change on a narrow screen and an inline style cannot carry
    // a media query. Left inline, the rail stayed a sticky 232px column on a
    // phone and floated over the cards as the page scrolled past it.
    <nav
      aria-label={t('home.browseHeading')}
      className="proto-browse-rail"
      style={{
        background: '#fff',
        border: '1px solid #DDE5EE',
        borderRadius: 14,
        padding: '16px 12px',
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
        {entries.map((entry) => {
          const isActive = entry.need === activeNeed;
          const needOnly = { ...EMPTY_CRITERIA, need: entry.need };

          return (
            <li key={entry.need}>
              <Link
                // Selecting the active category clears the filter rather than
                // re-applying it, which is the prototype's own toggle. It is
                // also the only way back out of a filtered directory from
                // this rail, which otherwise offers no "all needs" entry.
                //
                // browseHref, not directoryHref: opening a category reveals
                // its sub-categories in the menu, and the #directory fragment
                // scrolled the viewport straight past them to the results.
                // The sub-category rows below keep the fragment, because
                // choosing one is a request for the resources themselves.
                href={browseHref(isActive ? EMPTY_CRITERIA : needOnly)}
                aria-current={isActive ? 'true' : undefined}
                className="proto-dept-item"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: isActive ? '#EEF2FB' : 'transparent',
                  borderLeft: `3px solid ${isActive ? '#1F5FBF' : 'transparent'}`,
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
                    background: `var(--color-need-${entry.need})`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: isActive ? '#1F5FBF' : '#1A2332',
                    }}
                  >
                    {t(`need.${entry.need}`)}
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
                    {t(`need.${entry.need}.def`)}
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
                  <span aria-hidden="true">{entry.liveCount}</span>
                  <span className="sr-only">
                    {t('home.browseCount', { count: entry.liveCount })}
                  </span>
                </span>
              </Link>

              {/* Prototype lines 65-73. A nested list rather than a sibling
                  block: these are the sub-navigation of the entry above them,
                  and nesting is what says so to a screen reader without a
                  second `aria-label` inventing a name for the group.

                  Rendered only for the active need, and only when it has
                  sub-categories at all -- a need whose live resources are all
                  uncategorised expands to nothing, which is honest, rather
                  than to a lone "More" that repeats the filter already
                  applied. */}
              {isActive && entry.subCategories.length > 0 ? (
                <ul
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    padding: '2px 0 6px 30px',
                    margin: 0,
                    listStyle: 'none',
                  }}
                >
                  {entry.subCategories.map((sub) => (
                    <li key={sub.label}>
                      <Link
                        href={directoryHref({ ...needOnly, query: sub.label })}
                        className="proto-dept-sub"
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 8,
                          textAlign: 'left',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#42506E',
                          padding: '5px 8px',
                          borderRadius: 6,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>{sub.label}</span>
                        {/* The category row above states its count the same
                            way: the digit alone for the eye, the unit only
                            for a screen reader, because "3" read out on its
                            own is three of nothing. */}
                        <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          <span aria-hidden="true">{sub.liveCount}</span>
                          <span className="sr-only">
                            {t('home.browseCount', { count: sub.liveCount })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  <li>
                    {/* The prototype's "More →". It drops the sub-category and
                        keeps the need, so it is the way back to everything in
                        the category from a narrowed view -- including the rows
                        the MAX_SUB_CATEGORIES cap left unlisted. The arrow is
                        not transcribed: this codebase drops the prototype's
                        decorative arrows everywhere (cta.viewDetail is "View
                        details", not "See details →"). */}
                    <Link
                      href={directoryHref(needOnly)}
                      className="proto-dept-more"
                      style={{
                        display: 'block',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#1F5FBF',
                        padding: '5px 8px',
                      }}
                    >
                      {t('home.browseMore')}
                    </Link>
                  </li>
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
