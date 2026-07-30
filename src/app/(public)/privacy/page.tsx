import { t } from '@/lib/i18n';
import { getSiteContent } from '@/lib/public/readers';

/**
 * PRD 5.8: copy minimal and factual pending legal review. The page renders
 * `site_content.privacy_body` the moment SP3's editor supplies the reviewed
 * text; until then it states plainly that the notice is being finalised and
 * points at the one mailbox.
 *
 * It does not invent a policy. It also does not ship blank: a blank legal
 * page on a UN programme surface reads as an oversight, where a sentence
 * saying the notice is pending is simply true.
 */
export default async function PrivacyPage() {
  const content = await getSiteContent();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy">{t('privacy.title')}</h1>
      <p className="mt-6 whitespace-pre-line text-muted">
        {content.privacy_body ?? t('privacy.pending')}
      </p>
      <p className="mt-6">
        <a className="text-primary underline" href={`mailto:${t('site.contactEmail')}`}>
          {t('site.contactEmail')}
        </a>
      </p>
    </div>
  );
}
