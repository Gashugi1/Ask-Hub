import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureTestUsers, roleClient, serviceClient } from '../helpers/clients';
import { fixtureStamp } from '../helpers/fixtures';

/**
 * `importTrackerResources` against the real tables, as an editor under RLS.
 *
 * The action is where the two things unit tests cannot reach happen: it is the
 * only code path in this product that writes `partners`, and it is the first
 * that writes many resources in one call. Both are asserted here at the
 * database, not at the mapper.
 *
 * **What is mocked, and what that costs.** The same three modules
 * `tests/rls/resource-partner-fk.test.ts` mocks, for the same Vitest-process
 * reasons: `@/lib/admin/client` and `@/lib/auth` both resolve a session
 * through `cookies()` from `next/headers`, which has no meaning outside a Next
 * request scope, and `next/cache` needs one too. **So nothing here covers the
 * role gate or revalidation** — `tests/structure/action-role-checks.test.ts`
 * and `tests/structure/revalidation-contract.test.ts` hold those statically,
 * and `tests/rls/admin-actions-resources.test.ts` holds the database's own
 * refusal of a viewer.
 */
const harness = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock('@/lib/admin/client', () => ({
  createAdminReadClient: async () => {
    if (!harness.client) throw new Error('import harness: no client set up');
    return harness.client;
  },
}));

vi.mock('@/lib/auth', () => ({
  requireRole: async () => ({ role: 'editor' }),
}));

vi.mock('next/cache', () => ({
  revalidateTag: () => {},
}));

const { importTrackerResources } = await import('@/lib/actions/resources');

const stamp = fixtureStamp();
/** Exists before the import runs, so a row naming it creates no partner. */
const KNOWN_PARTNER = `Import known partner ${stamp}`;
/** Absent from `partners`; the import is expected to create it. */
const NEW_PARTNER = `Import new partner ${stamp}`;

const HEAD =
  'Resource Title,Provider,Proposed Category,One-Sentence Summary,Application / Registration Link,Closing Date,Lifecycle State,Status,All Gates Passed';

function row(fields: {
  title: string;
  provider: string;
  category?: string;
  summary?: string;
  link?: string;
  closing?: string;
  lifecycle?: string;
  status?: string;
  gates?: string;
}): string {
  const cells = [
    fields.title,
    fields.provider,
    fields.category ?? 'Compute',
    fields.summary ?? 'GPU hours for African AI teams.',
    fields.link ?? 'https://example.org/apply',
    fields.closing ?? '2026-12-01',
    fields.lifecycle ?? 'Open',
    fields.status ?? 'Approved',
    fields.gates ?? 'Pass',
  ];
  return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',');
}

const csv = (...rows: string[]) => [HEAD, ...rows].join('\r\n');

/** Everything this file writes, removed unconditionally: imported rows land live. */
const createdResourceNames: string[] = [];

beforeAll(async () => {
  await ensureTestUsers();
  harness.client = await roleClient('editor');
  const service = serviceClient();
  const { error } = await service.from('partners').insert({ name: KNOWN_PARTNER });
  if (error) throw new Error(`could not seed the fixture partner: ${error.message}`);
});

afterAll(async () => {
  const service = serviceClient();
  if (createdResourceNames.length > 0) {
    await service.from('resources').delete().in('name', createdResourceNames);
  }
  // Resources first: partners is `on delete restrict`.
  await service.from('partners').delete().in('name', [KNOWN_PARTNER, NEW_PARTNER]);
});

