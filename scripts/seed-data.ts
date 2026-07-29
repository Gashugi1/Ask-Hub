/**
 * ============================================================================
 * PLACEHOLDER CONTENT — NOT THE CLIENT'S DATASET.
 * ============================================================================
 *
 * Everything below is transcribed from the prototype's `seed()` method (the
 * demo app the client reviewed before this rebuild started). The client's
 * real dataset has not arrived. This module exists so the site has
 * something real-shaped to render in the meantime, and it is expected to be
 * REPLACED WHOLESALE the moment real partner names, resources, programmes
 * and copy are supplied. Do not treat any name, URL, description or figure
 * here as confirmed, current, or delivered.
 *
 * Three categories of prototype content are deliberately absent, not
 * forgotten:
 *   - `impact_stories`, `headline_stats` and `compute_metrics` get no rows
 *     (the prototype's numbers are unsourced demo figures, and CLAUDE.md
 *     forbids seeding a plausible-looking metric onto a UN programme's
 *     reporting surface).
 *   - `programmes` gets no rows either, on later human review: every one of
 *     the prototype's six programme descriptions carries an unattested AI
 *     Hub performance figure of its own — "120 companies... 376
 *     applications", "10 ventures... 135 applications", "Mobilising up to
 *     $10B by 2035, targeting up to 45M jobs" — and `programmes_public` is
 *     anon-readable, so seeding them would put the same class of unattested
 *     claim CLAUDE.md forbids in front of a public visitor, just in prose
 *     rather than in a number column. This is a different case from the
 *     `resources` descriptions kept below: "Up to $150K in Azure credits" is
 *     Microsoft's own offer terms (directory content about someone else's
 *     programme, inherent to what a directory is), not the AI Hub reporting
 *     its own performance. `programmes` stays empty until the client
 *     supplies attested copy, consistent with the three tables above.
 *   - The four tables that would carry a real person's email address, a
 *     public proposal, a digest send history, or per-visit analytics get no
 *     rows either (the prototype's version of each is fabricated personal
 *     data / reporting history that must never enter a real system, even as
 *     a placeholder — deliberately not named here; see the note on
 *     scripts/seed.ts for why).
 * See task-12a-brief.md for the full table of what is and is not seeded
 * (programmes at 0 rows is a later human decision, made after that brief was
 * written — see task-12a-report.md's fix report for the full reasoning).
 *
 * No `@/*` imports here or anywhere under scripts/: vitest aliases `@` to
 * `./src`, but `tsx` (which runs `npm run seed`) does not, so a module that
 * typechecks and passes tests would still crash at runtime. Every union
 * below is declared locally instead of imported from generated types.
 *
 * This file is data only: no logic, no Supabase client, no database access.
 * scripts/seed.ts is the runner that upserts these arrays.
 */

// Mirrors supabase/migrations/0002_enums.sql and 0013_reconcile_partners.sql
// exactly. Declared locally (see file header) rather than imported from
// src/lib/supabase/database.types.ts.
export type ResourceStatus = 'live' | 'pipeline' | 'reference';
export type NeedType = 'compute' | 'training' | 'funding' | 'accelerator' | 'partners';
export type GeoScope = 'global' | 'all_africa' | 'partner_countries' | 'specific';
export type PartnerTier =
  | 'strategic'
  | 'government'
  | 'development_partner'
  | 'academic'
  | 'network';
export type Exclusivity = 'exclusive' | 'early_access';

