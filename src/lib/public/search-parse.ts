import { COUNTRIES, SECTORS, STAGES, NEED_KEYS, type NeedKey } from '@/lib/reference';
import type { FilterCriteria } from './filters';

type Sector = (typeof SECTORS)[number];
type Stage = (typeof STAGES)[number];
type Country = (typeof COUNTRIES)[number];

/**
 * The facets a plain-language query resolves to, plus whatever text is left
 * over once the recognised words have been taken out of it.
 */
export type ParsedQuery = Pick<
  FilterCriteria,
  'need' | 'sector' | 'country' | 'stage' | 'query'
>;

/**
 * Words that carry no filtering signal, so they never reach the leftover text
 * term. The prototype's own list: each either names the product's subject
 * ("ai", "africa", "resources") or is the grammar of asking for something
 * ("find", "looking", "need").
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'for', 'in', 'the', 'a', 'an', 'to', 'of', 'and', 'with', 'on', 'ai', 'me',
  'my', 'find', 'need', 'looking', 'want', 'startup', 'startups', 'africa',
  'african', 'resources', 'help',
]);

/**
 * Every need, and the words a visitor types for it.
 *
 * A total `Record` rather than a list of pairs, so the compiler is what keeps
 * this in step with the taxonomy: `NEED_KEYS` mirrors the `public.need_type`
 * enum, so a migration that adds a need fails the build here until somebody
 * decides what it is called in plain language.
 */
const NEED_SYNONYMS: Record<NeedKey, readonly string[]> = {
  compute: ['compute', 'gpus', 'gpu', 'cloud credits', 'cloud', 'credits'],
  training: ['training', 'courses', 'course', 'curriculum', 'learning', 'learn', 'skills'],
  funding: ['funding', 'grants', 'grant', 'investment'],
  accelerator: ['accelerators', 'accelerator', 'incubator'],
  // Not in the prototype's table, which drops Partners from its public
  // category list. Ours keeps it -- it is one of the eight the Need dropdown
  // offers -- so the parser has to be able to reach it too, or typing the name
  // of a category you can see would be the one phrase that does nothing.
  partners: ['partners', 'partner'],
  data: ['datasets', 'dataset', 'benchmarks', 'benchmark'],
  challenges: ['competitions', 'competition', 'hackathons', 'hackathon', 'challenges', 'challenge'],
  community: ['community', 'events', 'event', 'meetup', 'gathering'],
};

const SECTOR_SYNONYMS: Record<Sector, readonly string[]> = {
  Energy: ['energy'],
  Agriculture: ['agriculture', 'farming', 'agri'],
  Health: ['healthtech', 'health', 'medical'],
  Water: ['water'],
  'Education & Training': ['edtech', 'education'],
  Infrastructure: ['infrastructure'],
};

const STAGE_SYNONYMS: Record<Stage, readonly string[]> = {
  'New to AI': ['new to ai', 'beginner'],
  'Getting started': ['getting started'],
  // Deliberately empty, and not an oversight: "building" is a verb before it
  // is a stage. "building a startup" and "capacity building" would both land
  // here, and a filter nobody asked for is worse than one word that does not
  // resolve. The Stage dropdown still offers it.
  Building: [],
  Scaling: ['scaling'],
};

/** Names people type that are not the country's canonical spelling. */
const COUNTRY_ALIASES: Record<string, Country> = {
  'ivory coast': "Côte d'Ivoire",
  drc: 'Democratic Republic of the Congo',
  congo: 'Democratic Republic of the Congo',
};

/**
 * Lowercase, strip accents, reduce everything that is not a letter or digit to
 * a single space, and pad with one space at each end.
 *
 * Applied to the query and to every phrase, so the two are always compared in
 * the same alphabet. The prototype does none of this and does not need to --
 * its own country list is plain ASCII. Ours is not: `Côte d'Ivoire` carries
 * both an accent and an apostrophe, and a raw `includes` would mean the one
 * country whose name is hard to type is the one country that never matches.
 *
 * The apostrophe becoming a space is why "cote d'ivoire" and "cote d ivoire"
 * both resolve while "cote divoire" does not.
 */
