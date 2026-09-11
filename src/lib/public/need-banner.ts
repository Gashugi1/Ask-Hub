import type { NeedKey } from './types';

/**
 * The banner gradient for each need, transcribed from the approved
 * prototype's own `banner()` (its `G` table, recovered from the deployed
 * bundle at startling-rugelach-dd7204.netlify.app).
 *
 * These are not the `--color-need-*` tokens. The tokens are the badge and
 * pill colours -- mid-weight hues that have to carry small text at WCAG AA.
 * A banner carries large white text over a wide area, so the prototype gives
 * it a darker, deeper pair and fades between them. Rendering the badge colour
 * flat across the banner, which is what this build did, is why the cards
 * looked flatter than the prototype: same hue, none of the depth.
 *
 * Kept in one module because four surfaces paint this banner -- directory
 * card, recently-added rail, featured card and resource detail -- and five
 * pairs copied four times is five pairs that will disagree.
 */
const BANNER_GRADIENT: Record<NeedKey, readonly [string, string]> = {
  compute: ['#1A2332', '#2C4CA8'],
  training: ['#0B4A54', '#177787'],
  funding: ['#6E3D0E', '#A5661F'],
  accelerator: ['#3D2069', '#5F3AA0'],
  partners: ['#0A4630', '#177052'],
  data: ['#0A4630', '#177052'],
  challenges: ['#5C1230', '#93365B'],
  community: ['#083F38', '#12776B'],
};

/** The prototype's 135deg banner fade for one need. */
export function needBanner(need: NeedKey): string {
  const [from, to] = BANNER_GRADIENT[need];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

/**
 * The banner's eyebrow: the providing organisation, cut at the first " / " so
 * a joint row like "Stanford / Coursera" does not run past the card.
 *
 * **Not uppercased here, though the prototype uppercases it.** The prototype
 * calls `.toUpperCase()`, which puts AMAZON WEB SERVICES in the DOM; the
 * eyebrow's own `text-transform: uppercase` renders identically while leaving
 * the readable name in the markup, for screen readers, for find-in-page and
 * for anything that reads the text rather than looks at it. Same pixels, less
 * damage -- so this is the one part of `banner()` deliberately not
 * transcribed literally.
 */
export function bannerPartner(partnerName: string): string {
  return partnerName.split(' / ')[0] ?? partnerName;
}
