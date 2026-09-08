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

> **Superseded — 2026-09-08.** All nine SP3 tasks shipped and were merged into
> `sp2a/public-read-surface`; the audit-triggers migration is `0018_audit_triggers.sql`
> (renumbered from 0017 to resolve a live collision — see the migration header).
> The dated task rows and figures below are the historical record as written and
> are **not** current status: for the live state, read the code on
> `sp2a/public-read-surface` and run the suite (77 test files).

| | |
|---|---|
| Phase | **4 of 9 tasks complete** (1, 2, 3, 8). Task 4 in progress; 5, 6, 7 then 9 to follow |
| Blocked on | Nothing. The database outage that stalled Tasks 4–7 (Docker Desktop wedged half-up; its own tooling could not restart it) was cleared by the human on 2026-07-30. Verified on return: migrations through 0017 applied, content seeded, full suite 352 tests / 36 files green, so nothing built during the outage regressed |
| Next action | Finish Task 4, then 5, 6, 7, 9, then the final whole-branch review |
| Implementation branch | `sp3/audit-spine`, cut from `sp3-admin-design` |

### Task progress

| Task | State | Notes |
|---|---|---|
| 1. Audit spine | **Done** — `9fae580` | Migration `0018_audit_triggers.sql`, G15, 10 new trigger tests, atomicity proof. 327 tests / typecheck / lint / build green after a from-scratch `db:reset` |
| 2. Sign in, shell, Dashboard | **Done** — `dafb6ce`, fixed in `f49388b` | Review found two Important issues, both fixed: `next build` had silently become dependent on Supabase env vars at build time (fixed with `force-dynamic` on the admin layout plus prose in README and `.env.example`), and `session.ts` had no test pinning the one-message-for-every-failure rule that stops account enumeration |
| 3. Resources table | **Done** — `d159007` | Approved with no Critical or Important findings. Reviewer mutation-tested the 14-day boundary and the case-insensitive search to confirm those tests can fail |
| 4. Resource mutations | In progress | Verified by `tests/rls/admin-actions-resources.test.ts`; that suite is the verification. Also absorbs the three minors Task 3 deferred into its area |
| 5. Site Content | Ready | Five keys, not seven — the key names are not the PRD's, and Q8 was revised so SP3 does not invent the two public content keys it cannot render |
| 6. Settings | Ready | |
| 7. Users | Ready | The only service-role caller |
| 8. Audit Log screen | **Done** — `e5545d1`, fixed in `8634170` | Built early, out of plan order, because it was the only remaining task not gated on the database. One Important fixed: the filter panel shipped as a client component using `router.push` and is now a `GET` form matching the Resources pattern, with zero client JavaScript |
| 9. Launch sweep | Must follow Task 7 | Its service-role containment test pins the caller list to `src/lib/actions/users.ts`, which Task 7 creates; written earlier it would fail on zero callers |

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
| Q8 | **`privacy_copy` and `terms_copy` do not exist in `site_content`.** Found during Task 1: the table holds five keys of the seed's own invention (`welcome_title`, `welcome_body`, `welcome_cta`, `identity_lead`, `identity_align`), not PRD §4.12's seven names, and the two legal-copy keys are among the missing. `docs/deployment.md`'s pre-launch checklist gates going public on legal-reviewed Privacy and Terms copy being in `site_content`, and `/privacy` and `/terms` have no key to read | **Revised 2026-07-30, before Task 5 ran: do not add them in SP3.** On this branch `/privacy` and `/terms` do not exist, `getSiteContent` has no consumer, and `en.json` already carries `privacy.pending`/`terms.pending` — SP2a evidently intended to render those pages from locale copy. Seeding the keys now would create editable rows nothing reads: the same save-succeeds-changes-nothing failure, reached from the other side. It would also be SP3 deciding a public-rendering question that D11 reserves for SP2a, which has already shown it picks its own key names. So: Task 5 covers the five keys that exist, and whoever builds `/privacy` and `/terms` agrees the key names with the admin screen in the same change. The deployment checklist item stays open and visibly unresolved | Product + SP2a, no longer Task 5 |

## Follow-ups deliberately left out of launch

| Item | Why not now | Where it goes |
|---|---|---|
| Automatic `updates_log` entries (PRD §4.14) | Ships with the deferred Updates screen; the same trigger mechanism applies | With Updates |
| The `security definer` RPC hatch (spec §4.5) | No launch-scope operation needs it. The deferred screens will — approving a submission, sending a digest | SP3 follow-up or SP5 |
| Digest subscriber matching tests | Named in CLAUDE.md as required coverage, but there is no matching logic in SP3's scope to test | With Alerts & Subscribers |
| `force row level security` on any table | Must **never** be added to `audit_log`: the trigger's insert depends on the table owner not being subject to its own policies | Never |

## Verification

### Task 1, performed 2026-07-30

- [x] `npm run db:reset` applies `0018_audit_triggers.sql` to a clean database,
      then `npm run seed` restores placeholder content
- [x] 327 tests pass (31 files), including 10 new trigger tests and G15
- [x] `npm run typecheck`, `npm run lint` and `npm run build` clean
- [x] **The atomicity claim is tested, not asserted**: with the audit insert
      deliberately broken, an ordinary admin edit fails and the row is
      unchanged; the same edit succeeds once auditing works again
- [x] **G15 can fail**: dropping `programmes_audit` makes it name that table;
      restoring the trigger makes it green again
- [x] A `service_role` write records `actor_name = 'system'` with a null actor,
      rather than borrowing a person's name
- [x] A subscriber's address and both tokens are absent from `audit_log` in
      every form — diff redacted, label masked to `a***@domain`

### Launch sweep

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
| 2026-07-30 | Task 1 built and committed (`9fae580`) on `sp3/audit-spine`. D8 holds as designed — the SECURITY DEFINER trigger does insert into a table with no insert policy, and a failed audit insert does abort the mutation. Two design refinements made while building, both recorded in the migration: the label argument takes candidate columns rather than one (`profiles.full_name` defaults to `''`), and summaries use sentence case rather than `initcap`, which would have produced "Resource Type" and "In Discussion" against PRD §4.15's own examples. Q8 opened: `site_content` does not hold PRD §4.12's key names, and `privacy_copy`/`terms_copy` do not exist at all |
