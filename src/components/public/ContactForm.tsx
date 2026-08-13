'use client';

import { useActionState } from 'react';
import { submitContactMessage, type ContactState } from '@/lib/actions/contact';
import { t } from '@/lib/i18n';

/**
 * The prototype's "Send us a message" panel.
 *
 * Same `useActionState` shape as `src/components/admin/SignInForm.tsx`, so
 * there is one form pattern in this codebase rather than two. `pending`
 * disables the button, which is the only thing stopping a double submit from
 * writing two identical rows into a staff inbox.
 *
 * On success the form is replaced by the confirmation rather than cleared and
 * left standing: a blank form after a send reads as "nothing happened", which
 * is the exact ambiguity that makes people submit again. The mailbox stays
 * visible above this component either way, so a visitor whose message failed
 * always has a route that does not depend on this form working.
 *
 * `required` on the fields is a convenience, not the boundary — it is trivially
 * bypassed and the server re-validates every field with the same Zod schema
 * regardless.
 */
export default function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(
    async (_previous, formData) => await submitContactMessage(formData),
    null,
  );

  if (state?.ok) {
    return (
      <p role="status" className="mt-6 rounded border border-hairline bg-tint-2 px-4 py-3 text-sm text-navy">
        {t('contact.success')}
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-navy">
        {t('contact.name')}
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          className="rounded border border-hairline px-3 py-2 text-navy"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-navy">
        {t('contact.email')}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className="rounded border border-hairline px-3 py-2 text-navy"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-navy">
        {t('contact.message')}
        <textarea
          name="message"
          required
          rows={6}
          maxLength={4000}
          className="rounded border border-hairline px-3 py-2 text-navy"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {t('contact.submit')}
      </button>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
