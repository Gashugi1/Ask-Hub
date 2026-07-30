/**
 * Cache tags for the public read surface. SP3's editor save actions call
 * `revalidateTag` with these after a successful transaction; nothing
 * invalidates them until then. Exported as the SP2a/SP3 interface so two
 * sub-projects cannot invent two spellings of the same tag.
 *
 * Tags are dependency-specific rather than one global 'public' tag: an edit
 * to a partner logo should not evict the whole directory.
 */
export const CACHE_TAGS = {
  resources: 'resources',
  partners: 'partners',
  siteContent: 'site-content',
  headlineStats: 'headline-stats',
  impactStories: 'impact-stories',
  settings: 'settings',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * How long a cached `resources_public` read may live before it is recomputed
 * regardless of whether anything was edited.
 *
 * This exists because time passes without a database edit. `is_closed` and
 * `days_left` are computed in SQL from `current_date`, so a page cached at
 * 23:50 with "1 day left" keeps serving that after midnight -- no editor
 * touched anything, so no tag is invalidated and tag invalidation alone
 * would never correct it.
 *
 * **Maximum deadline-display staleness is therefore RESOURCE_TTL_SECONDS
 * after UTC midnight.** The database timezone is UTC (`show timezone`
 * returns UTC), so the day boundary is UTC midnight -- a product decision,
 * not a session default. At 900s that is a 15-minute worst case, which is
 * well inside "shows Closed the morning after" and cheap enough to serve
 * from cache the rest of the day.
 */
export const RESOURCE_TTL_SECONDS = 900;
