# SP3 ledger

The running record for SP3, the authenticated admin portal. Separate from the
design spec and the implementation plan on purpose: the spec says what the
design *is*, the plan says how to build it, and this file says what was
decided, when, by whom, and what is still open. When a decision changes, the
row here changes and the spec is edited to match — the spec never carries two
versions of an answer, and this file never carries a design.

- Design spec: `docs/superpowers/specs/2026-07-30-sp3-admin-portal-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-30-sp3-admin-launch.md`
- Branch: `sp3-admin-design` (documentation only), cut from
  `sp2a/public-read-surface` at `f44c7d4`

## Status

| | |
|---|---|
| Phase | Design settled, plan written, **no source code written** |
| Blocked on | Nothing. SP3 does not wait for SP2b |
| Next action | Execute plan Task 1, the audit spine, on an implementation branch |

## Decisions

Every row is a decision the human made or confirmed, with the date it was
made. "Ruling" means it overrides what an earlier draft said.

| # | Date | Decision | Status |
|---|---|---|---|
| D1 | 2026-07-30 | **Launch scope is seven routes**: `/admin/login`, `/admin` (Dashboard shell), `/admin/resources`, `/admin/content`, `/admin/settings`, `/admin/users`, `/admin/audit` | Settled |
| D2 | 2026-07-30 | **Users is in launch scope.** After `scripts/provision-admins.ts` bootstraps the first two admins, this screen is the only non-operator path to the rest of the client team — invite, role change, deactivate | Settled |
| D3 | 2026-07-30 | **Subscribers, Partnerships, Reach & Engagement, Review Queue, Updates, and every `engagement_events`-derived panel are deferred**, and are **not** scaffolded as empty routes. A route that does not exist asks no questions; an empty one reads as broken | Settled |
| D4 | 2026-07-30 | **SP3 does not wait for SP2b.** Nothing in launch scope needs an engagement event, a submission or a subscriber | Ruling — the earlier draft left this open |
| D5 | 2026-07-30 | **The Dashboard may state that reporting is unavailable; it may not render a card for a figure it cannot source.** Not zero, not a dash styled as a value | Settled |
| D6 | 2026-07-30 | **GA4 config, `contact_email` and the two feature flags move off Site Content to an admin-only `/admin/settings`.** Site Content keeps the six editor-writable content areas. PRD §3's capability table already separates them; §6.7's panel list is the section that contradicts it | Ruling — deviates from PRD §6.7, reasoned in spec §3.1 |
| D7 | 2026-07-30 | **Every server action enforces its own role**, with its own allowed set, as its first statement. Hiding a control is not authorization | Settled (already binding in `src/lib/actions/README.md`; what is new is per-action rather than per-screen) |
| D8 | 2026-07-30 | **Audit rows are written by a database trigger inside the mutation's own transaction**, by a `security definer` function with a pinned `search_path`, no dynamic SQL, and no callable surface. A failed audit insert aborts the mutation | Ruling — replaces the earlier draft's caller-mutation-plus-service-role-audit-insert |
| D9 | 2026-07-30 | **The claim that every admin write needs `createAdminSupabase()` is withdrawn.** Ordinary resource, content, settings and profile writes run as the caller under RLS. The service-role key has exactly one production caller: the Auth Admin invite | Ruling — the earlier draft's central finding, corrected |
| D10 | 2026-07-30 | **Viewers see no write control at all — not a disabled one.** Settings and Users `notFound()` for them rather than redirecting with a message | Settled |
| D11 | 2026-07-30 | **The public/admin split holds.** SP2a owns readers, rendering, cache tags and responding to invalidation; SP3 owns admin UI, validation, mutations, permissions, and triggering invalidation after a successful commit. SP3 does not duplicate or modify the public implementation | Settled |
| D12 | 2026-07-30 | The audit trigger is attached to **all fifteen write-policied tables**, not only the eight the launch screens touch, so no later screen can ship against an unaudited table by omission. Guard G15 enforces it; the exemption registry holds two entries (`audit_log`, `engagement_events`) | Design choice inside D8 |
| D13 | 2026-07-30 | `audit_log.change_summary` is composed in SQL at write time. This is the **one documented exception** to "no hardcoded user-facing strings": an audit entry must read later exactly as it read when written, and the string never appears in `src/`, so no guard is evaded | Design choice inside D8, reasoned in spec §4.4 |
| D14 | 2026-07-30 | `audit_log.ip_hash` and `user_agent` stay **null**. The only values a trigger can see describe the Next.js server, not the operator's browser; recording them would be a fabricated value dressed as evidence | Design choice inside D8 |

