/**
 * Transcribed from the approved prototype
 * (the approved prototype): a 120deg navy -> deep-blue gradient, 1280px wide, carrying a
 * 25px/800 title, a 13px tagline, a 14.5px body and a nowrap accent button on
 * the right.
 *
 * **The prototype's three-dot marker is not here, and this note covers every
 * place it appeared.** Lines 34-40 open this band with three 8px beads in the
 * accent orange and the roundel's teal and coral; line 296 opens the resource
 * detail banner with the same device at 7px; line 34's featured-card row
 * carries a third; and line 596 sets a single bead beside the footer
 * wordmark. All four are removed at the client's instruction, not by
 * transcription error -- so a later fidelity pass that finds them in the
 * reference should leave them out rather than restore them, on any surface.
 * The device is gone from this application entirely; there is no remaining
 * instance to be consistent with. Nothing is lost by their absence: every one
 * was decorative and `aria-hidden`, carrying no information any reader could
 * miss. `--color-accent-teal` and `--color-accent-coral` went with them,
 * having existed only to hold the second and third beads.
 *
 * PRD 5.1 item 1. The copy is editable from admin, so it comes from
 * `site_content` rather than `en.json` -- these are the keys the seed writes
 * (`welcome_title`, `welcome_tagline`, `welcome_body`) and the
 * keys the Site Content editor writes. An editor's change must appear without
 * a rebuild, which is what the `site-content` cache tag is for.
 *
 * The prototype hardcodes its tagline ("Building Africa's AI future
 * together"). That is not transcribed: the tagline is editor-supplied here,
 * which is strictly better and is what PRD 5.1 asks for. Only its styling is
 * taken -- 13px/600 in #9FB6D9, and notably *not* uppercase, which is how it
 * was rendering before.
 *
 * Because every string here is editor-supplied at runtime, there is no
 * hardcoded copy for the JSX guard to catch and nothing to route through
 * t(). If a key is missing the element is omitted rather than falling back
 * to a default sentence: invented copy on the home page of a UN programme is
 * the same defect class as an invented number.
 *
 * **On the CTA's colours.** White on the accent orange measures 3.20:1 and
 * fails the WCAG AA 4.5:1 bar; navy on that same orange is 4.93:1 and passes.
 * A previous note here recorded that the prototype rendered this button
 * white-on-orange and that navy was a deliberate departure. That was wrong:
 * the prototype's own button is `color:#1A2332` on the accent (line 45), so
 * verbatim transcription and the accessible choice are the same thing here.
 * Its background reads `--color-orange` rather than the prototype's own
 * `var(--acc, #F06428)`: `--acc` is an accent custom property the prototype
 * sets on its root from a settings value, and nothing in this app defines
 * it, so that reference resolved to its literal fallback every time.
 *
 * **The "Start exploring" action is gone.** It scrolled to the directory,
 * which now sits immediately below the band on the same page -- an anchor to
 * something already in view. `welcome_cta` stays in the content schema and the
 * seed because it is editor-owned data, but nothing renders it, so it is also
 * removed from the Site Content editor rather than offered as a field with no
 * effect.
 *
 * The band is full-bleed: the outer element paints the gradient edge to edge
 * and an inner wrapper holds the 1280px measure.
 */
export default function WelcomeBand({ content }: { content: Record<string, string> }) {
  const title = content.welcome_title;
  const tagline = content.welcome_tagline;
  const body = content.welcome_body;
  if (!title && !body) return null;

  return (
    <section
      style={{
        background: 'linear-gradient(120deg, #1A2332 0%, #003D60 100%)',
        color: '#fff',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '30px 28px 28px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          {title ? (
            <h1
              style={{
                margin: 0,
                fontSize: 25,
                lineHeight: 1.25,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>
          ) : null}

          {tagline ? (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                fontWeight: 600,
                color: '#9FB6D9',
                letterSpacing: '0.01em',
              }}
            >
              {tagline}
            </div>
          ) : null}

          {body ? (
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: '#C6D2F2',
                maxWidth: 760,
                textWrap: 'pretty',
              }}
            >
              {body}
            </p>
          ) : null}
        </div>

      </div>
    </section>
  );
}
