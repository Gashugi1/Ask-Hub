'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { resourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { createResource, updateResource } from '@/lib/actions/resources';
import { createResourceFromSubmission, markSubmissionApproved } from '@/lib/actions/submissions';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS, RESOURCE_TYPES } from '@/lib/reference';
import { STATUSES } from '@/lib/admin/resource-view';
import { Constants } from '@/lib/supabase/database.types';
import { t } from '@/lib/i18n';

const { partner_tier: PARTNER_TIERS, geo_scope: GEO_SCOPES, exclusivity: EXCLUSIVITY_VALUES } =
  Constants.public.Enums;

/**
 * The form's own working copy of every field, always strings/booleans/
 * arrays — never `null` — so every input stays a controlled component. Empty
 * string is this component's spelling of "not set yet"; `toPayload` below is
 * the one place that turns an empty string back into the `null` the schema
 * and the database expect.
 */
interface RawValues {
  name: string;
  partner: string;
  partnerTier: string;
  resourceType: string;
  needPrimary: string;
  needSecondary: string;
  subCategory: string;
  description: string;
  actionLabel: string;
  externalUrl: string;
  bannerImageUrl: string;
  countriesEligible: string[];
  sectorsEligible: string[];
  stagesEligible: string[];
  geoScope: string;
  deadline: string;
  status: string;
  isFeatured: boolean;
  exclusivity: string;
  sortOrder: string;
}

function toRaw(initial?: ResourceInput): RawValues {
  return {
    name: initial?.name ?? '',
    partner: initial?.partner ?? '',
    partnerTier: initial?.partnerTier ?? 'network',
    resourceType: initial?.resourceType ?? 'Programme',
    needPrimary: initial?.needPrimary ?? 'training',
    needSecondary: initial?.needSecondary ?? '',
    subCategory: initial?.subCategory ?? '',
    description: initial?.description ?? '',
    actionLabel: initial?.actionLabel ?? 'Learn more',
    externalUrl: initial?.externalUrl ?? '',
    bannerImageUrl: initial?.bannerImageUrl ?? '',
    countriesEligible: initial?.countriesEligible ?? [],
    sectorsEligible: initial?.sectorsEligible ?? [],
    stagesEligible: initial?.stagesEligible ?? ['Getting started', 'Building'],
    geoScope: initial?.geoScope ?? 'global',
    deadline: initial?.deadline ?? '',
    status: initial?.status ?? 'pipeline',
    isFeatured: initial?.isFeatured ?? false,
    exclusivity: initial?.exclusivity ?? '',
    sortOrder: initial?.sortOrder != null ? String(initial.sortOrder) : '',
  };
}

