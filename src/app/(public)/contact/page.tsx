import type { Metadata } from 'next';
import SuggestResourceModal from '@/components/public/SuggestResourceModal';
import { t } from '@/lib/i18n';

/**
 * Contact, and the one route by which a visitor can propose something for the
 * directory.
 *
 * Two things here. Writing to the AI Hub is a `mailto:` link -- the visitor's
 * own mail client, and this application never sees the message. Suggesting a
 * resource is a form, `SuggestResourceModal`, because a suggestion has
 * structure a mailbox would lose: a category, a link, the countries and
 * sectors it is for. It lands in `submissions` as `pending` through the
 * `submit_resource_suggestion` function (migration 0024), and the AI Hub
 * team approves, edits or rejects it on the admin Review Queue.
 *
 * This is the product's one public write path, and it is where the personal
 * data it collects is collected: the submitter's name and email, and an
 * optional programme contact. Those go to `@sensitive` columns that no
 * public view can project and no approval copies into a resource.
 *
 * `contact_messages`, its RLS policies and the contact RPC (0020) remain in
 * the database, unused: the contact form itself is still a `mailto:`.
 *
 * Content rule: one mailbox only. `site.contactEmail` is the single source for
 * it here and in the footer, so there is no second address to drift from it.
 *
 * Statically rendered: nothing here reads the request. The modal is a client
 * component and the action it calls runs at request time.
 */
export const metadata: Metadata = {
  title: t('contact.title'),
};

const BODY = { fontSize: 16, lineHeight: 1.7, color: '#2B3A5C' } as const;

export default function ContactPage() {
  const mailbox = t('site.contactEmail');

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

      {/* The prototype's bordered panel (reference lines 430-438), holding
          the suggest-a-resource invitation and the button that opens the form. */}
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
        <SuggestResourceModal />
      </section>

      <p style={{ marginTop: 36, fontSize: 13, color: '#5B6B8C' }}>{t('site.footer')}</p>
    </div>
  );
}
