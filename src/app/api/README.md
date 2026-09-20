# Route handlers

Route handlers only. Server actions live in `src/lib/actions/` — see the README
there for why.

`/api/health` is the only endpoint in the scaffold. Everything below is added by
the sub-project named against it, and each one is a **public write endpoint**,
so each needs Zod validation, a payload size cap, and — from SP4 — Cloudflare
Turnstile, a honeypot field, and per-IP plus per-session rate limiting
(PRD 14.6).

| Endpoint | Adds | Sub-project | Notes |
| --- | --- | --- | --- |
| `POST /api/events` | First-party engagement event write | SP2 | PRD 8.3. Fire-and-forget from the client, must never block or degrade rendering. Bot user agents flagged `is_bot = true`. No IP addresses stored. |
| `POST /api/contact` | Contact form | SP2 | PRD 9.1. Not in the lean release: the contact form was removed and the page now uses `mailto:`, so this application collects no personal data. `contact_messages`, its policies and `public.submit_contact_message` (0020) all remain, unused, for whenever the endpoint is built. |
| `POST /api/submissions` | Suggest a resource, suggest an update | SP2 | PRD 5.5, 5.3. **Suggest a resource is built, and not as a route handler**: the `/contact` form calls the `submitResourceSuggestion` server action (`src/lib/actions/suggestions.ts`), which runs on the visitor's anon client and calls `public.submit_resource_suggestion` (migration 0024) -- a `security definer` function that inserts one `pending` `new_resource` row, re-checks every cap and rate-limits in the body. Suggest an update is not yet built. |
| `POST /api/subscribers` | Alerts subscribe | SP2 | PRD 5.4, 9.2. Writes an unconfirmed row with `consent_text_version`; the confirmation email is SP5. |

None of these writes through the `service_role` client, and none may
(`tests/structure/service-role-containment.test.ts` refuses any caller beyond
the Auth Admin invite). The anonymous Postgres role holds **no insert policy on
any base table** (design doc 5.4.1); the pattern for an anonymous-facing write
is a narrowly scoped `security definer` function registered in
`tests/rls/security-allowlist.ts`'s `ANON_EXECUTABLE`, called from a server
action on the visitor's own client -- `submit_contact_message` (0020) and
`submit_resource_suggestion` (0024) are the two that exist. The function is the
boundary: it is reachable by anyone holding the public API key with or without
the application in front of it, so the caps and the rate limit have to live in
its body, and a validation that exists only in the action has no second line
of defence behind it.