// ============================================================================
// Partners — 19 rows, names only.
// ============================================================================
//
// `logo_url` and `website_url` are both null for every row: the prototype
// carries no partner URLs at all (its favicon-domain trick even misattributes
// Stanford to coursera.org — see 0013_reconcile_partners.sql), and the client
// has not supplied real ones. supabase/migrations/0014_partner_logos.sql
// keeps both columns nullable for exactly this reason: a partner row can
// exist before its asset pair (logo + site) arrives, and
// `partners_logo_requires_site` only refuses a logo with no link, which a
// name-only row never triggers.
//
// "Cyber 4.0 and Cisco" is kept as one combined name, matching the prototype
// exactly, even though it names two organisations. An earlier ruling called
// for splitting it into two partner rows so each could carry its own logo
// and link. That split is deferred to the real dataset: splitting a
// placeholder name now produces two logo-less rows that will not match
// whatever the client's real data calls these two organisations anyway, and
// the one resource that names this partner (`cyber4africa`) is seeded as
// `pipeline` regardless (see the resources section below) — the ambiguity
// is not currently public-facing.
//
// "Deep Learning Indaba" is included even though no seeded resource names it
// as a partner: it appears only on a prototype *submitted proposal* for a
// new resource (out of scope for this seed — see file header), but the task
// brief lists it among the 19 verbatim partner names, so it is seeded as a
// name-only row like the rest.
export const PARTNERS: readonly string[] = [
  'AfriLabs',
  'African Development Bank',
  'Air Street Capital',
  'Amazon Web Services',
  'CINECA / AI Hub',
  'Cyber 4.0 and Cisco',
  'Deep Learning Indaba',
  'European Commission',
  'GSMA',
  'Google',
  'Google / Kaggle',
  'Mercy Corps',
  'Meta',
  'Microsoft',
  'NVIDIA',
  'Orange',
  'Safaricom',
  'Stanford / Coursera',
  'Zindi',
];

// ============================================================================
// Resources — 20 rows, transcribed from the prototype's seed() `resources`
// array (its `R()` factory defaults applied, then its `META` overrides
// merged in, exactly as the prototype's own `forEach` does at runtime).
// ============================================================================
//
// Field mapping applied uniformly below, not repeated per row:
//   - `partner_tier`: prototype's Strategic|Government|Development
//     partner|Academic|Network, lowercased/snake_cased to match
//     supabase/migrations/0013_reconcile_partners.sql's enum.
//   - `status`: prototype's Live|Pipeline|Reference, lowercased. The
//     prototype's R() factory defaults `status` to 'Live' — a row with no
//     explicit status in the prototype IS live, not pipeline. Applied here
//     except for the one deliberate demotion noted on `cyber4africa` below.
//   - `exclusivity`: '' -> null, 'Exclusive to AskHub' -> 'exclusive',
//     'Early access' -> 'early_access'.
//   - `geo_scope`: Global -> 'global', 'All Africa' -> 'all_africa',
//     '18 priority countries' -> 'partner_countries', 'Selected' ->
//     'specific'.
//   - `sectors_eligible`: every one of these 20 resources carries the
//     prototype's sentinel `sectors: 'All'` (none override it), which means
//     "all sectors" — transcribed as `[]`, never as `['All']` (which would
//     read as a literal, single sector named "All").
//   - `banner_image_url`: the prototype's `image` field is `''` on every one
//     of these 20 resources — transcribed as `null`.
//   - `description_fr` / `description_pt` / `description_ar`: the prototype
//     has no translated copy at all. Left `null` rather than invented —
//     locales/en.json stubs exist for fr/pt/ar, but resource copy is not a
//     UI string and has no source translation here.
//   - Dropped entirely, matching the brief: `views`, `clicks`, `match_weight`
//     (fabricated-metric columns that do not exist on `resources`),
//     `verified` (no such column — the per-resource "Verified" badge the
//     prototype renders is exactly what content rule 10.x forbids; curation
//     is stated once, globally, via site_content), `notified`, and the
//     prototype's own `id` (the real table generates its own uuid).
//   - `added_date` is transcribed from the prototype's `added` field
//     (merged with its `META` override where present) rather than left to
//     default to `current_date` — the prototype gives an explicit date for
//     every one of these 20 rows, so defaulting to today would silently
//     discard real (if placeholder) information.
export interface SeedResource {
  name: string;
  partner: string;
  partner_tier: PartnerTier;
  resource_type: string;
  need_primary: NeedType;
  need_secondary: NeedType | null;
  sub_category: string | null;
  description: string;
  action_label: string;
  external_url: string;
  banner_image_url: string | null;
  countries_eligible: string[];
  sectors_eligible: string[];
  stages_eligible: string[];
  geo_scope: GeoScope;
  deadline: string | null;
  status: ResourceStatus;
  is_featured: boolean;
  exclusivity: Exclusivity | null;
  added_date: string;
}

