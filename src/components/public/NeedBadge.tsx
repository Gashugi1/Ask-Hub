import { t } from '@/lib/i18n';
import type { NeedKey } from '@/lib/public/types';

/**
 * Per-need colours are design tokens, never literals: globals.css defines
 * --color-need-<key> and --color-need-<key>-bg, and
 * tests/structure/app-structure.test.ts fails on a colour value anywhere
 * outside that @theme block. The map is static rather than interpolated
 * because Tailwind cannot see a class name built at runtime.
 */
const NEED_CLASSES: Record<NeedKey, string> = {
  compute: 'bg-need-compute-bg text-need-compute',
  training: 'bg-need-training-bg text-need-training',
  funding: 'bg-need-funding-bg text-need-funding',
  accelerator: 'bg-need-accelerator-bg text-need-accelerator',
  partners: 'bg-need-partners-bg text-need-partners',
};

/**
 * The same five needs as solid fills, for ResourceCard's header strip. Kept
 * beside NEED_CLASSES so the two maps cannot drift apart, and static for the
 * same reason that one is: Tailwind cannot see a class name assembled at
 * runtime. Every one of these five is AA-safe behind white text — see the
 * derivation note on the --color-need-* block in globals.css.
 */
export const NEED_HEADER_CLASSES: Record<NeedKey, string> = {
  compute: 'bg-need-compute',
  training: 'bg-need-training',
  funding: 'bg-need-funding',
  accelerator: 'bg-need-accelerator',
  partners: 'bg-need-partners',
};

export default function NeedBadge({ need }: { need: NeedKey }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${NEED_CLASSES[need]}`}
    >
      {t(`need.${need}`)}
    </span>
  );
}
