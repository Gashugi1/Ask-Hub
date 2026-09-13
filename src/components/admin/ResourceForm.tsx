'use client';

import { useState, useTransition, useRef } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { createResource, updateResource, deleteResource } from '@/lib/actions/resources';
import { createResourceFromSubmission, markSubmissionApproved } from '@/lib/actions/submissions';
import { COUNTRIES, SECTORS, STAGES, NEED_KEYS } from '@/lib/reference';
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
    partnerTier: initial?.partnerTier ?? '',
    resourceType: initial?.resourceType ?? '',
    needPrimary: initial?.needPrimary ?? '',
    needSecondary: initial?.needSecondary ?? '',
    subCategory: initial?.subCategory ?? '',
    description: initial?.description ?? '',
    actionLabel: initial?.actionLabel ?? 'Apply',
    externalUrl: initial?.externalUrl ?? '',
    bannerImageUrl: initial?.bannerImageUrl ?? '',
    countriesEligible: initial?.countriesEligible ?? [],
    sectorsEligible: initial?.sectorsEligible ?? [],
    stagesEligible: initial?.stagesEligible ?? [],
    geoScope: initial?.geoScope ?? 'specific',
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

/**
 * The options the partner select offers: every known partner, plus the
 * resource's own stored partner when that is somehow not among them.
 *
 * Keeping the stored value is the point, and the reason is narrower than
 * "otherwise it gets saved wrong" — measured, not assumed. With the option
 * absent, React sets a `value` no `<option>` carries, and the control falls
 * back to displaying the first real one instead — a partner the row does not
 * have. The submitted value is still React state, which
 * still holds the stored partner, so nothing is silently rewritten; what
 * breaks is that the field shows a partner the resource does not have, and
 * the error below then names a value the curator cannot see selected.
 * Listing the stored value fixes the display; `handleSubmit` still refuses to
 * send it, so the only way past this screen is to choose a real partner.
 *
 * How reachable is that? Not, as the schema stands: `resources.partner` is a
 * foreign key to `partners(name)` with `on update cascade` (a rename follows
 * the row) and `on delete restrict` (a referenced partner cannot be deleted),
 * so a stored partner is in `partners` by construction and `readPartnerNames`
 * lists all of them unfiltered. This branch is for the case where that stops
 * being true — a dropped constraint, a filtered reader — and costs one line.
 */
function partnerOptions(known: readonly string[], stored: string): string[] {
  if (stored === '' || known.includes(stored)) return [...known];
  return [stored, ...known];
}