export const RESOURCES: readonly SeedResource[] = [
  {
    name: 'Microsoft for Startups Founders Hub',
    partner: 'Microsoft',
    partner_tier: 'strategic',
    resource_type: 'Credits',
    need_primary: 'compute',
    need_secondary: 'training',
    sub_category: 'Cloud credits',
    description:
      'Up to $150K in Azure credits, plus access to OpenAI, GitHub Enterprise, and developer tools for early-stage AI startups.',
    action_label: 'Apply on Microsoft',
    external_url: 'https://startups.microsoft.com/en-us/founders-hub/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Getting started', 'Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: true,
    exclusivity: null,
    added_date: '2026-05-12',
  },
  {
    name: 'AWS Activate',
    partner: 'Amazon Web Services',
    partner_tier: 'strategic',
    resource_type: 'Credits',
    need_primary: 'compute',
    need_secondary: null,
    sub_category: 'Cloud credits',
    description:
      'Up to $100K in AWS credits, plus technical support and training for startups building on AWS.',
    action_label: 'Apply on AWS',
    external_url: 'https://aws.amazon.com/startups/credits/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-05-12',
  },
  {
    name: 'CINECA Leonardo',
    partner: 'CINECA / AI Hub',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'compute',
    need_secondary: null,
    sub_category: 'HPC allocation',
    description:
      "GPU hours on Europe’s leading HPC facility, dedicated to African AI researchers and builders.",
    action_label: 'Apply for allocation',
    external_url: 'https://leonardo-supercomputer.cineca.eu/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'partner_countries',
    deadline: '2026-07-31',
    status: 'live',
    is_featured: true,
    // Prototype META override: 'Exclusive to AskHub'.
    exclusivity: 'exclusive',
    added_date: '2026-06-02',
  },
  {
    name: 'Microsoft AI Fluency',
    partner: 'Microsoft',
    partner_tier: 'strategic',
    resource_type: 'Course',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'Curriculum',
    description:
      'Foundational AI skills curriculum, ready to deploy immediately, available in 22 languages.',
    action_label: 'Start the curriculum',
    external_url: 'https://learn.microsoft.com/en-us/training/paths/ai-fluency/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['New to AI', 'Getting started'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-07-06',
  },
  {
    name: 'AfriLabs Talent Hub & AI Community',
    partner: 'AfriLabs',
    partner_tier: 'network',
    resource_type: 'Programme',
    need_primary: 'training',
    need_secondary: 'partners',
    sub_category: 'Training pathway',
    description:
      'A 10-week training pathway delivered through 450+ innovation hubs across 53 African countries.',
    action_label: 'Register',
    external_url: 'https://www.afrilabs.com/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['New to AI', 'Getting started'],
    geo_scope: 'all_africa',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-18',
  },
  {
    name: 'NVIDIA Inception',
    partner: 'NVIDIA',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'accelerator',
    need_secondary: 'compute',
    sub_category: 'Startup programme',
    description:
      'A free programme for AI startups: technical training, GPU credits, marketing support, and investor connections.',
    action_label: 'Join Inception',
    external_url: 'https://www.nvidia.com/en-us/startups/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: true,
    exclusivity: null,
    added_date: '2026-06-25',
  },
  {
    // DEMOTED live -> pipeline (deviation from the prototype, which defaults
    // this row to 'Live' with no explicit status). PRD §15 licenses seeding
    // a resource with an unconfirmed URL as pipeline rather than publishing
    // it broken. Two independent reasons here, either one sufficient:
    //   1. `external_url` is a path on AskHub's own domain
    //      (aihubfordevelopment.org/cyber4africa-programme), not a page on
    //      either named partner's site — it cannot be confirmed as the
    //      partner's real application URL from the prototype alone.
    //   2. `partner` is the combined name "Cyber 4.0 and Cisco" (two
    //      organisations); which one this URL and the "Apply now" action
    //      actually belong to is unresolved (see the partners section
    //      above for the same ambiguity).
    // A pipeline resource is admin-visible but not public, so this is the
    // safe default until the client confirms the real programme URL.
    name: 'Cyber4Africa Programme',
    partner: 'Cyber 4.0 and Cisco',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'Security training',
    description:
      'AI security and cybersecurity training programme for African startups, delivered in partnership with Italian institutions.',
    action_label: 'Apply now',
    external_url: 'https://aihubfordevelopment.org/cyber4africa-programme',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'partner_countries',
    deadline: '2026-07-18',
    status: 'pipeline',
    is_featured: false,
    // Prototype META override: 'Early access'. Kept as transcribed even
    // though the row is seeded pipeline — the badge only ever renders
    // publicly once (if ever) a human promotes this row to live, at which
    // point it will reflect the prototype's original intent.
    exclusivity: 'early_access',
    added_date: '2026-05-28',
  },
  {
    name: 'Zindi Community',
    partner: 'Zindi',
    partner_tier: 'network',
    resource_type: 'Community',
    need_primary: 'partners',
    need_secondary: 'training',
    sub_category: 'Data science community',
    description:
      "Africa’s largest data science community — competitions, challenges, learning paths, and job opportunities.",
    action_label: 'Join Zindi',
    external_url: 'https://zindi.africa',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['New to AI', 'Getting started', 'Building', 'Scaling'],
    geo_scope: 'all_africa',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-07-04',
  },
  {
    name: 'Google AI Essentials',
    partner: 'Google',
    partner_tier: 'strategic',
    resource_type: 'Course',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'AI literacy',
    description:
      'Foundational AI literacy course — self-paced, no prerequisites, certificate on completion.',
    action_label: 'Start learning',
    external_url: 'https://grow.google/ai-essentials',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['New to AI', 'Getting started'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-07-07',
  },
  {
    name: 'Stanford Machine Learning Specialisation',
    partner: 'Stanford / Coursera',
    partner_tier: 'academic',
    resource_type: 'Course',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'Specialisation',
    description:
      'Three-course specialisation in supervised and unsupervised learning, taught by Andrew Ng.',
    action_label: 'Enrol on Coursera',
    external_url: 'https://www.coursera.org/specializations/machine-learning-introduction',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Getting started', 'Building'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-05-20',
  },
  {
    name: 'Kaggle Datasets & Competitions',
    partner: 'Google / Kaggle',
    partner_tier: 'network',
    resource_type: 'Community',
    need_primary: 'training',
    need_secondary: 'partners',
    sub_category: 'Datasets & competitions',
    description: 'Datasets, competitions, notebooks, and a global data science community.',
    action_label: 'Explore Kaggle',
    external_url: 'https://www.kaggle.com',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Getting started', 'Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-10',
  },
  {
    name: 'AfDB Digital Jobs Programme',
    partner: 'African Development Bank',
    partner_tier: 'development_partner',
    resource_type: 'Programme',
    need_primary: 'training',
    need_secondary: 'funding',
    sub_category: 'Workforce programme',
    description:
      "Training and placement programme building Africa’s digital workforce, with pathways into AI and data roles.",
    action_label: 'Apply now',
    external_url:
      'https://www.afdb.org/en/topics-and-sectors/initiatives-partnerships/digital-skills-and-jobs-for-youth',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Getting started', 'Building'],
    geo_scope: 'all_africa',
    deadline: null,
    status: 'live',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-07-03',
  },
  {
    name: 'Google for Startups Africa',
    partner: 'Google',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'funding',
    need_secondary: 'accelerator',
    sub_category: 'Accelerator & fund',
    description:
      "Equity-free support, mentorship, and up to $200K for African startups in Google’s accelerator network.",
    action_label: 'Apply now',
    external_url: 'https://www.googleforstartups.com/regions/africa',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'all_africa',
    deadline: '2026-07-10',
    // Prototype's own explicit status, unchanged.
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-20',
  },
  {
    name: 'Meta Llama Impact Grants',
    partner: 'Meta',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'funding',
    need_secondary: null,
    sub_category: 'Grants',
    description:
      'Grants for teams using open Llama models to address social and economic challenges.',
    action_label: 'Apply now',
    external_url: 'https://llama-impact.org/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'global',
    deadline: '2026-06-30',
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-12',
  },
  {
    name: 'Mercy Corps Ventures',
    partner: 'Mercy Corps',
    partner_tier: 'development_partner',
    resource_type: 'Fund',
    need_primary: 'funding',
    need_secondary: null,
    sub_category: 'Early-stage capital',
    description:
      'Early-stage capital and venture support for startups serving climate-vulnerable and underserved communities.',
    action_label: 'Pitch to MCV',
    external_url: 'https://www.mercycorpsventures.org/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'all_africa',
    deadline: null,
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-15',
  },
  {
    name: 'Orange Ventures Africa',
    partner: 'Orange',
    partner_tier: 'strategic',
    resource_type: 'Fund',
    need_primary: 'funding',
    need_secondary: null,
    sub_category: 'Corporate VC',
    description:
      "Corporate venture fund investing in startups across Orange’s African and Middle Eastern footprint.",
    action_label: 'Apply now',
    external_url: 'https://orangeventures.fr/en',
    banner_image_url: null,
    // Transcribed verbatim from the prototype, including the full country
    // name — CLAUDE.md requires "Democratic Republic of the Congo" in full,
    // never "DRC", and the prototype already writes it this way here.
    countries_eligible: [
      'Senegal',
      "Côte d'Ivoire",
      'Morocco',
      'Tunisia',
      'Democratic Republic of the Congo',
      'Egypt',
    ],
    sectors_eligible: [],
    stages_eligible: ['Scaling'],
    geo_scope: 'specific',
    deadline: null,
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-22',
  },
  {
    name: 'Safaricom Spark Venture Fund',
    partner: 'Safaricom',
    partner_tier: 'strategic',
    resource_type: 'Fund',
    need_primary: 'funding',
    need_secondary: null,
    sub_category: 'Corporate VC',
    description:
      'Venture fund backing growth-stage East African tech companies building on mobile and data rails.',
    action_label: 'Apply now',
    external_url: 'https://sparkvf.safaricom.co.ke/',
    banner_image_url: null,
    countries_eligible: ['Kenya', 'Ethiopia'],
    sectors_eligible: [],
    stages_eligible: ['Scaling'],
    geo_scope: 'specific',
    deadline: null,
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-25',
  },
  {
    name: 'GSMA Innovation Fund — Africa',
    partner: 'GSMA',
    partner_tier: 'strategic',
    resource_type: 'Programme',
    need_primary: 'funding',
    need_secondary: 'accelerator',
    sub_category: 'Grant fund',
    description: 'Grant funding and technical assistance for digital innovation with development impact.',
    action_label: 'Apply now',
    external_url: 'https://www.gsma.com/innovation/accelerate-africa/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['Building', 'Scaling'],
    geo_scope: 'all_africa',
    deadline: null,
    status: 'pipeline',
    is_featured: false,
    exclusivity: null,
    added_date: '2026-06-28',
  },
  {
    name: 'State of AI Report',
    partner: 'Air Street Capital',
    partner_tier: 'network',
    resource_type: 'Report',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'Research reference',
    description:
      'Annual review of AI research, industry, and geopolitics — background reading for the team.',
    action_label: 'Read the report',
    external_url: 'https://www.stateof.ai/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    // Prototype gives this row no `stages` override, so the R() factory
    // default (all four stages) applies, same as every other resource here.
    stages_eligible: ['New to AI', 'Getting started', 'Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'reference',
    is_featured: false,
    exclusivity: null,
    // No META override for this id — the R() factory default applies.
    added_date: '2026-05-12',
  },
  {
    name: 'EU AI Act Summary',
    partner: 'European Commission',
    partner_tier: 'government',
    resource_type: 'Report',
    need_primary: 'training',
    need_secondary: null,
    sub_category: 'Policy reference',
    description:
      "Summary of the EU AI Act’s risk tiers and obligations — reference for policy conversations with partners.",
    action_label: 'Read the summary',
    external_url: 'https://artificialintelligenceact.eu/',
    banner_image_url: null,
    countries_eligible: [],
    sectors_eligible: [],
    stages_eligible: ['New to AI', 'Getting started', 'Building', 'Scaling'],
    geo_scope: 'global',
    deadline: null,
    status: 'reference',
    is_featured: false,
    exclusivity: null,
    // No META override for this id — the R() factory default applies.
    added_date: '2026-05-12',
  },
];

// ============================================================================
// Programmes are NOT seeded. See the file header above for why: all six of
// the prototype's programme descriptions carry an unattested AI Hub
// performance figure, and programmes_public is anon-readable. `programmes`
// stays at 0 rows, same as impact_stories/headline_stats/compute_metrics,
// until the client supplies attested copy.
// ============================================================================

// ============================================================================
// Site content — the prototype's `settings.welcome` and `settings.identity`,
// flattened into (key, locale, value) rows.
// ============================================================================
//
// Key names (`welcome_title`, `welcome_body`, ...) are this seed's own
// invention — the prototype has no key/locale structure at all (it renders
// `settings.welcome.title` etc. directly) and no naming convention exists
// yet elsewhere in the codebase (checked: no other seed or source file
// establishes one). All rows are `locale: 'en'`; fr/pt/ar are stubs only
// (CLAUDE.md), not seeded here.
//
// Two content-rule rewrites applied — see task-12a-report.md for the full
// before/after of both:
//   1. `identity_align` drops the prototype's "Italy–Africa Mattei Plan"
//      clause entirely. CLAUDE.md: "'CINECA Leonardo' with no 'Mattei
//      Plan'". (The prototype's *second* Mattei Plan mention, on a
//      `partnerships` row -- "Leonardo GPU allocations under the Mattei
//      Plan" -- needs no rewrite here because `partnerships` is out of this
//      task's scope and is not seeded at all; it simply never lands.)
//   2. `welcome_body` drops the prototype's "Curated and verified by the AI
//      Hub team." sentence. The prototype states this curation claim in
//      three different wordings across the app; content rule 10.8 wants it
//      stated once. `identity_lead` already carries the brief's canonical
//      wording verbatim ("Every resource is curated and verified by the AI
//      Hub team.") unchanged, so it is kept as the single instance and the
//      duplicate in `welcome_body` is removed rather than rephrased.
export interface SeedSiteContent {
  key: string;
  locale: string;
  value: string;
}

export const SITE_CONTENT: readonly SeedSiteContent[] = [
  {
    key: 'welcome_title',
    locale: 'en',
    value: 'Welcome to AskHub',
  },
  {
    key: 'welcome_body',
    locale: 'en',
    // Rewritten: dropped the trailing "Curated and verified by the AI Hub
    // team." sentence (see the rule-2 rewrite note above).
    value:
      'The open directory for African AI — find the compute, funding, training, accelerators, and partners to move your idea forward.',
  },
  {
    key: 'welcome_cta',
    locale: 'en',
    value: 'Start exploring ↓',
  },
  {
    key: 'identity_lead',
    locale: 'en',
    // Unchanged: already matches the canonical curation sentence verbatim.
    value:
      'AskHub is the open directory of the AI Hub for Sustainable Development — co-led by MIMIT and UNDP. Every resource is curated and verified by the AI Hub team.',
  },
  {
    key: 'identity_align',
    locale: 'en',
    // Rewritten: dropped "and the Italy–Africa Mattei Plan" (see the
    // rule-1 rewrite note above). Everything else transcribed verbatim.
    value:
      'The AI Hub is aligned with the African Union AI Strategy, co-designing 20 programmes with the private sector over its mandate — across 18 partner countries and six priority sectors.',
  },
];
