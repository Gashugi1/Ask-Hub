'use server';

import { createPublicSupabase } from '@/lib/public/client';
import { contactMessageInput } from '@/lib/schemas/contact';
import { t } from '@/lib/i18n';

/**
 * What the form component renders. `ok: true` is a distinct shape rather than
 * an empty error so the success message is not something an absent error can
 * accidentally produce.
 */
export type ContactState = { ok: true } | { ok: false; error: string } | null;

/**
 * Accept a message from the public contact form.
 *
 * **How the write reaches the table.** `public.contact_messages` has no insert
 * policy and no grant for `anon` -- it is a staff inbox, not a public table --
 * so this goes through `public.submit_contact_message`, the narrowly scoped
 * `security definer` function added by `0020_contact_submit_rpc.sql`. The
 * caller can write three columns and read nothing back.
 *
 * The first version of this action used `createAdminSupabase()` instead, and
 * `tests/structure/service-role-containment.test.ts` refused it -- correctly.
 * `service_role` bypasses RLS entirely, which takes the database's permission
 * model out of the write path for a write a function can express exactly.
 * `src/lib/actions/README.md` names the RPC as the intended pattern; the guard
 * exists so that reasoning does not have to be rediscovered each time a write
 * gets refused. Its allow-list is not the fix.
 *
 * **Why no requireRole.** Every other action in this folder opens with
 * `await requireRole([...])`. This one is genuinely pre-authentication -- PRD 5
 * puts the public site behind no account at all -- so there is no role to
 * check. That exemption is declared, with its reason, in
 * `tests/structure/admin-guard-allowlist.ts`; it is a documented entry rather
 * than a silent omission, and the count beside it has to move for the entry to
 * be accepted.
 *
 * **Deliberately not written.** `source_ip_hash` stays null: hashing and
 * storing a visitor's IP is a personal-data decision belonging to the privacy
 * notice, which is still being finalised, and a column existing is not consent
 * to fill it. `delivered_at` and `delivery_error` belong to a delivery
 * pipeline that does not exist yet -- leaving them null is what marks a
 * message as not-yet-delivered rather than silently claiming it was sent.
 *
 * **Failure is reported, never swallowed.** Telling a visitor their message
 * was sent when it was not leaves them with no way to find out; the error
 * string points them at the mailbox shown above the form. The database's own
 * message is not surfaced -- it names columns and constraints, which is detail
 * a stranger has no use for.
 */
export async function submitContactMessage(formData: FormData): Promise<ContactState> {
  // no-revalidate: writes only to contact_messages, a staff inbox. No public
  // page reads that table, so there is no cached public surface to evict. The
  // admin inbox that will read it renders per request.
  const parsed = contactMessageInput.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  // One message for every shape of invalid input. Field-level errors would be
  // better UX, but they would also be a second copy of the schema's rules
  // living in the locale file, free to drift from the schema itself.
  if (!parsed.success) return { ok: false, error: t('contact.invalid') };

  const supabase = createPublicSupabase();
  const { error } = await supabase.rpc('submit_contact_message', {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_message: parsed.data.message,
  });

  if (error) {
    // Server-side only: the visitor gets the generic string above.
    console.error('[contact] submit_contact_message failed:', error.message);
    return { ok: false, error: t('contact.error') };
  }

  return { ok: true };
}
