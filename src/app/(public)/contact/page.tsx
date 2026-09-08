import type { Metadata } from 'next';
import { t } from '@/lib/i18n';

/**
 * Contact, and the one route by which a visitor can propose something for the
 * directory.
 *
 * **This page collects nothing.** It used to carry a form that wrote a name,
 * an email address and a message into `contact_messages`. This release is
 * deliberately free of personal-data collection, so the form is gone and both
 * actions are `mailto:` links: the visitor's own mail client holds their
 * details, and this application never receives, stores or processes them.
 *
 * `contact_messages`, its RLS policies and the submit RPC all remain in the
 * database, unused. Dropping them is a destructive migration that buys nothing
 * while no code can reach them, and it would have to be written again if the
 * form ever returns.
 *
 * A side effect worth naming: the old form wrote to a table with no delivery
 * pipeline, so a message sat there until someone opened an admin screen that
 * does not exist yet. A `mailto:` reaches a mailbox the team actually reads,
 * which is a better outcome than the form it replaces rather than a lesser one.
 *
 * Content rule: one mailbox only. `site.contactEmail` is the single source for
 * it here and in the footer, so there is no second address to drift from it.
 *
 * Statically rendered: nothing here reads the request.
 */
export const metadata: Metadata = {
  title: t('contact.title'),
};

const BODY = { fontSize: 16, lineHeight: 1.7, color: '#2B3A5C' } as const;

export default function ContactPage() {
  const mailbox = t('site.contactEmail');
  const suggestHref = `mailto:${mailbox}?subject=${encodeURIComponent(
    t('contact.suggestSubject'),
  )}`;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 32px 80px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {t('contact.title')}
      </h1>

      <p style={{ ...BODY, margin: '16px 0 0 0' }}>
        {t('contact.writeToUs')}{' '}
        <a href={`mailto:${mailbox}`} style={{ color: '#1F5FBF', fontWeight: 700 }}>
          {mailbox}
        </a>
      </p>

      {/* The prototype's bordered panel (reference lines 430-438), now holding
          the suggest-a-resource invitation rather than a form. */}
      <section
        style={{
          marginTop: 32,
          border: '1px solid #DDE5EE',
          borderRadius: 14,
          padding: 28,
          maxWidth: 560,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          {t('contact.suggestHeading')}
        </h2>
        <p style={{ ...BODY, margin: '10px 0 0 0', fontSize: 14.5 }}>
          {t('contact.suggestBody')}
        </p>
        <a
          href={suggestHref}
          className="proto-primary-button"
          style={{
            display: 'inline-block',
            marginTop: 18,
            background: '#1F5FBF',
            color: '#fff',
            borderRadius: 9,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {t('contact.suggestAction')}
        </a>
      </section>

      <p style={{ marginTop: 36, fontSize: 13, color: '#5B6B8C' }}>{t('site.footer')}</p>
    </div>
  );
}