function normalise(value: string): string {
  const flattened = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${flattened} `;
}

interface Candidate {
  readonly phrase: string;
  readonly facet: 'need' | 'sector' | 'stage' | 'country';
  readonly value: string;
}

/**
 * Every phrase from every table, longest first.
 *
 * Length order is what makes the tables safe to write in any order. "Republic
 * of the Congo" has to be tried before the bare `congo` alias or the shorter
 * one claims its tail and the country comes out as the wrong Congo; `cloud
 * credits` has to beat `cloud`; `agriculture` has to beat `agri`. Sorting
 * derives that precedence instead of resting on the order somebody happened
 * to write `COUNTRIES` in.
 */
const CANDIDATES: readonly Candidate[] = [
  ...NEED_KEYS.flatMap((need) =>
    NEED_SYNONYMS[need].map((phrase) => ({ phrase, facet: 'need', value: need }) as const),
  ),
  ...SECTORS.flatMap((sector) =>
    SECTOR_SYNONYMS[sector].map((phrase) => ({ phrase, facet: 'sector', value: sector }) as const),
  ),
  ...STAGES.flatMap((stage) =>
    STAGE_SYNONYMS[stage].map((phrase) => ({ phrase, facet: 'stage', value: stage }) as const),
  ),
  ...COUNTRIES.map((country) => ({ phrase: country, facet: 'country', value: country }) as const),
  ...Object.entries(COUNTRY_ALIASES).map(
    ([phrase, country]) => ({ phrase, facet: 'country', value: country }) as const,
  ),
]
  .map((candidate) => ({ ...candidate, phrase: normalise(candidate.phrase).trim() }))
  .sort((a, b) => b.phrase.length - a.phrase.length);

/**
 * Turns "funding for health AI in Kenya" into Need=Funding, Sector=Health,
 * Country=Kenya and an empty text term.
 *
 * Ported from the approved prototype's `parse()`: each phrase that matches is
 * cut out of the string, so a later phrase cannot match letters an earlier one
 * already claimed, and whatever survives becomes the text term.
 *
 * **Every match is cut, but only the first per facet is kept.** The prototype
 * can hold two countries at once; `FilterCriteria` holds one value per facet,
 * so a second country has nowhere to go. Leaving its word in the leftover text
 * would be worse than dropping it -- "kenya ghana" would go looking for the
 * literal word "ghana" in the catalogue's prose and return nothing, which
 * reads as a broken search rather than as a filter the model cannot express.
 */
export function parseQuery(raw: string): ParsedQuery {
  let rest = normalise(raw);
  const found: Record<Candidate['facet'], string | null> = {
    need: null,
    sector: null,
    stage: null,
    country: null,
  };

  for (const { phrase, facet, value } of CANDIDATES) {
    if (phrase === '' || !rest.includes(` ${phrase} `)) continue;
    rest = ` ${rest.split(` ${phrase} `).join('  ').trim()} `;
    if (found[facet] === null) found[facet] = value;
  }

  const words = rest
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  return {
    need: found.need as NeedKey | null,
    sector: found.sector,
    stage: found.stage,
    country: found.country,
    query: words.join(' '),
  };
}

/**
 * Merge a parsed query into the criteria a visitor already has.
 *
 * **Merging, not replacing.** The prototype keeps its parsed chips and its
 * dropdowns in two separate places, so a search can replace one without
 * touching the other; here they are the same state, and replacing would mean a
 * search for "grants" silently discarding the country somebody had chosen a
 * moment earlier. Facets the query did not name are therefore left alone, and
 * "Clear all" -- directly above the controls -- is the way back to nothing.
 *
 * Page returns to 1: the result set has changed, so the page number a visitor
 * was on refers to a list that no longer exists.
 */
export function applyParsedQuery(
  criteria: FilterCriteria,
  raw: string,
): FilterCriteria {
  const parsed = parseQuery(raw);
  return {
    ...criteria,
    need: parsed.need ?? criteria.need,
    sector: parsed.sector ?? criteria.sector,
    stage: parsed.stage ?? criteria.stage,
    country: parsed.country ?? criteria.country,
    query: parsed.query,
    page: 1,
  };
}
