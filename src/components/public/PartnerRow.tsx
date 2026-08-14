import { t } from '@/lib/i18n';
import type { PublicPartner } from '@/lib/public/types';

/**
 * PRD 5.1 item 6: each logo links to the partner's own official site.
 *
 * The rows reaching this band are the AI Hub's own partners, already
 * narrowed by `partners_public` (0019_ai_hub_partners.sql filters it on
 * `is_ai_hub_partner`) -- not the whole `partners` table, most of which is
 * the provider registry behind `resources.partner`. This component applies
 * no filter of its own and renders exactly what it is given.
 *
 * Content rule 10.10 is enforced in the database as a CHECK
 * (`logo_url is null or website_url is not null`), so a logo without a site
 * to link to cannot exist. Logos and URLs are a client deliverable; until
 * they arrive a partner renders as its name, which is a complete row rather
 * than a gap -- the band only disappears when there are no partners at all.
 */
export default function PartnerRow({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;

  return (
    <section className="border-y border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-eyebrow font-semibold uppercase text-eyebrow">
          {t('home.partnersHeading')}
        </h2>
        {/* PRD 5.1 item 6 calls this a "scrolling partner logo row". It was
            a `flex-wrap` block, which reflows onto a second line instead of
            scrolling once the logos outrun the measure. `overflow-x-auto`
            with `shrink-0` items is the scrolling row it asks for, and it
            keeps the band one logo tall at every width rather than growing
            downward on narrow screens. */}
        <ul className="mt-6 flex items-center gap-8 overflow-x-auto pb-2">
          {partners.map((partner) => (
            <li key={partner.name} className="shrink-0">
              {partner.websiteUrl ? (
                <a
                  href={partner.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-navy"
                >
                  {partner.logoUrl ? (
                    // Partner logos are arbitrary remote hosts, so next/image
                    // would need each one allow-listed in next.config.ts; SP4
                    // owns the image policy. The directive must sit on the
                    // line immediately above the <img>, not above this
                    // explanation, or it suppresses nothing and reports itself
                    // as unused.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="h-8 w-auto" src={partner.logoUrl} alt={partner.name} />
                  ) : (
                    partner.name
                  )}
                </a>
              ) : (
                <span className="text-navy">{partner.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
