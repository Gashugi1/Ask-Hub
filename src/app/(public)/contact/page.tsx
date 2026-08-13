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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('contact.title')}</h1>

      <p className="mt-6 text-muted">
        {t('contact.writeToUs')}{' '}
        <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
          {t('site.contactEmail')}
        </a>
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-navy">{t('contact.formHeading')}</h2>
        <ContactForm />
      </section>

      <p className="mt-12 text-sm text-muted-light">{t('site.footer')}</p>
    </div>
  );
}
