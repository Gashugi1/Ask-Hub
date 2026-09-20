import { describe, it, expect } from 'vitest';
import { serviceClient } from '../helpers/clients';

const EXPECTED: Record<string, string[]> = {
  app_role: ['admin', 'editor', 'viewer'],
  resource_status: ['live', 'pipeline', 'reference'],
  need_type: ['compute', 'training', 'funding', 'accelerator', 'data', 'challenges', 'community'],
  geo_scope: ['global', 'all_africa', 'partner_countries', 'specific'],
  partner_tier: ['strategic', 'government', 'development_partner', 'academic', 'network'],
  submission_type: ['new_resource', 'update_suggestion'],
  submission_status: ['pending', 'approved', 'rejected'],
  partnership_stage: ['prospecting', 'in_discussion', 'active', 'delivered'],
  audit_action: [
    'published', 'edited', 'created', 'deleted',
    'approved', 'rejected', 'role_changed', 'digest_sent',
  ],
};

describe('enums', () => {
  it('defines every enum with exactly the specified labels', async () => {
    const svc = serviceClient();
    const { data, error } = await svc.rpc('enum_labels');
    expect(error).toBeNull();
    const actual = data as { enum_name: string; labels: string[] }[];
    for (const [name, labels] of Object.entries(EXPECTED)) {
      const row = actual.find((r) => r.enum_name === name);
      expect(row, `missing enum ${name}`).toBeDefined();
      expect(row!.labels).toEqual(labels);
    }
  });
});
