import type { NeedCount, NeedKey, PublicResource } from './types';

/**
 * The browse menu's model: one entry per need that has something live in it,
 * each carrying the sub-categories a visitor can narrow to.
 *
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 3242-3253 (`deptMenu`). The sub-items are not a taxonomy and there is
 * no table behind them: they are the distinct `sub_category` values found on
 * the live resources filed under that need, discovered from the same rows the
 * directory renders. So a curator who types a new sub-category into the
 * resource form gets a new sub-item, and one that no live resource carries
 * any more disappears -- with no second list to keep in step.
 *
 * Deriving them here rather than in the component is what makes the rule
 * testable: the component then has no logic left to get wrong, and the four
 * decisions this file encodes (which resources count, what "distinct" means,
 * what order, how many) are each asserted in tests/unit/need-menu.test.ts.
 */

/**
 * The prototype's `subs.slice(0, 4)`.
 *
 * The menu is a 232px rail beside the whole storefront; an unbounded list
 * would push the featured band and the partner row below the fold on a need
 * that happens to have twenty distinct sub-categories. What the cap hides is
 * reachable through the entry's own "More" link, which drops the
 * sub-category and shows every resource in the need.
 */
export const MAX_SUB_CATEGORIES = 4;

export interface NeedMenuSubCategory {
  /** The `sub_category` text as a curator typed it, trimmed. */
  label: string;
  /** How many of this need's live resources carry it. */
  liveCount: number;
}

export interface NeedMenuEntry {
  need: NeedKey;
  liveCount: number;
  /** Distinct `sub_category` values on this need's live resources, capped. */
  subCategories: NeedMenuSubCategory[];
}

/**
 * A resource belongs to a need if either of its need slots names it.
 *
 * This is `filterResources`' own rule for the `need` facet, restated because
 * the menu has to agree with the directory it drives: an entry that counted
 * only `needPrimary` would offer a sub-item whose link then landed on a
 * result set that included rows the entry had not counted.
 */
function inNeed(row: PublicResource, need: NeedKey): boolean {
  return row.needPrimary === need || row.needSecondary === need;
}

/**
 * Build the menu from the counts and the live resources the page already has.
 *
 * `counts` decides which entries exist and what number each shows: those come
 * from `need_counts_public`, a `count(*) where status = 'live'` computed in
 * Postgres, and are not recomputed from `resources` here. Two sources for one
 * number is how a rail and the list beneath it start disagreeing.
 *
 * The sub-category tallies have no such view behind them and are counted from
 * `resources` -- the only place a `sub_category` breakdown exists. They are
 * still true counts of real rows, not estimates: `resources` is the same live
 * set the directory filters, so a sub-item reading "3" is a promise that
 * following it shows three cards, and the same predicate decides both.
 *
 * A need with no live resource is dropped rather than rendered as a zero. An
 * entry reading "0 live" is an invitation to a dead end, and the filter
 * behind it would land the visitor on an empty directory.
 *
 * Entry order is `counts`' order, which `listNeedCounts` has already fixed to
 * the `need_type` enum's declaration order. Nothing is re-sorted here.
 */
/**
 * The categories the browse menu offers, in the order it offers them.
 *
 * Fixed rather than derived. Ordering by live count would reproduce the
 * client's mockup today -- its 8, 3, 1, 1 happens to be descending -- but the
 * menu would then rearrange itself whenever a resource is published, moving a
 * category out from under a returning visitor's cursor. A stated order stays
 * put.
 *
 * **Partners is absent, deliberately, and is now the only need hidden here.**
 * The four original categories are joined by `data`, `challenges` and
 * `community` (added with the expanded catalogue). `partners` stays out of
 * this menu only: it remains a valid need everywhere else -- the directory's
 * filter chips, the pill on a card, exports, and the admin form -- so the
 * resources under it keep their category and stay findable by filtering.
 * Nothing is stranded, and nothing had to be re-categorised.
 */
const BROWSE_ORDER: readonly NeedKey[] = [
  'training', 'compute', 'funding', 'accelerator', 'data', 'challenges', 'community',
];

export function buildNeedMenu(
  counts: readonly NeedCount[],
  resources: readonly PublicResource[],
): NeedMenuEntry[] {
  const byNeed = new Map(counts.map((count) => [count.need, count]));
  return BROWSE_ORDER.flatMap((need) => {
    const count = byNeed.get(need);
    // A category with nothing live in it still renders no entry: a row
    // reading "0" is a click through to an empty directory.
    if (!count || count.liveCount <= 0) return [];
    return [
      {
        need,
        liveCount: count.liveCount,
        subCategories: subCategoriesFor(resources, need),
      },
    ];
  });
}

/**
 * `sub_category` is a free-text column with no NOT NULL and no trim
 * constraint, so a row can carry null, `''` or `'  '` and all three mean the
 * same thing: uncategorised. Each is skipped rather than counted into a
 * nameless sub-item -- a menu entry whose label is the empty string is a
 * click target a visitor cannot see, read or describe.
 *
 * Distinctness is on the trimmed value, exactly as it will be displayed, and
 * is case-sensitive: "Cloud credits" and "cloud credits" stay two entries
 * because they are two different labels on screen, and collapsing them would
 * mean choosing which of a curator's two spellings to show. The order is
 * first appearance in `resources`, which is the order the readers return.
 *
 * **The cap is applied after counting, not during it.** Every matching row is
 * tallied first and only then are the first MAX_SUB_CATEGORIES labels kept,
 * so a label's count is the whole truth about that label rather than however
 * many of its rows happened to appear before the cap was reached. Counting as
 * it went would have made the numbers depend on row order -- the one thing a
 * count must not do.
 *
 * The prototype shows no number beside a sub-item (reference line 68); these
 * are added at the client's instruction. Nothing about them is estimated or
 * carried over from a fixture: each is a tally of rows the page already
 * holds, so a sub-item with nothing behind it cannot exist to be
 * mislabelled.
 */
function subCategoriesFor(
  resources: readonly PublicResource[],
  need: NeedKey,
): NeedMenuSubCategory[] {
  const tally = new Map<string, number>();
  for (const row of resources) {
    if (!inNeed(row, need)) continue;
    const label = row.subCategory?.trim();
    if (!label) continue;
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally]
    .slice(0, MAX_SUB_CATEGORIES)
    .map(([label, liveCount]) => ({ label, liveCount }));
}
