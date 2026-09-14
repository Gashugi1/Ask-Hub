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
    // The prototype gives the legal pages a narrower 720px measure than the
    // 820px it uses for About, and more bottom padding.
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 32px 90px 32px' }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>{t('privacy.title')}</h1>
      <p
        style={{
          margin: '18px 0 0 0',
          fontSize: 15.5,
          lineHeight: 1.7,
          color: '#2B3A5C',
          whiteSpace: 'pre-line',
        }}
      >
        {content.privacy_body ?? t('privacy.pending')}
      </p>
      <p style={{ margin: '18px 0 0 0', fontSize: 15.5, lineHeight: 1.7 }}>
        <a
          href={`mailto:${t('site.contactEmail')}`}
          style={{ color: '#1F5FBF', fontWeight: 700 }}
        >
          {t('site.contactEmail')}
        </a>
      </p>
    </div>
  );
}
