import { t } from '@/lib/i18n';
import type { NeedKey } from '@/lib/public/types';

/**
 * The need pill, as the prototype draws it (docs/prototype/prototype.html
 * line 265): 11.5px/700 on a 99px radius, the need's own colour on its tint.
 *
 * Per-need colours are read as CSS custom properties rather than transcribed.
 * `--color-need-training` and `--color-need-funding` are deliberately darker
 * than the prototype's own values (spec D9), because the prototype's measure
 * 4.44:1 and 3.74:1 against these very backgrounds -- under the WCAG AA 4.5:1
 * bar for the pill's normal-size text. Reading the tokens keeps that fix in
 * one place instead of relying on every call site to remember it.
 *
 * The solid-fill map that used to live here is gone with the card header that
 * consumed it: the cards now paint their banners with the same custom
 * properties, so a second map of Tailwind class names had nothing left to do.
 */
export default function NeedBadge({ need }: { need: NeedKey }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 99,
        background: `var(--color-need-${need}-bg)`,
        color: `var(--color-need-${need})`,
      }}
    >
      {t(`need.${need}`)}
    </span>
  );
}
