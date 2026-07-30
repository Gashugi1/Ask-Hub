/**
 * PRD 5.1 item 1. The copy is editable from admin, so it comes from
 * `site_content` rather than `en.json` -- these are the keys the seed writes
 * (`welcome_title`, `welcome_body`, `welcome_cta`) and the keys SP3's Site
 * Content editor will write. An editor's change must appear without a
 * rebuild, which is what the `site-content` cache tag is for.
 *
 * Because every string here is editor-supplied at runtime, there is no
 * hardcoded copy for the JSX guard to catch and nothing to route through
 * t(). If a key is missing the element is omitted rather than falling back
 * to a default sentence: invented copy on the home page of a UN programme is
 * the same defect class as an invented number.
 */
export default function WelcomeBand({ content }: { content: Record<string, string> }) {
  const title = content.welcome_title;
  const body = content.welcome_body;
  const cta = content.welcome_cta;
  if (!title && !body) return null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 text-center">
      {title ? <h1 className="text-4xl font-semibold text-navy">{title}</h1> : null}
      {body ? <p className="mt-4 text-lg text-muted">{body}</p> : null}
      {cta ? (
        <a
          href="#directory"
          className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 text-surface"
        >
          {cta}
        </a>
      ) : null}
    </section>
  );
}