describe('importTrackerResources', () => {
  it('imports the passing rows and reports the rest', async () => {
    const good = `Import good ${stamp}`;
    const badCategory = `Import bad category ${stamp}`;
    const insecure = `Import insecure ${stamp}`;
    createdResourceNames.push(good, badCategory, insecure);

    const report = await importTrackerResources({
      csv: csv(
        row({ title: good, provider: KNOWN_PARTNER }),
        row({ title: badCategory, provider: KNOWN_PARTNER, category: 'Mentorship' }),
        row({ title: insecure, provider: KNOWN_PARTNER, link: 'http://example.org/x' }),
      ),
    });

    expect(report.fileProblem).toBeNull();
    expect(report.imported).toBe(1);
    expect(report.rows.map((r) => r.code)).toEqual([null, 'unknownCategory', 'insecureLink']);

    const service = serviceClient();
    const { data } = await service
      .from('resources')
      .select('name, status, partner, partner_tier, need_primary')
      .in('name', [good, badCategory, insecure]);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      name: good,
      status: 'live',
      partner: KNOWN_PARTNER,
      partner_tier: 'network',
      need_primary: 'compute',
    });
  });

  it('creates a partner the file names for the first time', async () => {
    const name = `Import creates partner ${stamp}`;
    createdResourceNames.push(name);

    const report = await importTrackerResources({
      csv: csv(row({ title: name, provider: NEW_PARTNER })),
    });

    expect(report.imported).toBe(1);
    expect(report.createdPartners).toEqual([NEW_PARTNER]);

    const service = serviceClient();
    const { data } = await service
      .from('partners')
      .select('name, logo_url, website_url')
      .eq('name', NEW_PARTNER)
      .single();
    // Name only: the upsert body omits the asset columns so that re-importing
    // can never blank a logo an admin uploaded later.
    expect(data).toMatchObject({ name: NEW_PARTNER, logo_url: null, website_url: null });
  });

  it('writes one audit row per imported resource, attributed to the caller', async () => {
    const name = `Import audited ${stamp}`;
    createdResourceNames.push(name);

    await importTrackerResources({ csv: csv(row({ title: name, provider: KNOWN_PARTNER })) });

    const service = serviceClient();
    const { data } = await service
      .from('audit_log')
      .select('action, entity_type, entity_label, actor_name')
      .eq('entity_label', name);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ action: 'created', entity_type: 'resource' });
    // `system` would mean the write ran on the service-role client, which
    // would make the largest write in the product unattributable.
    expect(data?.[0]?.actor_name).not.toBe('system');
  });

  it('rejects a row that already exists rather than duplicating it', async () => {
    const name = `Import duplicate ${stamp}`;
    createdResourceNames.push(name);
    const file = csv(row({ title: name, provider: KNOWN_PARTNER }));

    const first = await importTrackerResources({ csv: file });
    expect(first.imported).toBe(1);

    // The same file again: the dedupe read now finds the row it just wrote,
    // which is what makes re-uploading after a failure safe.
    const second = await importTrackerResources({ csv: file });
    expect(second.imported).toBe(0);
    expect(second.rows[0]?.code).toBe('duplicateExisting');

    const service = serviceClient();
    const { data } = await service.from('resources').select('id').eq('name', name);
    expect(data).toHaveLength(1);
  });

  it('lands a row closed in the tracker as pipeline, off the public directory', async () => {
    const name = `Import closed ${stamp}`;
    createdResourceNames.push(name);

    await importTrackerResources({
      csv: csv(row({ title: name, provider: KNOWN_PARTNER, lifecycle: 'Closed for 2026' })),
    });

    const service = serviceClient();
    const { data } = await service
      .from('resources')
      .select('status')
      .eq('name', name)
      .single();
    expect(data?.status).toBe('pipeline');
  });

  it('imports a real .xlsx as readily as a CSV', async () => {
    // The spreadsheet travels as its own bytes, so the server reads the file
    // rather than anything the browser derived from it.
    const name = `Import from xlsx ${stamp}`;
    createdResourceNames.push(name);

    const buffer = await writeXlsxFile(
      [
        [
          { value: 'Resource Title' }, { value: 'Provider' }, { value: 'Proposed Category' },
          { value: 'One-Sentence Summary' }, { value: 'Application / Registration Link' },
          { value: 'Closing Date' },
        ],
        [
          { value: name }, { value: KNOWN_PARTNER }, { value: 'Compute' },
          { value: 'GPU hours for African AI teams.' }, { value: 'https://example.org/apply' },
          { value: new Date(Date.UTC(2026, 11, 1)), type: Date, format: 'yyyy-mm-dd' },
        ],
      ],
    ).toBuffer();

    const report = await importTrackerResources({ xlsx: buffer.toString('base64') });
    expect(report.fileProblem).toBeNull();
    expect(report.imported).toBe(1);

    const service = serviceClient();
    const { data } = await service
      .from('resources')
      .select('name, deadline, partner')
      .eq('name', name)
      .single();
    // The date arrived as a typed cell, not a string, and still reached the
    // column as a date.
    expect(data).toMatchObject({ name, deadline: '2026-12-01', partner: KNOWN_PARTNER });
  });

  it('writes nothing at all when the file itself is unusable', async () => {
    const report = await importTrackerResources({ csv: 'Provider,Notes\r\n"CINECA","x"' });
    expect(report.fileProblem?.code).toBe('missingColumns');
    expect(report.imported).toBe(0);
    expect(report.rows).toEqual([]);
  });
});
