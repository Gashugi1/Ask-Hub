import { z } from 'zod';
import { COUNTRIES, SECTORS, NEED_KEYS } from '@/lib/reference';
import { t } from '@/lib/i18n';

/**
 * The public "Suggest a resource" form's shape -- the primary boundary for
 * `submitResourceSuggestion`; migration 0024's function repeats the caps for
 * a caller who never touches the application.
 *
 * `description` is capped at 1500, well under the column's 5000, because
 * `composeSuggestionDescription` appends one line to it and the composed
 * text has to fit `resourceInput` when the reviewer approves: 1500 plus the
 * longest possible line -- every country, every sector and a deadline --
 * stays under 5000 with room to spare (a test computes it).
 *
 * `website` is a honeypot: a field no visitor sees and no browser fills,
 * which a form-filling script does. Anything in it fails the parse, and the
 * action reports that as `invalid` -- the same word a person gets for a bad
 * link, so the script learns nothing from the reply.
 */
export const SUGGESTION_DESCRIPTION_MAX = 1500;

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const suggestionInput = z.object({
  resourceName: z.string().trim().min(1).max(200),
  organisation: z.string().trim().min(1).max(200),
  need: z.enum(NEED_KEYS),
  sectors: z.array(z.enum(SECTORS)).max(SECTORS.length),
  countries: z.array(z.enum(COUNTRIES)).max(COUNTRIES.length),
  openToAll: z.boolean(),
  description: z.string().trim().min(1).max(SUGGESTION_DESCRIPTION_MAX),
  link: z
    .string()
    .trim()
    .max(2048)
    .regex(/^https:\/\/\S+$/i, 'must start with https://'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  programmeContactEmail: z.union([z.literal(''), email]),
  submitterName: z.string().trim().min(1).max(120),
  submitterEmail: email,
  website: z.literal(''),
});

export type SuggestionInput = z.infer<typeof suggestionInput>;
export type SuggestionField = keyof SuggestionInput;

/**
 * The text stored as the submission's description: the visitor's own
 * paragraph, then one line stating the countries, sectors and deadline they
 * chose, so the reviewer reads them where the prototype puts them.
 *
 * This is the only flattening, and it takes none of the three personal
 * fields. The prototype appends the contact email here too, and then
 * publishes the description on approval -- which is how a private address
 * reaches a public card. Here name, email and contact have columns of their
 * own and never enter this string; a test asserts the output contains no
 * `@`.
 */
export function composeSuggestionDescription(input: SuggestionInput): string {
  const countries =
    input.openToAll || input.countries.length === 0
      ? t('suggest.compose.openToAll')
      : input.countries.join(', ');
  const sectors =
    input.sectors.length === 0 ? t('suggest.compose.allSectors') : input.sectors.join(', ');
  const deadline = input.deadline
    ? t('suggest.compose.deadline', { date: input.deadline })
    : t('suggest.compose.rolling');
  return `${input.description}\n\n${[countries, sectors, deadline].join(' · ')}`;
}
