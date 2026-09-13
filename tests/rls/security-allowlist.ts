// Data only. No assertions live here -- that is the point: a diff that
// touches this file is unambiguously a policy change, never an
// incidental side effect of adding a test.
//
// The meta-test in tests/rls/schema-guards.test.ts enforces, for every
// entry of the three `Exception` registries here (ANON_SELECTABLE,
// ANON_EXECUTABLE, AUDIT_EXEMPT): `approvedIn` matches
// /^SP\d+[a-z]?-T\d+[a-z]?$/, `why` is at least 40 characters and is not
// a substring of the object's own name, and each record's length equals
// its pinned EXPECTED_* count below. Adding an exception therefore costs
// three coordinated, visible acts in one diff -- a new entry, a real
// rationale citing a real plan task, and a bumped count -- not one line
// silencing a guard.
//
// PUBLIC_VIEW_COLUMNS below is a fourth record of a different kind -- a
// declaration of the intended public surface rather than a list of
// exceptions to a rule -- and is checked by its own meta-test, not by
// the Exception one. Its own comment explains the distinction.

export interface Exception {
  approvedIn: string;
  why: string;
}

// The eight public-safe views created by supabase/migrations/0009_public_views.sql,
// rebuilt (resources_public) or removed (partners_public) by
// supabase/migrations/0013_reconcile_partners.sql, and restored
// (partners_public) with resources_public rebuilt again by
// supabase/migrations/0014_partner_logos.sql, plus settings_public as a
// ninth added by supabase/migrations/0016_settings_public.sql (SP2a Task 1).
// This is the entire anonymous read surface (CLAUDE.md: "Anonymous reads go
// through public-safe views that exclude views, clicks, CTR, submitter
// emails and internal notes").
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

// ---------------------------------------------------------------------
// The column-level public surface: for every *_public view, the exact
// list of output columns anonymous readers are allowed to see.
//
// Unlike the three registries around it, this is NOT an exception list.
// It is a declaration: the intended anonymous read surface, written down
// once so a guard can compare it against what the database actually
// projects. It is the *whole* anonymous read surface only in combination
// with G10 and G12, which are what forbid anon from selecting any
// relation that is not a registered *_public view, or executing any
// function at all. There is therefore no per-entry `approvedIn`/`why`
// and no slot to add "except this one column" -- adding a name here IS
// the assertion that the column is safe for anonymous readers, and G17
// below has no other exception path.
//
// Why it lives here and not in the migrations. The whole value of this
// registry is that it is a *second, independent* statement of the public
// surface, maintained apart from the DDL that creates it. A registry
// expressed in the migrations -- as a table, a view comment, or anything
// else the schema carries -- would be edited by the very same migration
// that adds a column to a view, so a leak and its own authorisation
// would arrive in one act and the guard would certify itself. The
// reviewer's `r.status::text as availability` leak was exactly one
// migration edit; a migrations-resident registry would have been part of
// that edit. Two files that must agree, changed deliberately together,
// is the property being bought. Three further reasons point the same
// way: migrations are an append-only history, so a registry living there
// could never be read as current state without replaying it; the guard
// needs no schema change at all, since seed.sql's relation_columns()
// already exposes every view's output columns; and adding a migration
// would put test-only surface into production for no benefit, which is
// the same reasoning that keeps the introspection helpers in seed.sql.
//
// The lists are the views' own column order (pg_attribute.attnum), not
// alphabetical, so this file reads against the `create view` statements
// in supabase/migrations/0009_public_views.sql, 0014_partner_logos.sql,
// 0016_settings_public.sql and 0017_need_counts_secondary.sql side by
// side. G17/G18 compare as sets, so the order is for the reader only.
//
// What is deliberately absent, per CLAUDE.md ("Anonymous reads go
// through public-safe views that exclude views, clicks, CTR, submitter
// emails and internal notes"): resources.status in every form, including
// a cast or a rename -- resources_public filters on it and must never
// project it (PRD 4.2: a past deadline never transitions status, so the
// public surface gets the derived is_closed/days_left instead); and
// every analytics counter, submitter email and internal note on the base
// tables behind these nine views.
export const PUBLIC_VIEW_COLUMNS: Record<string, readonly string[]> = {
  resources_public: [
    'id',
    'name',
    'partner_name',
    'partner_logo_url',
    'partner_website_url',
    'partner_tier',
    'resource_type',
    'need_primary',
    'need_secondary',
    'sub_category',
    'description',
    'description_fr',
    'description_pt',
    'description_ar',
    'action_label',
    'external_url',
    'banner_image_url',
    'countries_eligible',
    'sectors_eligible',
    'stages_eligible',
    'geo_scope',
    'deadline',
    'is_featured',
    'exclusivity',
    'sort_order',
    'added_date',
    // Derived in the view from `deadline`, which is why they are here and
    // `status` is not: they carry the public meaning of a passed deadline
    // without carrying the internal pipeline state that produced it.
    'is_closed',
    'days_left',
  ],
  partners_public: ['name', 'logo_url', 'website_url', 'sort_order'],
  headline_stats_public: ['id', 'value', 'label', 'is_hero', 'sort_order'],
  compute_metrics_public: ['id', 'value', 'label', 'sub_note', 'sort_order'],
  site_content_public: ['key', 'value', 'locale'],
  programmes_public: ['id', 'title', 'timeframe', 'description', 'sort_order'],
  impact_stories_public: ['id', 'organisation', 'country', 'description', 'sort_order'],
  need_counts_public: ['need', 'live_count'],
  settings_public: ['key', 'value'],
};

