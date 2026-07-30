import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { t } from '@/lib/i18n';
import NeedBadge from '@/components/public/NeedBadge';
import ShareModal from '@/components/public/ShareModal';
import { deadlineLabel } from '@/lib/public/deadline-label';
import { geoEligibilityLabel } from '@/lib/public/geo';
import { resourceJsonLd, serialiseJsonLd } from '@/lib/public/jsonld';
import { getPublicResource, listPublicResources } from '@/lib/public/readers';

/**
 * Pre-generate the detail pages that exist at build time.
 *
 * `dynamicParams` stays at its default of true, deliberately: a resource
 * published from the admin portal after a deploy must resolve without a
 * rebuild. PRD 12.2 wants these pages server-rendered, not that they exist
 * only for rows that happened to be live when the bundle was built.
 */
export async function generateStaticParams() {
  const resources = await listPublicResources();
  return resources.map((resource) => ({ id: resource.id }));
}

function canonicalUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}/resources/${id}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = await getPublicResource(id);
  if (!resource) return {};
  return {
    title: resource.name,
    ...(resource.description ? { description: resource.description } : {}),
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resource = await getPublicResource(id);

  // Absent from resources_public means status is not 'live'. It never means
  // the deadline passed: the view filters on status alone, and PRD 4.2 keeps
  // a closed resource listed and reachable -- a past opportunity is still
  // worth reading about, and a 404 on a shared link is a dead end.
  if (!resource) notFound();

  const label = deadlineLabel(resource);
  const jsonLd = resourceJsonLd(resource, canonicalUrl(resource.id));

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {/* Server-rendered from public view fields only, and serialised by
          `serialiseJsonLd`, which escapes < > & so a description containing
          `</script>` cannot break out of this element. See that function for
          why JSON.stringify alone is not enough. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(jsonLd) }}
      />

      <Link className="text-sm text-primary underline" href="/#directory">
        {t('detail.backToDirectory')}
      </Link>

      {resource.bannerImageUrl ? (
        // Partner banner URLs are arbitrary remote hosts; next/image would
        // need every one allow-listed in next.config.ts, and SP4 owns the
        // image policy.
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img
          className="mt-6 w-full rounded-lg"
          src={resource.bannerImageUrl}
          alt={resource.name}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <NeedBadge need={resource.needPrimary} />
        <span className={resource.isClosed ? 'text-sm text-danger' : 'text-sm text-muted-light'}>
          {label}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-semibold text-navy">{resource.name}</h1>

      <p className="mt-2 text-muted">
        {t('detail.partner')}{' '}
        {resource.partnerWebsiteUrl ? (
          <a
            className="text-primary underline"
            href={resource.partnerWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.partnerName}
          </a>
        ) : (
          resource.partnerName
        )}
      </p>

      {resource.description ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-navy">{t('detail.about')}</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{resource.description}</p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">{t('detail.eligibility')}</h2>
        <dl className="mt-2 grid gap-2 text-sm text-muted">
          {/* Wording lives in lib/public/geo.ts, not here: an unscoped row must
              read as "not specified", never as open to everyone. */}
          <Row term={t('detail.countries')} value={geoEligibilityLabel(resource)} />
          <Row
            term={t('detail.sectors')}
            value={
              resource.sectorsEligible.length > 0
                ? resource.sectorsEligible.join(', ')
                : t('card.allSectors')
            }
          />
          <Row
            term={t('detail.stages')}
            value={
              resource.stagesEligible.length > 0
                ? resource.stagesEligible.join(', ')
                : t('card.allStages')
            }
          />
          <Row term={t('detail.deadline')} value={label} />
        </dl>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {resource.externalUrl && !resource.isClosed ? (
          <a
            className="rounded-lg bg-primary px-5 py-3 text-surface"
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.actionLabel ?? t('cta.apply')}
          </a>
        ) : null}
        <ShareModal url={canonicalUrl(resource.id)} title={resource.name} />
      </div>

      <p className="mt-10 text-sm text-muted-light">{t('site.curationStatement')}</p>
    </article>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-32 font-medium text-navy">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
