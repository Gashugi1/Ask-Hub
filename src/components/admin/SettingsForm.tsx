'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSetting } from '@/lib/actions/settings';
import { settingUpdate, CONTACT_EMAIL, type SettingKey } from '@/lib/schemas/settings';
import { t } from '@/lib/i18n';
import { ADMIN_H2, ADMIN_PANEL_COL, ADMIN_FIELD_ROW, ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_ERROR, ADMIN_HELP } from './chrome';

/**
 * `/admin/settings` is gated `requirePageRole(['admin'])` (notFound for
 * anyone else), so every field here is always writable — unlike
 * `ContentPanel`/`TextAreaField` on `/admin/content`, there is no `canWrite`
 * prop and no read-only rendering path to fall back to.
 */
export interface SettingsFormProps {
  settings: Record<string, string | boolean>;
}

/** One string-valued field: a label, a text input, its own Save button and its own error. */
function TextSetting({
  settingKey,
  label,
  initialValue,
  invalidMessage,
}: {
  settingKey: SettingKey;
  label: string;
  initialValue: string;
  invalidMessage: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    // Validated client-side against the same schema the server enforces, so
    // a GA4 id typed in a real UA- legacy shape or a second mailbox is
    // rejected without a round trip — the server's own settingUpdate.parse
    // remains the actual boundary regardless of what this check does.
    const parsed = settingUpdate.safeParse({ key: settingKey, value });
    if (!parsed.success) {
      setError(invalidMessage);
      return;
    }
    startTransition(async () => {
      try {
        await saveSetting(parsed.data);
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={ADMIN_FIELD_ROW} htmlFor={`setting-${settingKey}`}>
        {label}
        <input
          id={`setting-${settingKey}`}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={ADMIN_FIELD}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="submit"
          disabled={pending}
          className="proto-primary-button" style={{ ...ADMIN_PRIMARY, alignSelf: "flex-start" }}
        >
          {t('admin.content.save')}
        </button>
        {error ? <span style={ADMIN_ERROR}>{error}</span> : null}
      </div>
    </form>
  );
}

/** One boolean feature flag: a label, its "off at launch" note and an immediate on/off toggle. */
function FlagSetting({
  settingKey,
  label,
  initialValue,
}: {
  settingKey: SettingKey;
  label: string;
  initialValue: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    setError(null);
    const next = !value;
    startTransition(async () => {
      try {
        await saveSetting({ key: settingKey, value: next });
        setValue(next);
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1A2332" }}>
        <input
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={handleToggle}
          aria-label={label}
        />
        {label}
      </label>
      <p style={ADMIN_HELP}>{t('admin.settings.flags.offAtLaunch')}</p>
      {error ? <span style={ADMIN_ERROR}>{error}</span> : null}
    </div>
  );
}

/**
 * The three admin-only panels (PRD 6.7 panels 1-2, moved here per design
 * spec §3.1): Analytics (GA4), the contact mailbox, and the two feature
 * flags. Never fabricates a connected state — `ga4_measurement_id === ''`
 * always shows `empty.ga4NotConnected` regardless of `ga4_property_id`,
 * since the Data API read path needs both and the not-connected copy is
 * about the one id a human sets first (PRD 6.4).
 */
export default function SettingsForm({ settings }: SettingsFormProps) {
  const measurementId = typeof settings.ga4_measurement_id === 'string' ? settings.ga4_measurement_id : '';
  const propertyId = typeof settings.ga4_property_id === 'string' ? settings.ga4_property_id : '';
  const contactEmail = typeof settings.contact_email === 'string' ? settings.contact_email : CONTACT_EMAIL;
  const innovatorProfiles = settings.feature_innovator_profiles === true;
  const publicImpactPage = settings.feature_public_impact_page === true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={ADMIN_PANEL_COL}>
        <h2 style={ADMIN_H2}>{t('admin.settings.section.analytics')}</h2>
        {measurementId === '' ? (
          <p style={ADMIN_HELP}>{t('empty.ga4NotConnected')}</p>
        ) : null}
        <TextSetting
          settingKey="ga4_measurement_id"
          label={t('admin.settings.ga4.measurementId')}
          initialValue={measurementId}
          invalidMessage={t('admin.settings.ga4.invalidMeasurementId')}
        />
        <TextSetting
          settingKey="ga4_property_id"
          label={t('admin.settings.ga4.propertyId')}
          initialValue={propertyId}
          invalidMessage={t('admin.settings.ga4.invalidPropertyId')}
        />
        <p style={ADMIN_HELP}>{t('admin.settings.ga4.eventsNote')}</p>
      </section>

      <section style={ADMIN_PANEL_COL}>
        <h2 style={ADMIN_H2}>{t('admin.settings.section.contact')}</h2>
        <TextSetting
          settingKey="contact_email"
          label={t('admin.settings.contact.label')}
          initialValue={contactEmail}
          invalidMessage={t('admin.settings.contact.note')}
        />
        <p style={ADMIN_HELP}>{t('admin.settings.contact.note')}</p>
      </section>

      <section style={ADMIN_PANEL_COL}>
        <h2 style={ADMIN_H2}>{t('admin.settings.section.flags')}</h2>
        <FlagSetting
          settingKey="feature_innovator_profiles"
          label={t('admin.settings.flags.innovatorProfiles')}
          initialValue={innovatorProfiles}
        />
        <FlagSetting
          settingKey="feature_public_impact_page"
          label={t('admin.settings.flags.publicImpactPage')}
          initialValue={publicImpactPage}
        />
      </section>
    </div>
  );
}
