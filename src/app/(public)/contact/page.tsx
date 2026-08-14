import type { Metadata } from 'next';
import ContactForm from '@/components/public/ContactForm';
import { t } from '@/lib/i18n';

/**
 * The prototype's Contact view: a heading, the one mailbox, and a message
 * form.
 *
 * Content rule: one mailbox only. `site.contactEmail` is the single source for
 * it here, in the footer and on the About page, so there is no second address
 * anywhere on the public surface to drift from it.
 *
 * The mailbox is rendered above the form, not below it, and on purpose. The
 * form writes to `contact_messages`, which has no delivery pipeline yet — a
 * message sits in the table until someone opens the admin inbox that SP3 has
 * not built. A visitor who needs an answer today should reach the address
 * first, and see the form as the alternative rather than the only route.
 *
 * Statically rendered: nothing on this page reads the request, and the form is
 * a client component that posts to a server action, so the page itself stays
 * a prerendered shell.
 */
export const metadata: Metadata = {
  title: t('contact.title'),
};

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 32px 80px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {t('contact.title')}
      </h1>

      <p style={{ margin: '16px 0 0 0', fontSize: 16, lineHeight: 1.7, color: '#2B3A5C' }}>
        {t('contact.writeToUs')}{' '}
        <a
          href={`mailto:${t('site.contactEmail')}`}
          style={{ color: '#1F5FBF', fontWeight: 700 }}
        >
          {t('site.contactEmail')}
        </a>
      </p>

      {/* The prototype's bordered "Send us a message" panel, 560px wide inside
          the 820px page (reference lines 430-438). */}
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
          {t('contact.formHeading')}
        </h2>
        <ContactForm />
      </section>

      <p style={{ marginTop: 36, fontSize: 13, color: '#5B6B8C' }}>{t('site.footer')}</p>
    </div>
  );
}
