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
| `POST /api/submissions` | Suggest a resource, suggest an update | SP2 | PRD 5.5, 5.3. Lands in `submissions` as `pending`. |
| `POST /api/subscribers` | Alerts subscribe | SP2 | PRD 5.4, 9.2. Writes an unconfirmed row with `consent_text_version`; the confirmation email is SP5. |

All four write through the `service_role` client in `src/lib/supabase/admin.ts`
after validation. The anonymous Postgres role holds **no insert policy on any
base table** (design doc 5.4.1), so there is no anonymous write path to
misconfigure — but that also means these handlers are the only way in, and a
missing validation here has no second line of defence behind it.
