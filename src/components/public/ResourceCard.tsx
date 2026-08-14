import Link from 'next/link';
import { t } from '@/lib/i18n';
import NeedBadge, { NEED_HEADER_CLASSES } from './NeedBadge';
import { deadlineLabel } from '@/lib/public/deadline-label';
import type { PublicResource } from '@/lib/public/types';

/**
 * One directory card. Pure presentation over a `resources_public` row: it
 * derives nothing the database did not already state, which is what keeps the
 * deadline rule in exactly one place.
 *
 * A closed resource is still listed and still links to its detail page
 * (PRD 4.2). The apply link is suppressed rather than the card, because a
 * closed opportunity is still worth reading about.
 */
export default function ResourceCard({ resource }: { resource: PublicResource }) {
  const label = deadlineLabel(resource);
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
      {/* The prototype gives every card a solid, need-coloured header
          carrying the providing organisation. It is the only place colour
          distinguishes one card from another at a glance, so it is worth
          reproducing — but as the need colour, which the tokens already
          define and which matches the badge below it, rather than as a
          per-organisation brand colour the database does not hold. The
          partner name moves up here from the body; it is not repeated. */}
      <div className={`px-5 py-3 ${NEED_HEADER_CLASSES[resource.needPrimary]}`}>
        <p className="truncate text-eyebrow font-semibold uppercase text-surface">
          {resource.partnerName}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <NeedBadge need={resource.needPrimary} />
        {resource.isFeatured ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-primary">
            {t('badge.featured')}
          </span>
        ) : null}
        {resource.exclusivity === 'exclusive' ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-deep-blue">
            {t('badge.exclusive')}
          </span>
        ) : null}
        {resource.exclusivity === 'early_access' ? (
          <span className="rounded-full bg-tint-1 px-3 py-1 text-xs text-deep-blue">
            {t('badge.earlyAccess')}
          </span>
        ) : null}
        <span
          className={`ml-auto text-xs ${resource.isClosed ? 'text-danger' : 'text-muted-light'}`}
        >
          {label}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-navy">
        <Link href={`/resources/${resource.id}`}>{resource.name}</Link>
      </h3>

      {resource.description ? (
        <p className="line-clamp-3 text-sm text-muted">{resource.description}</p>
      ) : null}

      <div className="mt-auto flex items-center gap-4 pt-2 text-sm">
        <Link className="text-primary underline" href={`/resources/${resource.id}`}>
          {t('cta.viewDetail')}
        </Link>
        {resource.externalUrl && !resource.isClosed ? (
          <a
            className="text-primary underline"
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {resource.actionLabel ?? t('cta.apply')}
          </a>
        ) : null}
        </div>
      </div>
    </article>
  );
}
