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
      <p
        role="status"
        style={{
          marginTop: 18,
          background: '#F1F4FA',
          border: '1px solid #DDE5EE',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 14,
          color: '#1A2332',
        }}
      >
        {t('contact.success')}
      </p>
    );
  }

  return (
    <form
      action={action}
      style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {/* The prototype uses placeholders where these use visible labels
          (reference lines 433-435). The labels stay: a placeholder disappears
          the moment someone types, so it cannot serve as the field's name for
          a screen reader or for anyone checking what they filled in. The
          field styling is the prototype's. */}
      <label style={LABEL}>
        {t('contact.name')}
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          style={FIELD}
        />
      </label>

      <label style={LABEL}>
        {t('contact.email')}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          style={FIELD}
        />
      </label>

      <label style={LABEL}>
        {t('contact.message')}
        <textarea
          name="message"
          required
          rows={5}
          maxLength={4000}
          style={{ ...FIELD, resize: 'vertical' }}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="proto-primary-button"
        style={{
          alignSelf: 'flex-start',
          background: '#1F5FBF',
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '12px 24px',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {t('contact.submit')}
      </button>

      {state && !state.ok ? (
        <p role="alert" style={{ fontSize: 13.5, color: '#C0392B', margin: 0 }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

const LABEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 13,
  fontWeight: 600,
  color: '#5B6B8C',
} as const;

/** Prototype line 433: 11px/14px on a 1px #C9D3E8 hairline, 8px radius. */
const FIELD = {
  padding: '11px 14px',
  border: '1px solid #C9D3E8',
  borderRadius: 8,
  fontSize: 14,
  color: '#1A2332',
  outline: 'none',
} as const;
