import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { anonClient, roleClient, serviceClient, ensureTestUsers } from '../helpers/clients';

// One valid, complete insert payload per table -- each of these would
// genuinely succeed if the caller held the grant/policy, so a 42501 on them
// proves RLS denial rather than a NOT NULL violation on a malformed `{}`
// payload. Built fresh (with a shared stamp) inside the test so every run
// gets unique identifiers, following tests/rls/resources.test.ts and
// tests/rls/community.test.ts.
function validPayloads(stamp: number) {
  return {
    programmes: { title: `Viewer write attempt ${stamp}` },
    impact_stories: { organisation: `Viewer write attempt org ${stamp}` },
    headline_stats: { value: '1', label: `Viewer write attempt ${stamp}` },
    compute_metrics: { value: '1', label: `Viewer write attempt ${stamp}` },
    site_content: { key: `viewer_write_attempt_${stamp}`, value: 'x', locale: 'en' },
    settings: { key: `viewer_write_attempt_${stamp}`, value: '"x"' },
  } as const;
}

// House rule: a suite may add its own fixture rows (stamped, disposable),
// but it must never mutate a row the migration authored -- `settings` and
// `site_content` both hold real, meaningful keys (ga4_measurement_id,
// welcome_band_heading, ...) that other tasks read and seed against, and
// there is no `db:reset` between suite runs in normal CI/dev use. Either
// restore the row you touched (capture-then-restore, in `afterAll`, using
// `serviceClient()` so RLS can't block the restore) or, simpler, touch a
// throwaway `Date.now()`-suffixed key you own and delete in `afterAll`.
// This suite takes the throwaway-key approach for both tables below: it
// proves the same permission boundary (can editor/admin write this table
// at all) without ever reading or writing a real content/config key, and
// cleanup is then an unconditional delete rather than a captured value to
// remember and put back correctly.
const suiteStamp = Date.now();
const throwawaySettingsKey = `test_settings_probe_${suiteStamp}`;
const throwawaySiteContentKey = `test_site_content_probe_${suiteStamp}`;

describe('site content and settings', () => {
  beforeAll(async () => {
    await ensureTestUsers();
    const svc = serviceClient();
    const { error } = await svc
      .from('settings')
      .insert({ key: throwawaySettingsKey, value: '""' });
    if (error) throw error;
  });

  afterAll(async () => {
    // Unconditional cleanup, independent of which assertions above passed
    // or failed, so a mid-suite failure never leaves either throwaway row
    // behind.
    const svc = serviceClient();
    await svc.from('settings').delete().eq('key', throwawaySettingsKey);
    await svc.from('site_content').delete().eq('key', throwawaySiteContentKey);
  });

  it('does not expose settings anonymously', async () => {
    const { data } = await anonClient().from('settings').select('key');
    expect(data ?? []).toHaveLength(0);
  });

  it('lets editor write site content', async () => {
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('site_content')
      .upsert(
        { key: throwawaySiteContentKey, value: 'Edited by editor', locale: 'en' },
        { onConflict: 'key,locale' },
      );
    expect(error).toBeNull();
  });

  it('does NOT let editor write settings — admin only', async () => {
    const editor = await roleClient('editor');
    const { error } = await editor
      .from('settings')
      .update({ value: '"G-HACKED"' })
      .eq('key', throwawaySettingsKey);

    // A PostgREST UPDATE that matches zero rows (because the RLS USING
    // clause hides every row from editor) returns success with no error,
    // so `error` alone proves nothing here. The read-back is the real
    // assertion, and it must compare against the value supabase-js
    // actually hands back for a genuine success -- verified directly
    // against this stack (curl straight to PostgREST, and psql) rather
    // than assumed: sending the JS string '"G-HACKED"' (quotes included)
    // through a PostgREST update on a jsonb column does NOT get parsed as
    // JSON text and unwrapped. PostgREST assigns the parsed JSON value
    // directly to the jsonb column rather than casting text through
    // Postgres's JSON parser, so the quote characters become part of the
    // stored string content. A genuine successful write therefore reads
    // back as the JS string '"G-HACKED"' with the quotes still in it,
    // byte for byte identical to the input -- not the bare 'G-HACKED'
    // that naive JSON-in/JSON-out reasoning would suggest. (Contrast
    // contact_email below, seeded via a raw SQL `::jsonb` cast rather
    // than a PostgREST request body: that path does parse, and reads
    // back bare, with no quotes -- two different round-trip behaviours
    // on the same column type.)
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('value')
      .eq('key', throwawaySettingsKey)
      .single();
    expect(data!.value).not.toBe('"G-HACKED"');
    if (error) expect(error.code).toBe('42501');
  });

  it('lets admin write settings', async () => {
    const admin = await roleClient('admin');
    const { error } = await admin
      .from('settings')
      .update({ value: '"G-TESTONLY"' })
      .eq('key', throwawaySettingsKey);
    expect(error).toBeNull();

    // The bare success above would also occur if the update matched zero
    // rows, so read the value back through service_role and confirm it
    // genuinely changed. Compare against the quoted form, matching the
    // real round-trip behaviour verified above (a PostgREST jsonb write
    // reads back byte-for-byte identical to the string that was sent).
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('value')
      .eq('key', throwawaySettingsKey)
      .single();
    expect(data!.value).toBe('"G-TESTONLY"');
  });

  it('does not let viewer write any site table', async () => {
    const viewer = await roleClient('viewer');
    const stamp = Date.now();
    const payloads = validPayloads(stamp);
    for (const table of [
      'programmes',
      'impact_stories',
      'headline_stats',
      'compute_metrics',
      'site_content',
      'settings',
    ] as const) {
      const { error } = await viewer.from(table).insert(payloads[table] as never);
      expect(error?.code, `viewer wrote to ${table}`).toBe('42501');
    }
  });

  it('ships both feature flags off', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('key, value')
      .in('key', ['feature_innovator_profiles', 'feature_public_impact_page']);
    expect(data).toHaveLength(2);
    for (const row of data!) {
      expect(row.value, `${row.key} is not false`).toBe(false);
    }
  });

  it('defaults contact_email to the single mailbox', async () => {
    const svc = serviceClient();
    const { data } = await svc
      .from('settings')
      .select('value')
      .eq('key', 'contact_email')
      .single();
    expect(data!.value).toBe('aihubfordevelopment@undp.org');
  });
});
