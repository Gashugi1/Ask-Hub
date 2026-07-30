// Data only. No assertions live here -- that is the point: a diff that
// touches this file is unambiguously a policy change, never an
// incidental side effect of adding a test.
//
// The meta-test in tests/rls/schema-guards.test.ts enforces, for every
// entry: `approvedIn` matches /^SP\d+-T\d+[a-z]?$/, `why` is at least 40
// characters and is not a substring of the object's own name, and each
// record's length equals its pinned EXPECTED_* count below. Adding an
// exception therefore costs three coordinated, visible acts in one diff
// -- a new entry, a real rationale citing a real plan task, and a bumped
// count -- not one line silencing a guard.

export interface Exception {
  approvedIn: string;
  why: string;
}

// The eight public-safe views created by supabase/migrations/0009_public_views.sql,
// rebuilt (resources_public) or removed (partners_public) by
// supabase/migrations/0013_reconcile_partners.sql, and restored
// (partners_public) with resources_public rebuilt again by
// supabase/migrations/0014_partner_logos.sql. This is the entire
// anonymous read surface (CLAUDE.md: "Anonymous reads go through
// public-safe views that exclude views, clicks, CTR, submitter emails and
// internal notes").
//
// partners_public is back: Task 12L reversed one consequence of the H8
// ruling behind Task 12r, on the client's confirmation that they want
// partner logos after all -- the prototype having no partner URLs was
// never evidence the client didn't want them, just evidence the
// prototype didn't have them.
export const ANON_SELECTABLE: Record<string, Exception> = {
  resources_public: {
    approvedIn: 'SP1-T11',
    why: 'The public resource directory itself, filtered to status = live and excluding views/clicks/ctr and the internal status column.',
  },
  partners_public: {
    approvedIn: 'SP1-T12l',
    why: 'Public-safe projection of partner name, logo and official site link for the resource directory, restored after the client confirmed they want partner logos.',
  },
  headline_stats_public: {
    approvedIn: 'SP1-T11',
    why: 'Public-safe projection of the home page hero stat rail; the base table carries no submitter or analytics column to exclude.',
  },
  compute_metrics_public: {
    approvedIn: 'SP1-T11',
    why: 'Public-safe projection of the home page compute rail, the eighth view this task added beyond its stated Produces list.',
  },
  site_content_public: {
    approvedIn: 'SP1-T11',
    why: 'Per-key/locale page copy so an editor change appears without a rebuild, per CLAUDE.md revalidate-on-write for Site Content.',
  },
  programmes_public: {
    approvedIn: 'SP1-T11',
    why: 'Public-safe projection of the programmes list shown on the public site, with no submitter or analytics column present.',
  },
  impact_stories_public: {
    approvedIn: 'SP1-T11',
    why: 'Public-safe projection of impact stories, gated in the application by the feature_public_impact_page flag, not by this grant.',
  },
  need_counts_public: {
    approvedIn: 'SP1-T11',
    why: 'Server-side aggregate live count per need for the home page browse band, computed in Postgres rather than fetched row by row.',
  },
  settings_public: {
    approvedIn: 'SP2a-T1',
    why: 'Allow-listed projection of the two feature flag rows so a public page can resolve feature_public_impact_page without the service_role client; no other settings key is projected.',
  },
};

// Keyed by `proname(identity_args)` (e.g. `"my_fn(a text, b int)"`), not
// proname alone -- matching how G12 in tests/rls/schema-guards.test.ts
// looks entries up and how it prints an offender, so two overloads of the
// same function name cannot share one slot.
//
// Intentionally empty. Anonymous writes get no allow-list slot at all:
// the public submission form, digest signup and contact form all need an
// anonymous-facing insert, and the correct implementation is a server
// action holding the service_role client behind Zod validation and a
// rate limit -- never `grant insert on public.submissions to anon`.
// Leaving a slot here guarantees it eventually gets used for exactly
// that shortcut, so there is no slot to fill.
export const ANON_EXECUTABLE: Record<string, Exception> = {};

export const EXPECTED_ANON_SELECTABLE = 9;
export const EXPECTED_ANON_EXECUTABLE = 0;