// Total registered columns across all nine views, pinned for the same
// reason EXPECTED_ANON_SELECTABLE is: adding a column to the public
// surface should cost two coordinated, visible edits in one diff -- the
// column name and this number -- not one line appended to a list.
export const EXPECTED_PUBLIC_VIEW_COLUMNS = 59;

// Keyed by `proname(identity_args)` (e.g. `"my_fn(a text, b int)"`), not
// proname alone -- matching how G12 in tests/rls/schema-guards.test.ts
// looks entries up and how it prints an offender, so two overloads of the
// same function name cannot share one slot.
//
// This list was written empty, and its original note said so in as many
// words: anonymous writes get no slot, because "the public submission form,
// digest signup and contact form all need an anonymous-facing insert, and the
// correct implementation is a server action holding the service_role client
// behind Zod validation and a rate limit -- never `grant insert on
// public.submissions to anon`. Leaving a slot here guarantees it eventually
// gets used for exactly that shortcut, so there is no slot to fill."
//
// That reasoning is kept above rather than deleted, because the fear behind
// it is still right and still binding: no anonymous role may hold a DML grant
// on a base table, and nothing below changes that.
//
// What changed is the prescribed remedy, which SP3 reversed. Its
// tests/structure/service-role-containment.test.ts refuses any caller of
// createAdminSupabase beyond the Auth Admin invite, and
// src/lib/actions/README.md states the rule plainly -- service_role bypasses
// RLS entirely, so it takes the database's permission model out of the write
// path; "if a write is being refused, the fix is a policy or an RPC, not this
// client". Followed literally, the two documents prescribe opposite
// implementations of the same contact form, and the contradiction is real: it
// should be settled deliberately rather than by whichever guard a given
// change happens to trip first.
//
// The entry below is the resolution that satisfies both intents rather than
// either letter. It is not a table grant, so SP1's actual fear is untouched:
// `anon` still holds nothing on public.contact_messages, and this function
// exposes no SELECT, so the inbox cannot be read back. It is not
// service_role, so SP3's rule holds too. A `security definer` function with
// typed parameters is a narrower capability than either alternative -- three
// columns, one row shape, no dynamic SQL.
//
// The bar for a second entry stays exactly as high. This slot is for a write
// that a narrowly scoped function expresses completely; it is not a general
// opening for anonymous DML.
export const ANON_EXECUTABLE: Record<string, Exception> = {
  'submit_contact_message(p_name text, p_email text, p_message text)': {
    approvedIn: 'SP2a-T9',
    why: 'PRD 9.1s public contact form, which by design has no caller to authenticate. Grants EXECUTE only: anon holds no grant and no insert policy on contact_messages, the function exposes no SELECT so the inbox cannot be read back, and its three typed parameters reach only name/email/message -- source_ip_hash, delivered_at and delivery_error are unreachable, so a submitter cannot mark their own message delivered. Bounds are re-checked in the function body, so they hold for a caller holding the anon key who never touches the application.',
  },
  'submit_resource_suggestion(p_resource_name text, p_organisation text, p_need text, p_link text, p_description text, p_programme_contact_email text, p_submitter_name text, p_submitter_email text, p_source_ip_hash text)': {
    approvedIn: 'SP2b-T1',
    why: 'PRD 4.5s public Suggest a resource form, the second anonymous-facing write 0020 anticipated. Grants EXECUTE only: anon holds no grant and no insert policy on submissions, the function exposes no SELECT so the queue cannot be read back, and it inserts type = new_resource only -- status, reviewed_by, reviewed_at, rejection_reason and target_resource_id have no parameter, so a submitter can neither approve their own suggestion nor file an update against a resource of their choosing. Rate-limited in the body (3 per address and 5 per IP hash per hour, 60 in total per 10 minutes; migration 0024 states the numbers) as errcode 54000, so the limit holds for a caller who never touches the application.',
  },
};

// Base tables that legitimately carry no audit trigger (G15).
//
// SP3's migration 0018_audit_triggers.sql attaches public.audit_row_change to
// every base table with a write policy -- all fifteen, including the ones whose
// admin screens are deferred -- so that no later screen can ship against an
// unrecorded write path by omission. These two are the exemptions of principle
// rather than of convenience, and the list must stay this short: an entry here
// is a table whose writes nobody can reconstruct afterwards.
export const AUDIT_EXEMPT: Record<string, Exception> = {
  audit_log: {
    approvedIn: 'SP3-T1',
    why: 'Has no write policy for any role and is append-only by trigger; a table recording its own inserts into itself is circular, and the append-only triggers already make the recording pointless.',
  },
  engagement_events: {
    approvedIn: 'SP3-T1',
    why: 'A high-volume first-party stream that is already the record of its own writes; mirroring every page view into the who-did-what log would bury human actions under machine traffic.',
  },
};

export const EXPECTED_ANON_SELECTABLE = 9;
export const EXPECTED_ANON_EXECUTABLE = 2;
export const EXPECTED_AUDIT_EXEMPT = 2;
