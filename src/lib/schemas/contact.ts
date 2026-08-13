import { z } from 'zod';

/**
 * The public contact form's input contract.
 *
 * This is the application's half of a two-layer boundary. `anon` holds no
 * grant and no insert policy on `public.contact_messages` -- checked against
 * the catalog, not assumed -- so the only write path is the `security definer`
 * RPC added by `0020_contact_submit_rpc.sql`, which re-checks these same
 * bounds in the database. Neither layer is redundant: this one produces the
 * message a visitor can act on, and that one holds even for a caller who has
 * the anon key and never touches this application at all.
 *
 * Every bound below is the database's own, not a guess. `name`, `email` and
 * `message` are all NOT NULL with no default there, so a blank field must be
 * rejected here rather than surfacing as a constraint violation the visitor
 * cannot act on. `.trim()` runs before `.min(1)` deliberately: a message of
 * nothing but whitespace is an empty message, and storing it would put a row
 * in a staff inbox with nothing to read.
 *
 * The email bound follows `src/lib/schemas/user.ts` exactly —
 * `.trim().toLowerCase().email().max(254)` — including the lowercase, so the
 * same address submitted twice with different capitalisation is stored one
 * way. 254 is the RFC 5321 maximum for a whole address.
 *
 * `source_ip_hash`, `delivered_at` and `delivery_error` are deliberately not
 * here. All three are nullable and none is the visitor's to supply: the first
 * belongs to whatever writes it server-side, and the last two are the
 * delivery pipeline's own record. Accepting them from a form post would let a
 * submitter mark their own message as already delivered.
 */
export const contactMessageInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().min(1).max(4000),
});

export type ContactMessageInput = z.infer<typeof contactMessageInput>;
