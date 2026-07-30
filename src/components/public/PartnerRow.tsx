import { t } from '@/lib/i18n';
import type { PublicPartner } from '@/lib/public/types';

/**
 * PRD 5.1 item 6: each logo links to the partner's own official site.
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
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-light">
          {t('home.partnersHeading')}
        </h2>
        <ul className="mt-6 flex flex-wrap items-center gap-8">
          {partners.map((partner) => (
            <li key={partner.name}>
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