export default function ResourceForm({
  initial,
  partners,
  prefill,
  submissionId,
}: {
  initial?: ResourceInput & { id: string };
  /** From `readPartnerNames()`; the create and edit routes both supply it. */
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
}) {
  const [raw, setRaw] = useState<RawValues>(() => toRaw(initial ?? prefill));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RawValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      setFieldErrors(next);
      setFormError(null);
      return;
    }

    // The partner must be one this screen was offered, which is the one field
    // `resourceInput` cannot judge: it is a foreign key to partners(name) and
    // the schema has no database to ask (see assertKnownPartner). The action
    // re-checks this server-side and is the actual guard — this is here so the
    // operator gets a field-level message naming the value, rather than the
    // generic form error a thrown server action produces. Next replaces a
    // server action's error message with an opaque digest in production, so
    // the specific wording has to be produced on this side.
    // Skipped when completing a suggestion: its organisation is usually a
    // partner the table has never seen, and createResourceFromSubmission
    // creates it name-only before the insert, as Approve & publish does.
    if (!submissionId && !partners.includes(parsed.data.partner)) {
      setFieldErrors({
        partner: t('admin.resources.form.partnerUnknown', { partner: parsed.data.partner }),
      });
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
        router.push('/admin/resources');
        router.refresh();
      } catch {
        setFormError(t('admin.error.generic'));
      }
    });
  }

  function handleDelete() {
    if (!initial) return;
    startTransition(async () => {
      try {
        const outcome = await deleteResource(initial.id);
        if (!outcome.ok) {
          setFormError(t('admin.resources.deleteBlocked'));
          return;
        }
        router.push('/admin/resources');
        router.refresh();
      } catch {
        setFormError(t('admin.error.generic'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={FORM_GRID}>
        <label style={FIELD_ROW}>
          {t('column.name')}
          <Required />
          <input
            type="text"
            value={raw.name}
            onChange={(e) => set('name', e.target.value)}
            required
            style={FORM_FIELD}
          />
          {fieldErrors.name ? <span style={FIELD_ERROR}>{fieldErrors.name}</span> : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.partnerName')}
          <Required />
          <select
            value={raw.partner}
            onChange={(e) => set('partner', e.target.value)}
            required
            style={FORM_FIELD}
          >
            <option value="" disabled>
              {t('admin.resources.form.selectPlaceholder')}
            </option>
            {/* The stored value, not `raw.partner`: the option list must not
                reshuffle as the curator picks. */}
            {partnerOptions(partners, initial?.partner ?? '').map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {fieldErrors.partner ? (
            <span style={FIELD_ERROR}>{fieldErrors.partner}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.form.partnerTier')}
          <Required />
          <select
            value={raw.partnerTier}
            onChange={(e) => set('partnerTier', e.target.value)}
            required
            style={FORM_FIELD}
          >
            <option value="" disabled>
              {t('admin.resources.form.selectPlaceholder')}
            </option>
            {PARTNER_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {t(`admin.resources.partnerTier.${tier}`)}
              </option>
            ))}
          </select>
          {fieldErrors.partnerTier ? (
            <span style={FIELD_ERROR}>{fieldErrors.partnerTier}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.resourceType')}
          <Required />
          <input
            type="text"
            value={raw.resourceType}
            onChange={(e) => set('resourceType', e.target.value)}
            required
            style={FORM_FIELD}
          />
          {fieldErrors.resourceType ? (
            <span style={FIELD_ERROR}>{fieldErrors.resourceType}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.needPrimary')}
          <Required />
          <select
            value={raw.needPrimary}
            onChange={(e) => set('needPrimary', e.target.value)}
            required
            style={FORM_FIELD}
          >
            <option value="" disabled>
              {t('admin.resources.form.selectPlaceholder')}
            </option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
          {fieldErrors.needPrimary ? (
            <span style={FIELD_ERROR}>{fieldErrors.needPrimary}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.needSecondary')}
          <select
            value={raw.needSecondary}
            onChange={(e) => set('needSecondary', e.target.value)}
            style={FORM_FIELD}
          >
            <option value="">{t('admin.resources.form.none')}</option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
        </label>

        <label style={FIELD_ROW}>
          {t('column.subCategory')}
          <input
            type="text"
            value={raw.subCategory}
            onChange={(e) => set('subCategory', e.target.value)}
            style={FORM_FIELD}
          />
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.form.actionLabel')}
          <Required />
          <input
            type="text"
            value={raw.actionLabel}
            onChange={(e) => set('actionLabel', e.target.value)}
            required
            style={FORM_FIELD}
          />
          {fieldErrors.actionLabel ? (
            <span style={FIELD_ERROR}>{fieldErrors.actionLabel}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.externalUrl')}
          <Required />
          <input
            type="text"
            value={raw.externalUrl}
            onChange={(e) => set('externalUrl', e.target.value)}
            required
            placeholder="https://"
            style={FORM_FIELD}
          />
          {fieldErrors.externalUrl ? (
            <span style={FIELD_ERROR}>{fieldErrors.externalUrl}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.form.bannerImageUrl')}
          <input
            type="text"
            value={raw.bannerImageUrl}
            onChange={(e) => set('bannerImageUrl', e.target.value)}
            placeholder="https://"
            style={FORM_FIELD}
          />
          {fieldErrors.bannerImageUrl ? (
            <span style={FIELD_ERROR}>{fieldErrors.bannerImageUrl}</span>
          ) : null}
        </label>

        <label style={FIELD_ROW}>
          {t('column.geoScope')}
          <select
            value={raw.geoScope}
            onChange={(e) => set('geoScope', e.target.value)}
            style={FORM_FIELD}
          >
            {GEO_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(`admin.resources.geoScope.${scope}`)}
              </option>
            ))}
          </select>
        </label>

        <label style={FIELD_ROW}>
          {t('column.deadline')}
          <input
            type="date"
            value={raw.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            style={FORM_FIELD}
          />
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.col.status')}
          <select
            value={raw.status}
            onChange={(e) => set('status', e.target.value)}
            style={FORM_FIELD}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.form.exclusivity')}
          <select
            value={raw.exclusivity}
            onChange={(e) => set('exclusivity', e.target.value)}
            style={FORM_FIELD}
          >
            <option value="">{t('admin.resources.form.none')}</option>
            {EXCLUSIVITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === 'exclusive' ? t('badge.exclusive') : t('badge.earlyAccess')}
              </option>
            ))}
          </select>
        </label>

        <label style={FIELD_ROW}>
          {t('admin.resources.form.sortOrder')}
          <input
            type="number"
            min={0}
            value={raw.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            style={FORM_FIELD}
          />
          {fieldErrors.sortOrder ? (
            <span style={FIELD_ERROR}>{fieldErrors.sortOrder}</span>
          ) : null}
        </label>

        <label style={CHECK_ROW}>
          <input
            type="checkbox"
            checked={raw.isFeatured}
            onChange={(e) => set('isFeatured', e.target.checked)}
          />
          {t('admin.resources.form.featured')}
        </label>
      </div>

      <label style={FIELD_ROW}>
        {t('column.description')}
        <Required />
        <textarea
          value={raw.description}
          onChange={(e) => set('description', e.target.value)}
          required
          rows={4}
          style={FORM_FIELD}
        />
        {fieldErrors.description ? (
          <span style={FIELD_ERROR}>{fieldErrors.description}</span>
        ) : null}
      </label>

      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>{t('column.countriesEligible')}</legend>
        <div style={CHECK_GRID}>
          {COUNTRIES.map((country) => (
            <label key={country} style={CHECK_ROW}>
              <input
                type="checkbox"
                checked={raw.countriesEligible.includes(country)}
                onChange={() => set('countriesEligible', toggle(raw.countriesEligible, country))}
              />
              {country}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>{t('column.sectorsEligible')}</legend>
        <div style={CHECK_GRID}>
          {SECTORS.map((sector) => (
            <label key={sector} style={CHECK_ROW}>
              <input
                type="checkbox"
                checked={raw.sectorsEligible.includes(sector)}
                onChange={() => set('sectorsEligible', toggle(raw.sectorsEligible, sector))}
              />
              {sector}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={FIELDSET}>
        <legend style={LEGEND}>{t('column.stagesEligible')}</legend>
        <div style={CHECK_GRID}>
          {STAGES.map((stage) => (
            <label key={stage} style={CHECK_ROW}>
              <input
                type="checkbox"
                checked={raw.stagesEligible.includes(stage)}
                onChange={() => set('stagesEligible', toggle(raw.stagesEligible, stage))}
              />
              {stage}
            </label>
          ))}
        </div>
      </fieldset>

      {formError ? (
        <p role="alert" style={{ fontSize: 13, color: "#C0392B" }}>
          {formError}
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={pending}
          className="proto-primary-button" style={SUBMIT_BUTTON}
        >
          {initial ? t('admin.resources.form.submitUpdate') : t('admin.resources.form.submitCreate')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/resources')}
          style={{ fontSize: 13, color: "#5B6B8C", textDecoration: "underline" }}
        >
          {t('admin.resources.form.cancel')}
        </button>

        {initial ? (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            style={DANGER_OUTLINE}
          >
            {t('admin.resources.form.delete')}
          </button>
        ) : null}
      </div>

      {initial ? (
        <dialog ref={dialogRef} style={CONFIRM_PANEL}>
          <p style={{ fontSize: 14, fontWeight: 800 }}>{t('admin.resources.form.deleteConfirmHeading')}</p>
          <p style={{ marginTop: 6, fontSize: 13, color: "#5B6B8C" }}>{t('admin.resources.form.deleteConfirmBody')}</p>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              style={{ fontSize: 13, color: "#5B6B8C", textDecoration: "underline" }}
            >
              {t('admin.resources.form.deleteCancel')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                dialogRef.current?.close();
                handleDelete();
              }}
              style={DANGER_SOLID}
            >
              {t('admin.resources.form.deleteConfirmAction')}
            </button>
          </div>
        </dialog>
      ) : null}
    </form>
  );
}

/*
 * Transcribed from the approved prototype's resource form
 * (docs/prototype/prototype.html lines 1484-1639).
 *
 * The prototype renders this as a modal over the table; here it is a page,
 * and it stays one. The plan's rule holds -- port the appearance, not the
 * architecture -- and a page has a URL, survives a refresh, and can be linked
 * from the table's Edit action, none of which a modal does. What is taken is
 * the field treatment: a two-column grid, uppercase micro-labels, 8px-radius
 * hairline inputs at 14px.
 *
 * The label element wraps its input, which is what associates the two without
 * an id/for pair. That means the input would inherit the label's uppercase
 * micro-type, so FORM_FIELD resets weight, case and tracking explicitly rather
 * than relying on a browser default to do it.
 */

/** Label + control, prototype line 1493. */
const FIELD_ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

/** Text input and select, prototype line 1494. */
const FORM_FIELD = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #C9D3E8',
  borderRadius: 8,
  fontSize: 14,
  color: '#1A2332',
  background: '#fff',
  outline: 'none',
  // Undo the label's micro-type, which this control would otherwise inherit.
  fontWeight: 400,
  textTransform: 'none',
  letterSpacing: 'normal',
} as const;

const FIELD_ERROR = {
  fontSize: 12,
  fontWeight: 600,
  color: '#C0392B',
  textTransform: 'none',
  letterSpacing: 'normal',
} as const;

/** Prototype line 1492: the form's two-column grid. */
const FORM_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
} as const;

/** The eligibility checkbox groups. */
const FIELDSET = {
  border: '1px solid #DDE5EE',
  borderRadius: 10,
  padding: '14px 16px',
  background: '#fff',
} as const;

const LEGEND = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0 4px',
} as const;

const CHECK_GRID = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 10,
} as const;

const CHECK_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: '#1A2332',
} as const;

const SUBMIT_BUTTON = {
  background: '#1F5FBF',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '11px 22px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const DANGER_OUTLINE = {
  marginRight: 'auto',
  border: '1.5px solid #C0392B',
  color: '#C0392B',
  background: '#fff',
  borderRadius: 9,
  padding: '10px 16px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const DANGER_SOLID = {
  background: '#C0392B',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '10px 16px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const CONFIRM_PANEL = {
  border: '1px solid #DDE5EE',
  borderRadius: 12,
  padding: 20,
  background: '#fff',
} as const;