## Open questions

Product or client decisions, not architecture. None blocks execution.

| # | Question | Recommendation | Owner |
|---|---|---|---|
| Q1 | Role assignment per named user (PRD §16.4 open question) — who is admin, editor, viewer | The two bootstrap admins must be named before `provision-admins.ts` runs; everyone else can be invited and changed in seconds afterwards | Client |
| Q2 | Audit granularity for a batched panel save: one row per database row changed (what the trigger does) or one row per user-visible action (needs the RPC hatch, spec §4.5) | Ship per-row. Revisit only if the log reads as noise in practice | Product |
| Q3 | Does the Dashboard name its missing dependency, and in whose words? | The locale key exists with draft copy; K&S may revise it without touching code | K&S |
| Q4 | Users screen: hard delete, or deactivate only? | Deactivate only, no delete control. Deactivation is complete at the database layer and keeps the audit trail readable | Product — recommendation adopted in the plan |
| Q5 | Per-operator forensics (`ip_hash`, `user_agent`) for admin operations | Out of scope; if the programme's security review wants it, that is the RPC hatch plus a hash computed in Node, as a scoped follow-up | Security review |
| Q6 | Wording for the `system` actor sentinel in the Audit Log | Locale key, copy decision | K&S |
| Q7 | Should "never fewer than two admins" be a hard database invariant? The action-level guard only stops an admin demoting or deactivating themselves, which is the common accident, not the general case | A database check or trigger, as a scoped follow-up after launch. Counting admins in the action would be a race | Product |

## Follow-ups deliberately left out of launch

| Item | Why not now | Where it goes |
|---|---|---|
| Automatic `updates_log` entries (PRD §4.14) | Ships with the deferred Updates screen; the same trigger mechanism applies | With Updates |
| The `security definer` RPC hatch (spec §4.5) | No launch-scope operation needs it. The deferred screens will — approving a submission, sending a digest | SP3 follow-up or SP5 |
| Digest subscriber matching tests | Named in CLAUDE.md as required coverage, but there is no matching logic in SP3's scope to test | With Alerts & Subscribers |
| `force row level security` on any table | Must **never** be added to `audit_log`: the trigger's insert depends on the table owner not being subject to its own policies | Never |

## Verification

Filled in when the plan's Task 9 runs. Empty means not done, not passed.

- [ ] Viewer session: four sidebar entries, `/admin/settings` and
      `/admin/users` 404, no Actions column, no form on Site Content, Audit
      Log fully readable
- [ ] Editor session: Resources and Site Content editable, Settings and Users
      404, direct `saveSetting` call refused
- [ ] Admin session: every screen works; an invite produces two audit rows
      (one `created` as `system`, one attributed to the admin)
- [ ] Publish in admin appears on the public directory with no rebuild;
      unpublish removes it
- [ ] Dashboard shows four counted figures and no reach, growth or click card
- [ ] Built bundles under `.next/` contain no `service_role` string and no
      service-role token
- [ ] `npm run db:reset && npm run build && npm test && npm run typecheck && npm run lint` all pass

## Changelog

| Date | Change |
|---|---|
| 2026-07-30 | Design spec written on `sp3-admin-design`, grounded in the schema at `f44c7d4`, leaving three decisions open (scope, SP2b dependency, audit consistency) |
| 2026-07-30 | All three closed by the human: D1–D5 (scope), D4 (no SP2b dependency), D8–D9 (atomic audit, service-role narrowed). Spec revised, implementation plan written, `docs/deployment.md` service-role note corrected, `src/lib/actions/README.md` audit contract corrected, this ledger created |
