'use client';

import { useState } from 'react';
import { saveSetting } from '@/lib/actions/settings';
import { settingUpdate } from '@/lib/schemas/settings';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_CARD_TITLE, ADMIN_FIELD, ADMIN_HELP, ADMIN_LABEL } from './chrome';
import { useFieldCommit } from './useFieldCommit';
import SaveStatus from './SaveStatus';

/**
 * The prototype's first Settings card: the GA4 Measurement ID, with a status
 * word beside the title -- green "Tracking active" naming the id once one is
 * stored, amber "Not connected" until then.
 *
 * Never fabricates a connected state: the status reads the *stored* value,
 * not the one being typed, so it changes only after a save succeeds. The
 * amber is the darkened funding token rather than the prototype's `#B4691F`,
 * for the contrast reason CLAUDE.md records.
 *
 * Only the Measurement ID is here. The property id the Data API needs is not
 * on the prototype's card and has no input; `SETTING_KEYS` still holds it,
 * so a future reporting screen can add the field without a migration.
 */
export default function AnalyticsCard({ measurementId }: { measurementId: string }) {
  const [value, setValue] = useState(measurementId);
  const [saved, setSaved] = useState(measurementId);
  const { status, pending, commit, fail } = useFieldCommit();

  function commitValue() {
    const next = value.trim();
    if (next === saved) return;
    // The same schema the action enforces, so a legacy UA- id is refused
    // without a round trip; `saveSetting`'s own parse remains the boundary.
    const parsed = settingUpdate.safeParse({ key: 'ga4_measurement_id', value: next });
    if (!parsed.success) {
      fail(t('admin.settings.ga4.invalidMeasurementId'));
      return;
    }
    commit(async () => {
      await saveSetting(parsed.data);
      setSaved(next);
    });
  }

  const active = saved !== '';

  return (
    <section style={ADMIN_PANEL} aria-labelledby="settings-analytics">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 id="settings-analytics" style={ADMIN_CARD_TITLE}>
          {t('admin.settings.analytics.heading')}
        </h2>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            color: active ? '#0E7A54' : 'var(--color-need-funding)',
          }}
        >
          {active
            ? t('admin.settings.ga4.trackingActive', { id: saved })
            : t('empty.ga4NotConnected')}
        </span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="setting-ga4-measurement-id" style={{ ...ADMIN_LABEL, marginBottom: 0 }}>
          {t('admin.settings.ga4.measurementId')}
        </label>
        <input
          id="setting-ga4-measurement-id"
          type="text"
          value={value}
          disabled={pending}
          placeholder={t('admin.settings.ga4.placeholder')}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue();
            }
          }}
          style={{ ...ADMIN_FIELD, width: 220, padding: '9px 12px', fontWeight: 700 }}
        />
        <SaveStatus status={status} />
      </div>
      <p style={{ ...ADMIN_HELP, marginTop: 10, lineHeight: 1.6 }}>
        {t('admin.settings.ga4.eventsNote')}
      </p>
    </section>
  );
}
