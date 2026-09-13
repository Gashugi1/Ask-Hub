'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createAdminReadClient } from '@/lib/admin/client';
import { readPartnerNames, readResourceDedupeIndex } from '@/lib/admin/readers';
import { resourceInput } from '@/lib/schemas/resource';
import { CACHE_TAGS } from '@/lib/public/cache';
import { parseCsv } from '@/lib/admin/import-csv';
import { pickSheetTable } from '@/lib/admin/import-sheet';
import {
  IMPORT_MAX_BYTES,
  TITLE_HEADERS,
  validateTracker,
  type ImportReport,
  type RowOutcome,
} from '@/lib/admin/tracker-import';
import {
  assertRowAffected,
  assertKnownPartner,
  isDuplicateResource,
  resourceWriteError,
} from './resource-mutation-guards';

const id = z.string().uuid();
const status = z.enum(['live', 'pipeline', 'reference']);

/**
 * `revalidateTag` in this Next.js version (16.2.12) requires a second
 * `profile` argument: a bare `revalidateTag(tag)` still runs but is
 * deprecated in favour of either `'max'` (stale-while-revalidate — the next
 * visitor may still see the old page while a fresh one loads in the
 * background) or a custom `{ expire }` profile. PRD 13.4 and CLAUDE.md both
 * require Site Content and resource edits to "appear everywhere immediately
 * with no rebuild," which stale-while-revalidate does not strictly satisfy
 * for the very next request. `{ expire: 0 }` reproduces the pre-16
 * single-argument behaviour exactly (see the `revalidate()` implementation
 * in next/dist/server/web/spec-extension/revalidate.js: a profile whose
 * `expire` is 0 marks the path as fully revalidated, the same branch a
 * missing profile takes), without the deprecation warning.
 */
function revalidateResources(): void {
  revalidateTag(CACHE_TAGS.resources, { expire: 0 });
}

/**
 * The bulk import is the only path that writes `partners`, so this is the only
 * caller. `listPublicPartners` is cached on this tag and reads an unfiltered
 * projection of the table, so a created partner genuinely changes its result.
 */
function revalidatePartners(): void {
  revalidateTag(CACHE_TAGS.partners, { expire: 0 });
}

/**
 * Every action here opens with its own requireRole. Not because the page did
 * not check — because an action can be invoked directly, with no page and no
 * proxy in the path (PRD 14.4).
 *
 * No action writes an audit_log row: the trigger from 0018_audit_triggers.sql
 * writes it inside this mutation's own transaction, attributed to auth.uid().
 * See src/lib/actions/README.md.
 *
 * revalidateTag comes last and only on success. Invalidating a tag for a
 * write that failed would evict a correct cached page and replace it with an
 * identical one, hiding the failure behind a cache miss.
 */
function toRow(input: ReturnType<typeof resourceInput.parse>) {
  return {
    name: input.name,
    partner: input.partner,
    partner_tier: input.partnerTier,
    resource_type: input.resourceType,
    need_primary: input.needPrimary,
    need_secondary: input.needSecondary,
    sub_category: input.subCategory,
    description: input.description,
    action_label: input.actionLabel,
    external_url: input.externalUrl,
    banner_image_url: input.bannerImageUrl,
    countries_eligible: input.countriesEligible,
    sectors_eligible: input.sectorsEligible,
    stages_eligible: input.stagesEligible,
    geo_scope: input.geoScope,
    deadline: input.deadline,
    status: input.status,
    is_featured: input.isFeatured,
    exclusivity: input.exclusivity,
    sort_order: input.sortOrder,
  };
}

export async function createResource(input: unknown): Promise<{ id: string }> {
  await requireRole(['admin', 'editor']);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  // `partner` is a foreign key to partners(name) and the schema cannot check
  // it — see assertKnownPartner. Before the insert, so the operator gets a
  // message naming the value instead of a constraint violation.
  assertKnownPartner(parsed.partner, await readPartnerNames());
  const { data, error } = await supabase
    .from('resources')
    .insert(toRow(parsed))
    .select('id')
    .single();
  if (error) throw resourceWriteError('createResource', error, parsed.partner);
  revalidateResources();
  return { id: data!.id };
}

export async function updateResource(rawId: unknown, input: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const parsed = resourceInput.parse(input);
  const supabase = await createAdminReadClient();
  // The same hole as createResource, and not a theoretical one: the edit form
  // pre-fills a partner that is already valid, so this path only looks safe
  // until someone changes the field.
  assertKnownPartner(parsed.partner, await readPartnerNames());
  const { data, error } = await supabase
    .from('resources')
    .update(toRow(parsed))
    .eq('id', targetId)
    .select('id');
  if (error) throw resourceWriteError('updateResource', error, parsed.partner);
  assertRowAffected('updateResource', data);
  revalidateResources();
}

export async function setResourceStatus(rawId: unknown, rawStatus: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const next = status.parse(rawStatus);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .update({ status: next })
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`setResourceStatus failed: ${error.message}`);
  assertRowAffected('setResourceStatus', data);
  revalidateResources();
}

export async function setResourceFeatured(rawId: unknown, rawFeatured: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const isFeatured = z.boolean().parse(rawFeatured);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase
    .from('resources')
    .update({ is_featured: isFeatured })
    .eq('id', targetId)
    .select('id');
  if (error) throw new Error(`setResourceFeatured failed: ${error.message}`);
  assertRowAffected('setResourceFeatured', data);
  revalidateResources();
}

export async function deleteResource(rawId: unknown): Promise<void> {
  await requireRole(['admin', 'editor']);
  const targetId = id.parse(rawId);
  const supabase = await createAdminReadClient();
  const { data, error } = await supabase.from('resources').delete().eq('id', targetId).select('id');
  if (error) throw new Error(`deleteResource failed: ${error.message}`);
  assertRowAffected('deleteResource', data);
  revalidateResources();
}

