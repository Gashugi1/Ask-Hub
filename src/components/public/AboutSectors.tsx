'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import { SECTORS } from '@/lib/reference';

/**
 * "Six priority sectors", transcribed from docs/prototype/prototype.html
 * lines 407-416: a row of pills, and one panel beneath them showing the
 * blurb for whichever pill is open.
 *
 * A client component, which the plan's notes otherwise discourage — but the
 * discouragement is against converting a server component for a *hover
 * colour*, and this is a disclosure with real state: which sector is open.
 * The About page itself stays a server component; only these pills are
 * hydrated.
 *
 * The prototype's pills call `setFilter` nowhere — they toggle `sectorOpen`
 * and nothing else — so these are buttons that reveal text, not links into
 * the directory, and they are marked up as the disclosures they are:
 * `aria-expanded` on each pill and `aria-controls` on the shared panel, so
 * the relationship is announced rather than merely visible. Clicking the
 * open pill closes it, exactly as the prototype's toggle does.
 *
 * `BLURBS` is keyed by the sector strings themselves, so adding a seventh
 * sector to `src/lib/reference.ts` without writing its blurb is a compile
 * error rather than a pill that opens onto an empty panel.
 *
 * **`as const satisfies` rather than a `Record<Sector, string>` annotation**,
 * which is what it carried first. The two are identical to the compiler for
 * the exhaustiveness check above -- `satisfies` still demands every sector
 * and still rejects an unknown one -- but they are not identical to
 * `tests/structure/locale-keys.ts`. That guard resolves a `t(variable)` call
 * only when the argument's type is a union of string literals; the
 * annotation widened these six values to `string`, so `t(BLURBS[open])`
 * landed in `unresolved` and failed the suite, taking the six
 * `about.sector.*` keys with it as apparently-unused copy. `as const` keeps
 * the literal types, so the checker enumerates exactly the six keys this
 * component can ask for and holds them against `en.json` -- which is the
 * whole point of the guard, and the reason the narrowest shape is also the
 * one it rewards.
 */
type Sector = (typeof SECTORS)[number];

const BLURBS = {
  Energy: 'about.sector.energy',
  Agriculture: 'about.sector.agriculture',
  Health: 'about.sector.health',
  Water: 'about.sector.water',
  'Education & Training': 'about.sector.educationTraining',
  Infrastructure: 'about.sector.infrastructure',
} as const satisfies Record<Sector, string>;

const PANEL_ID = 'about-sector-blurb';

export default function AboutSectors() {
  const [open, setOpen] = useState<Sector | null>(null);

  return (
    <>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {SECTORS.map((sector) => {
          const isOpen = open === sector;
          return (
            <button
              key={sector}
              type="button"
              className="proto-sector-pill"
              aria-expanded={isOpen}
              aria-controls={PANEL_ID}
              onClick={() => setOpen(isOpen ? null : sector)}
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 99,
                border: `1px solid ${isOpen ? '#1F5FBF' : '#C9D3E8'}`,
                background: isOpen ? '#EEF2FB' : '#fff',
                color: '#1F5FBF',
                cursor: 'pointer',
              }}
            >
              {/* Sector names are canonical option values rather than copy —
                  see the header of src/lib/reference.ts — and render raw here
                  exactly as they do in the directory's filter. */}
              {sector}
            </button>
          );
        })}
      </div>

      {/* Rendered even when closed, and emptied rather than removed, so the
          `aria-controls` target always exists: a control pointing at a node
          that is not in the document is announced as broken by some screen
          readers. */}
      <div id={PANEL_ID} role="region" aria-live="polite">
        {open ? (
          <div
            style={{
              marginTop: 14,
              background: '#F4F6F9',
              border: '1px solid #DDE5EE',
              borderRadius: 12,
              padding: '18px 22px',
              maxWidth: 640,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1F5FBF' }}>{open}</div>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: '#42506E',
                marginTop: 6,
              }}
            >
              {t(BLURBS[open])}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