/** The inverse of `toRaw`: empty string becomes `null` for every nullable field. */
function toPayload(raw: RawValues): unknown {
  return {
    name: raw.name,
    partner: raw.partner,
    partnerTier: raw.partnerTier,
    resourceType: raw.resourceType,
    needPrimary: raw.needPrimary,
    needSecondary: raw.needSecondary === '' ? null : raw.needSecondary,
    subCategory: raw.subCategory === '' ? null : raw.subCategory,
    description: raw.description,
    actionLabel: raw.actionLabel,
    externalUrl: raw.externalUrl,
    bannerImageUrl: raw.bannerImageUrl === '' ? null : raw.bannerImageUrl,
    countriesEligible: raw.countriesEligible,
    sectorsEligible: raw.sectorsEligible,
    stagesEligible: raw.stagesEligible,
    geoScope: raw.geoScope,
    deadline: raw.deadline === '' ? null : raw.deadline,
    status: raw.status,
    isFeatured: raw.isFeatured,
    exclusivity: raw.exclusivity === '' ? null : raw.exclusivity,
    sortOrder: raw.sortOrder === '' ? null : Number(raw.sortOrder),
  };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** A JSX-safe way to render a single required-field marker with no letters in it. */
function Required() {
  return (
    <span aria-hidden="true" style={{ color: "#C0392B" }}>
      {' *'}
    </span>
  );
}

export default function ResourceForm({
  initial,
  partners,
  prefill,
  submissionId,
  onSaved,
  onCancel,
}: {
  initial?: ResourceInput & { id: string };
  /**
   * From `readPartnerNames()`: the providers the field suggests. Not a
   * gate -- any name may be typed, and a name the registry lacks is created
   * when the resource is saved (ensureProvider).
   */
  partners: readonly string[];
  /**
   * A suggestion's draft, for "Edit first": the fields start from it rather
   * than blank. Ignored when `initial` is set.
   */
  prefill?: ResourceInput;
  /**
   * The submission this save completes. On create the write goes through
   * `createResourceFromSubmission`, which may create the partner and marks
   * the suggestion approved; on edit, `markSubmissionApproved` follows the
   * update. Either way the suggestion leaves the Review Queue.
   */
  submissionId?: string;
  /** The modal around this form: a successful save and Cancel both hand control back to it. */
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState<RawValues>(() => toRaw(initial ?? prefill));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RawValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof RawValues>(key: K, value: RawValues[K]) {
    setRaw((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = resourceInput.safeParse(toPayload(raw));
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors as Partial<
        Record<keyof RawValues, string[]>
      >;
      const next: Partial<Record<keyof RawValues, string>> = {};
      for (const key of Object.keys(flattened) as (keyof RawValues)[]) {
        const messages = flattened[key];
        if (messages && messages.length > 0) next[key] = messages[0]!;
      }
      // A stored country outside the programme's eighteen (some rows carry
      // one) is shown as a chip so it can be taken off; Zod's own wording
      // for it would name an enum, not the country.
      const strayCountries = raw.countriesEligible.filter(
        (country) => !(COUNTRIES as readonly string[]).includes(country),
      );
      if (next.countriesEligible && strayCountries.length > 0) {
        next.countriesEligible = t('admin.resources.form.countryNotProgramme', {
          countries: strayCountries.join(', '),
        });
      }
      setFieldErrors(next);
      setFormError(null);
      return;
    }

    // The prototype's two rules the schema does not express: an eligibility
    // group left empty when it means something. `resourceInput` accepts an
    // empty stages array, and an empty countries array under `specific` scope
    // -- but a resource "for selected countries" that names none is a data
    // error, and the prototype refuses both at entry.
    if (parsed.data.stagesEligible.length === 0) {
      setFieldErrors({ stagesEligible: t('admin.resources.form.needStage') });
      setFormError(null);
      return;
    }
    if (parsed.data.geoScope === 'specific' && parsed.data.countriesEligible.length === 0) {
      setFieldErrors({ countriesEligible: t('admin.resources.form.needCountry') });
      setFormError(null);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      try {
        if (initial) {
          await updateResource(initial.id, parsed.data);
          if (submissionId) await markSubmissionApproved(submissionId);
        } else if (submissionId) {
          const outcome = await createResourceFromSubmission(submissionId, parsed.data);
          if (!outcome.ok) {
            setFormError(t(`admin.review.refused.${outcome.reason}`));
            return;
          }
        } else {
          await createResource(parsed.data);
        }
        onSaved();
      } catch {
        setFormError(t('admin.error.generic'));
      }
    });
  }

  const showCountryChips = raw.geoScope === 'specific';
  const allSectors = raw.sectorsEligible.length === 0;
  const trimmedProvider = raw.partner.trim();
  const newProvider = trimmedProvider !== '' && !partners.includes(trimmedProvider);
  // Programme countries first, then any stored value outside them, so a row
  // that arrived with one can have it taken off rather than hiding it.
  const countryChips = [
    ...COUNTRIES,
    ...raw.countriesEligible.filter((c) => !(COUNTRIES as readonly string[]).includes(c)),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div style={FORM_GRID}>
        <div style={SPAN_2}>
          <label htmlFor="rf-name" style={LABEL}>{t('admin.resources.form.label.name')}<Required /></label>
          <input id="rf-name" type="text" value={raw.name} onChange={(e) => set('name', e.target.value)} required style={FORM_FIELD} />
          {fieldErrors.name ? <p style={FIELD_ERROR}>{fieldErrors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-partner" style={LABEL}>{t('admin.resources.form.label.partner')}<Required /></label>
          {/* The prototype's free-text field, with the registry as
              suggestions: a datalist offers every known provider, and a name
              none of them match is created when the resource is saved. The
              note says so the moment the name stops matching. */}
          <input id="rf-partner" type="text" list="rf-providers" value={raw.partner} onChange={(e) => set('partner', e.target.value)} required autoComplete="off" style={FORM_FIELD} />
          <datalist id="rf-providers">
            {partners.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {newProvider ? <p style={HINT}>{t('admin.resources.form.newProvider')}</p> : null}
          {fieldErrors.partner ? <p style={FIELD_ERROR}>{fieldErrors.partner}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-partner-tier" style={LABEL}>{t('admin.resources.form.label.partnerTier')}<Required /></label>
          <select id="rf-partner-tier" value={raw.partnerTier} onChange={(e) => set('partnerTier', e.target.value)} required style={FORM_SELECT}>
            {PARTNER_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {t(`admin.resources.partnerTier.${tier}`)}
              </option>
            ))}
          </select>
          {fieldErrors.partnerTier ? <p style={FIELD_ERROR}>{fieldErrors.partnerTier}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-type" style={LABEL}>{t('admin.resources.form.label.resourceType')}<Required /></label>
          <select id="rf-type" value={raw.resourceType} onChange={(e) => set('resourceType', e.target.value)} required style={FORM_SELECT}>
            {/* As with partners: a stored type outside the list stays visible and selected. */}
            {withStored(RESOURCE_TYPES, initial?.resourceType ?? '').map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {fieldErrors.resourceType ? <p style={FIELD_ERROR}>{fieldErrors.resourceType}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-status" style={LABEL}>{t('admin.resources.form.label.status')}</label>
          <select id="rf-status" value={raw.status} onChange={(e) => set('status', e.target.value)} style={FORM_SELECT}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rf-need" style={LABEL}>{t('admin.resources.form.label.needPrimary')}<Required /></label>
          <select id="rf-need" value={raw.needPrimary} onChange={(e) => set('needPrimary', e.target.value)} required style={FORM_SELECT}>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
          {fieldErrors.needPrimary ? <p style={FIELD_ERROR}>{fieldErrors.needPrimary}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-need-2" style={LABEL}>{t('admin.resources.form.label.needSecondary')}</label>
          <select id="rf-need-2" value={raw.needSecondary} onChange={(e) => set('needSecondary', e.target.value)} style={FORM_SELECT}>
            <option value="">{t('admin.resources.form.none')}</option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rf-sub" style={LABEL}>{t('admin.resources.form.label.subCategory')}</label>
          <input id="rf-sub" type="text" value={raw.subCategory} onChange={(e) => set('subCategory', e.target.value)} placeholder={t('admin.resources.form.subCategoryPlaceholder')} style={FORM_FIELD} />
        </div>

        <fieldset style={{ ...SPAN_2, ...CHIP_GROUP }}>
          <legend style={LABEL}>{t('admin.resources.form.label.stagesEligible')}</legend>
          <div style={CHIP_ROW}>
            {STAGES.map((stage) => (
              <Chip key={stage} label={stage} on={raw.stagesEligible.includes(stage)} onToggle={() => set('stagesEligible', toggle(raw.stagesEligible, stage))} />
            ))}
          </div>
          {fieldErrors.stagesEligible ? <p style={FIELD_ERROR}>{fieldErrors.stagesEligible}</p> : null}
        </fieldset>

        <fieldset style={{ ...SPAN_2, ...CHIP_GROUP }}>
          <legend style={LABEL}>{t('admin.resources.form.label.sectorsEligible')}</legend>
          <div style={CHIP_ROW}>
            {/* An empty list means open to every sector (PRD 4.1), which is
                what the prototype's "All sectors" chip states outright. */}
            <Chip label={t('admin.resources.form.allSectors')} on={allSectors} onToggle={() => set('sectorsEligible', [])} />
            {SECTORS.map((sector) => (
              <Chip key={sector} label={sector} on={raw.sectorsEligible.includes(sector)} onToggle={() => set('sectorsEligible', toggle(raw.sectorsEligible, sector))} />
            ))}
          </div>
        </fieldset>

        <div style={SPAN_2}>
          <label htmlFor="rf-scope" style={LABEL}>{t('admin.resources.form.label.countriesEligible')}</label>
          <select id="rf-scope" value={raw.geoScope} onChange={(e) => set('geoScope', e.target.value)} style={FORM_SELECT}>
            {GEO_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(`admin.resources.geoScope.${scope}`)}
              </option>
            ))}
          </select>
          {showCountryChips ? (
            <div role="group" aria-label={t('admin.resources.form.label.countriesEligible')} style={{ ...CHIP_ROW, gap: 7, marginTop: 10 }}>
              {countryChips.map((country) => (
                <Chip key={country} label={country} small on={raw.countriesEligible.includes(country)} onToggle={() => set('countriesEligible', toggle(raw.countriesEligible, country))} />
              ))}
            </div>
          ) : null}
          {fieldErrors.countriesEligible ? <p style={FIELD_ERROR}>{fieldErrors.countriesEligible}</p> : null}
        </div>

        <div style={SPAN_2}>
          <label htmlFor="rf-description" style={LABEL}>{t('admin.resources.form.label.description')}<Required /></label>
          <textarea id="rf-description" value={raw.description} onChange={(e) => set('description', e.target.value)} required rows={3} style={{ ...FORM_FIELD, resize: 'vertical' }} />
          {fieldErrors.description ? <p style={FIELD_ERROR}>{fieldErrors.description}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-action" style={LABEL}>{t('admin.resources.form.label.actionLabel')}<Required /></label>
          <input id="rf-action" type="text" value={raw.actionLabel} onChange={(e) => set('actionLabel', e.target.value)} required style={FORM_FIELD} />
          {fieldErrors.actionLabel ? <p style={FIELD_ERROR}>{fieldErrors.actionLabel}</p> : null}
        </div>

        <div>
          <label htmlFor="rf-deadline" style={LABEL}>{t('admin.resources.form.label.deadline')}</label>
          <input id="rf-deadline" type="date" value={raw.deadline} onChange={(e) => set('deadline', e.target.value)} style={{ ...FORM_FIELD, padding: '9px 13px' }} />
          <p style={HINT}>{t('admin.resources.form.deadlineHint')}</p>
          {fieldErrors.deadline ? <p style={FIELD_ERROR}>{fieldErrors.deadline}</p> : null}
        </div>

        <div style={SPAN_2}>
          <label htmlFor="rf-banner" style={LABEL}>{t('admin.resources.form.label.bannerImageUrl')}</label>
          <input id="rf-banner" type="text" value={raw.bannerImageUrl} onChange={(e) => set('bannerImageUrl', e.target.value)} placeholder={t('admin.resources.form.bannerPlaceholder')} style={FORM_FIELD} />
          {fieldErrors.bannerImageUrl ? <p style={FIELD_ERROR}>{fieldErrors.bannerImageUrl}</p> : null}
        </div>

        <div style={SPAN_2}>
          <label htmlFor="rf-url" style={LABEL}>{t('admin.resources.form.label.externalUrl')}<Required /></label>
          <input id="rf-url" type="text" value={raw.externalUrl} onChange={(e) => set('externalUrl', e.target.value)} required placeholder="https://" style={FORM_FIELD} />
          {fieldErrors.externalUrl ? <p style={FIELD_ERROR}>{fieldErrors.externalUrl}</p> : null}
        </div>

        {/* Prototype line 1620: the Featured toggle in its grey box. Its
            sibling per-resource check box (line 1624) is not ported --
            curation is stated once, globally (CLAUDE.md content rules). */}
        <label style={{ ...SPAN_2, ...TOGGLE_BOX }}>
          <input type="checkbox" checked={raw.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} style={TOGGLE_CHECK} />
          <span>
            <span style={{ fontWeight: 800 }}>{t('admin.resources.form.featured')}</span>
            {t('admin.resources.form.featuredHint')}
          </span>
        </label>

        <div>
          <label htmlFor="rf-exclusivity" style={LABEL}>{t('admin.resources.form.label.exclusivity')}</label>
          <select id="rf-exclusivity" value={raw.exclusivity} onChange={(e) => set('exclusivity', e.target.value)} style={FORM_SELECT}>
            <option value="">{t('admin.resources.form.none')}</option>
            {EXCLUSIVITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === 'exclusive' ? t('badge.exclusive') : t('badge.earlyAccess')}
              </option>
            ))}
          </select>
        </div>

        {/* Not in the prototype: `sort_order` drives the public listing order
            (PRD 4.1) and has no other place to be edited. */}
        <div>
          <label htmlFor="rf-sort" style={LABEL}>{t('admin.resources.form.sortOrder')}</label>
          <input id="rf-sort" type="number" min={0} value={raw.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} style={FORM_FIELD} />
          {fieldErrors.sortOrder ? <p style={FIELD_ERROR}>{fieldErrors.sortOrder}</p> : null}
        </div>
      </div>

      {formError ? (
        <p role="alert" style={FORM_ERROR}>
          {formError}
        </p>
      ) : null}

      {/* The prototype's footer: Cancel then Save resource, right-aligned.
          No delete here -- the prototype deletes from the table row, and so
          does this app (DeleteRowButton). */}
      <div style={FOOTER}>
        <button type="button" onClick={onCancel} style={CANCEL_BUTTON}>
          {t('admin.resources.form.cancel')}
        </button>
        <button type="submit" disabled={pending} className="proto-primary-button" style={SAVE_BUTTON}>
          {t('admin.resources.form.submitSave')}
        </button>
      </div>
    </form>
  );
}

/** The prototype's chip (line 1558): a pill that fills in blue when selected; the country chips (line 1584) are one step smaller. */
function Chip({
  label,
  on,
  small,
  onToggle,
}: {
  label: string;
  on: boolean;
  small?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      style={{
        border: `1.5px solid ${on ? '#1F5FBF' : '#C9D3E8'}`,
        background: on ? '#1F5FBF' : '#fff',
        color: on ? '#fff' : '#42506E',
        borderRadius: 99,
        padding: small ? '6px 12px' : '7px 15px',
        fontSize: small ? 12 : 12.5,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** The stored value stays listed and selected even when it is no longer among the offered options. */
function withStored(known: readonly string[], stored: string): string[] {
  if (stored === '' || known.includes(stored)) return [...known];
  return [stored, ...known];
}

/*
 * Transcribed from the approved prototype's resource form modal: its field
 * order, its two-column grid with full-width rows for the title, the three
 * eligibility groups, the summary, the two URLs and the Featured box;
 * uppercase micro-labels; 8px-radius hairline inputs at 14px; blue-filled
 * chips; and the Cancel / Save resource footer. Always mounted inside
 * ResourceModal, which is the prototype's architecture too.
 *
 * Departures, each deliberate: the prototype's per-resource curation check
 * box is absent (curation is stated once, globally -- CLAUDE.md content
 * rules); Provider tier, Action label and Sort order are fields here where
 * the prototype defaults them silently, because this is the only UI that
 * sets them; and errors are shown under the field they belong to, with the
 * prototype's single red line kept for errors that are the form's as a whole.
 */

/** Prototype line 1493: the micro-label above each control. */
const LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
} as const;

/** Prototype line 1494: text input and textarea. */
const FORM_FIELD = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #C9D3E8',
  borderRadius: 8,
  fontSize: 14,
  color: '#1A2332',
  background: '#fff',
  outline: 'none',
} as const;

/** Prototype line 1502: the selects sit one pixel tighter and take a pointer. */
const FORM_SELECT = { ...FORM_FIELD, padding: '10px 12px', cursor: 'pointer' } as const;

const FIELD_ERROR = {
  margin: '5px 0 0 0',
  fontSize: 12,
  fontWeight: 600,
  color: '#C0392B',
} as const;

/** Prototype line 1630: the form-level error line. */
const FORM_ERROR = {
  margin: '14px 0 0 0',
  fontSize: 13,
  color: '#C0392B',
  fontWeight: 700,
} as const;

/** Prototype line 1608: the deadline's helper text. */
const HINT = { margin: '5px 0 0 0', fontSize: 11.5, color: '#5B6B8C' } as const;

/** Prototype line 1492: the form's two-column grid. */
const FORM_GRID = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
  marginTop: 20,
} as const;

const SPAN_2 = { gridColumn: 'span 2' } as const;

/** A chip group is a fieldset for assistive technology only; visually it is the prototype's plain block. */
const CHIP_GROUP = { border: 'none', padding: 0, margin: 0, minWidth: 0 } as const;

/** Prototype line 1556: the chip row. */
const CHIP_ROW = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;

/** Prototype line 1620: the Featured box. */
const TOGGLE_BOX = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  background: '#F4F6F9',
  borderRadius: 9,
  padding: '12px 14px',
  fontSize: 13,
  color: '#42506E',
  cursor: 'pointer',
} as const;

const TOGGLE_CHECK = { width: 16, height: 16, accentColor: '#1F5FBF', cursor: 'pointer', flexShrink: 0 } as const;

/** Prototype line 1633: the footer. */
const FOOTER = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 } as const;

/** Prototype line 1634: the outlined Cancel. */
const CANCEL_BUTTON = {
  border: '1.5px solid #C9D3E8',
  background: '#fff',
  color: '#42506E',
  borderRadius: 9,
  padding: '11px 20px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

/** Prototype line 1635: Save resource. */
const SAVE_BUTTON = {
  background: '#1F5FBF',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '11px 24px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;