/**
 * The uploaded file, as text for a CSV and as base64 for a spreadsheet.
 *
 * A `.xlsx` is a zip archive, so it cannot travel as text and cannot be
 * re-parsed from anything the browser derived from it. Sending the bytes keeps
 * the property the CSV path has: the browser chooses a file, and the server
 * decides everything about its contents. Base64 costs a third in size, which
 * is why next.config.ts raises the server-action body limit above the default.
 */
const importRequest = z.union([
  z.object({ csv: z.string().max(IMPORT_MAX_BYTES) }),
  z.object({ xlsx: z.string().max(Math.ceil(IMPORT_MAX_BYTES * 1.4)) }),
]);

/** Reads the uploaded file into the grid `validateTracker` works in. */
async function tableFrom(file: z.infer<typeof importRequest>): Promise<string[][]> {
  if ('csv' in file) return parseCsv(file.csv);
  // Imported here rather than at module scope so a CSV import does not pay for
  // the spreadsheet reader, matching how the public export loads its writer.
  const { default: readXlsxFile } = await import('read-excel-file/node');
  const sheets = await readXlsxFile(Buffer.from(file.xlsx, 'base64'));
  return pickSheetTable(sheets, TITLE_HEADERS);
}

/**
 * Bulk-create resources from an Operation 100 tracker CSV export.
 *
 * **The caller sends the file, not its verdicts.** The browser has already
 * parsed and previewed the same bytes with the same pure `validateTrackerCsv`,
 * but its conclusions are never consulted: this re-reads the dedupe index and
 * the partner list, re-runs the parser, and imports only the rows that pass
 * here. So the browser is the authority on nothing except which file to
 * import, and because the parser is pure, the row numbers in this report line
 * up with the preview the operator approved.
 *
 * **Rows are inserted one at a time, on purpose.** A single `insert([...])` is
 * one statement in one transaction: any collision with
 * `unique (partner, name)` would roll back every other row and return one
 * error naming none of them. Importing the good rows and reporting the rest is
 * the whole point of the feature, so the loop is what makes that possible. It
 * also makes recovery free -- the import only ever adds, so re-uploading the
 * same file after a failure returns the rows that already landed as
 * duplicates rather than doubling them.
 *
 * **Missing partners are created first.** `resources.partner` is a foreign key
 * to `partners(name)` and a tracker export names providers that are mostly not
 * there yet; rejecting them would be unactionable, because nothing in this
 * product can create a partner. The upsert body carries `name` alone: PostgREST
 * builds its `ON CONFLICT DO UPDATE SET` from the keys present in the body, so
 * omitting `logo_url`/`website_url` is what stops a re-import blanking assets
 * an admin uploaded later (see scripts/seed.ts).
 *
 * One `audit_log` row per resource is unavoidable and correct: the trigger from
 * 0018_audit_triggers.sql is `for each row`, so a 40-row import is 40 `created`
 * entries with the same actor. There is no batch representation and none may
 * be invented -- `audit_log` takes no writes from the application at all.
 */
export async function importTrackerResources(input: unknown): Promise<ImportReport> {
  await requireRole(['admin', 'editor']);
  const file = importRequest.parse(input);
  const supabase = await createAdminReadClient();
  const validation = validateTracker(await tableFrom(file), {
    existing: await readResourceDedupeIndex(),
    partners: await readPartnerNames(),
  });

  const strip = (row: RowOutcome): RowOutcome => ({ ...row, payload: null });
  if (validation.fileProblem !== null) {
    // no-revalidate: the file was rejected before any write, so no cached page
    // could have gone stale and evicting one would hide nothing but itself.
    return {
      fileProblem: validation.fileProblem,
      rows: [],
      imported: 0,
      createdPartners: [],
      preApproved: validation.preApproved,
    };
  }

  const createdPartners: string[] = [];
  if (validation.newPartners.length > 0) {
    const { error } = await supabase
      .from('partners')
      .upsert(
        validation.newPartners.map((name) => ({ name })),
        { onConflict: 'name' },
      );
    if (error) throw new Error(`importTrackerResources failed (partners): ${error.message}`);
    createdPartners.push(...validation.newPartners);
  }

  // Re-read, because the upsert above changed it and every row's partner has
  // to be in this list for assertKnownPartner to pass.
  const known = await readPartnerNames();
  const outcomes: RowOutcome[] = [];
  let imported = 0;

  for (const row of validation.rows) {
    if (!row.ok || row.payload === null) {
      outcomes.push(strip(row));
      continue;
    }
    const payload = row.payload;
    try {
      // Never expected to fire: the partner was either already known or
      // created moments ago. If it does, the partner list changed underneath
      // this import, and that is one row's problem rather than the file's.
      assertKnownPartner(payload.partner, known);
    } catch {
      outcomes.push({ ...strip(row), ok: false, code: 'invalid', detail: 'partner' });
      continue;
    }
    const { error } = await supabase.from('resources').insert(toRow(payload));
    if (error === null) {
      imported += 1;
      outcomes.push(strip(row));
      continue;
    }
    outcomes.push({
      ...strip(row),
      ok: false,
      code: isDuplicateResource(error) ? 'duplicateExisting' : 'writeFailed',
      detail: payload.name,
    });
  }

  // Last, and only for what actually landed: invalidating a tag for a write
  // that failed would evict a correct cached page and hide the failure behind
  // a cache miss.
  if (imported > 0) revalidateResources();
  if (createdPartners.length > 0) revalidatePartners();

  return {
    fileProblem: null,
    rows: outcomes,
    imported,
    createdPartners,
    preApproved: validation.preApproved,
  };
}
