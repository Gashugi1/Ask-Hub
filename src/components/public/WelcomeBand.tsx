/**
 * PRD 5.1 item 1. The copy is editable from admin, so it comes from
 * `site_content` rather than `en.json` -- these are the keys the seed writes
 * (`welcome_title`, `welcome_tagline`, `welcome_body`, `welcome_cta`) and the
 * keys SP3's Site Content editor will write. An editor's change must appear
 * without a rebuild, which is what the `site-content` cache tag is for.
 *
 * Because every string here is editor-supplied at runtime, there is no
 * hardcoded copy for the JSX guard to catch and nothing to route through
 * t(). If a key is missing the element is omitted rather than falling back
 * to a default sentence: invented copy on the home page of a UN programme is
 * the same defect class as an invented number.
 *
 * **Why this band is dark.** PRD §11 lists the orange accent as being for
 * "high-emphasis bands", and before this change the token was used nowhere on
 * the public surface at all -- the home page was white end to end, so the one
 * band the PRD marks as high-emphasis read exactly like the seven ordinary
 * ones below it. The navy -> deep-blue gradient is what gives the orange
 * somewhere legible to sit; both colours are already PRD §11 rows.
 *
 * **Why the CTA is navy-on-orange, not white-on-orange.** White on
 * `--color-orange` measures 3.20:1, which fails the WCAG AA 4.5:1 bar for
 * normal-size text. Navy on that same orange is 4.93:1 and passes. The
 * prototype renders this button white-on-orange; that is the one detail of it
 * not reproduced here, deliberately.
 *
 * The band is full-bleed: the section paints the background edge to edge and
 * an inner wrapper holds the 6xl measure, rather than the section itself
 * being the constrained element as it was when the background was white and
 * the distinction did not show.
 */
export default function WelcomeBand({ content }: { content: Record<string, string> }) {
  const title = content.welcome_title;
  const tagline = content.welcome_tagline;
  const body = content.welcome_body;
  const cta = content.welcome_cta;
  if (!title && !body) return null;

  return (
    <section className="bg-linear-to-r from-navy to-deep-blue">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          {title ? <h1 className="text-h1 font-extrabold text-surface">{title}</h1> : null}
          {tagline ? (
            <p className="mt-3 text-eyebrow font-semibold uppercase text-eyebrow-on-dark">
              {tagline}
            </p>
          ) : null}
          {body ? <p className="mt-5 text-lg text-tint-3">{body}</p> : null}
        </div>
        {cta ? (
          <a
            href="#directory"
            className="shrink-0 self-start rounded-lg bg-orange px-6 py-3 font-semibold text-navy md:self-auto"
          >
            {cta}
          </a>
        ) : null}
      </div>
    </section>
  );
}
