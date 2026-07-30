'use client';

import { useState, useTransition, useRef } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resourceInput, type ResourceInput } from '@/lib/schemas/resource';
import { createResource, updateResource, deleteResource } from '@/lib/actions/resources';
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
    <span aria-hidden="true" className="text-danger">
      {' *'}
    </span>
  );
}

export default function ResourceForm({ initial }: { initial?: ResourceInput & { id: string } }) {
  const [raw, setRaw] = useState<RawValues>(() => toRaw(initial));
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

    setFieldErrors({});
    startTransition(async () => {
      try {
        if (initial) {
          await updateResource(initial.id, parsed.data);
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
        await deleteResource(initial.id);
        router.push('/admin/resources');
        router.refresh();
      } catch {
        setFormError(t('admin.error.generic'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.name')}
          <Required />
          <input
            type="text"
            value={raw.name}
            onChange={(e) => set('name', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.name ? <span className="text-xs text-danger">{fieldErrors.name}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.partnerName')}
          <Required />
          <input
            type="text"
            value={raw.partner}
            onChange={(e) => set('partner', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.partner ? (
            <span className="text-xs text-danger">{fieldErrors.partner}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.form.partnerTier')}
          <Required />
          <select
            value={raw.partnerTier}
            onChange={(e) => set('partnerTier', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
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
            <span className="text-xs text-danger">{fieldErrors.partnerTier}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.resourceType')}
          <Required />
          <input
            type="text"
            value={raw.resourceType}
            onChange={(e) => set('resourceType', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.resourceType ? (
            <span className="text-xs text-danger">{fieldErrors.resourceType}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.needPrimary')}
          <Required />
          <select
            value={raw.needPrimary}
            onChange={(e) => set('needPrimary', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
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
            <span className="text-xs text-danger">{fieldErrors.needPrimary}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.needSecondary')}
          <select
            value={raw.needSecondary}
            onChange={(e) => set('needSecondary', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          >
            <option value="">{t('admin.resources.form.none')}</option>
            {NEED_KEYS.map((need) => (
              <option key={need} value={need}>
                {t(`need.${need}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.subCategory')}
          <input
            type="text"
            value={raw.subCategory}
            onChange={(e) => set('subCategory', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.form.actionLabel')}
          <Required />
          <input
            type="text"
            value={raw.actionLabel}
            onChange={(e) => set('actionLabel', e.target.value)}
            required
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.actionLabel ? (
            <span className="text-xs text-danger">{fieldErrors.actionLabel}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.externalUrl')}
          <Required />
          <input
            type="text"
            value={raw.externalUrl}
            onChange={(e) => set('externalUrl', e.target.value)}
            required
            placeholder="https://"
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.externalUrl ? (
            <span className="text-xs text-danger">{fieldErrors.externalUrl}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.form.bannerImageUrl')}
          <input
            type="text"
            value={raw.bannerImageUrl}
            onChange={(e) => set('bannerImageUrl', e.target.value)}
            placeholder="https://"
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.bannerImageUrl ? (
            <span className="text-xs text-danger">{fieldErrors.bannerImageUrl}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.geoScope')}
          <select
            value={raw.geoScope}
            onChange={(e) => set('geoScope', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          >
            {GEO_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(`admin.resources.geoScope.${scope}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('column.deadline')}
          <input
            type="date"
            value={raw.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.col.status')}
          <select
            value={raw.status}
            onChange={(e) => set('status', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.form.exclusivity')}
          <select
            value={raw.exclusivity}
            onChange={(e) => set('exclusivity', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          >
            <option value="">{t('admin.resources.form.none')}</option>
            {EXCLUSIVITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === 'exclusive' ? t('badge.exclusive') : t('badge.earlyAccess')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-navy">
          {t('admin.resources.form.sortOrder')}
          <input
            type="number"
            min={0}
            value={raw.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            className="rounded border border-hairline px-2 py-1"
          />
          {fieldErrors.sortOrder ? (
            <span className="text-xs text-danger">{fieldErrors.sortOrder}</span>
          ) : null}
        </label>

        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={raw.isFeatured}
            onChange={(e) => set('isFeatured', e.target.checked)}
          />
          {t('admin.resources.form.featured')}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-navy">
        {t('column.description')}
        <Required />
        <textarea
          value={raw.description}
          onChange={(e) => set('description', e.target.value)}
          required
          rows={4}
          className="rounded border border-hairline px-2 py-1"
        />
        {fieldErrors.description ? (
          <span className="text-xs text-danger">{fieldErrors.description}</span>
        ) : null}
      </label>

      <fieldset className="rounded border border-hairline p-3">
        <legend className="px-1 text-sm text-muted">{t('column.countriesEligible')}</legend>
        <div className="flex flex-wrap gap-3">
          {COUNTRIES.map((country) => (
            <label key={country} className="flex items-center gap-1 text-sm text-navy">
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

      <fieldset className="rounded border border-hairline p-3">
        <legend className="px-1 text-sm text-muted">{t('column.sectorsEligible')}</legend>
        <div className="flex flex-wrap gap-3">
          {SECTORS.map((sector) => (
            <label key={sector} className="flex items-center gap-1 text-sm text-navy">
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

      <fieldset className="rounded border border-hairline p-3">
        <legend className="px-1 text-sm text-muted">{t('column.stagesEligible')}</legend>
        <div className="flex flex-wrap gap-3">
          {STAGES.map((stage) => (
            <label key={stage} className="flex items-center gap-1 text-sm text-navy">
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
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-2 text-sm text-surface"
        >
          {initial ? t('admin.resources.form.submitUpdate') : t('admin.resources.form.submitCreate')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/resources')}
          className="text-sm text-muted underline"
        >
          {t('admin.resources.form.cancel')}
        </button>

        {initial ? (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="ml-auto rounded border border-danger px-3 py-1.5 text-sm text-danger"
          >
            {t('admin.resources.form.delete')}
          </button>
        ) : null}
      </div>

      {initial ? (
        <dialog ref={dialogRef} className="rounded border border-hairline p-4">
          <p className="font-medium text-navy">{t('admin.resources.form.deleteConfirmHeading')}</p>
          <p className="mt-1 text-sm text-muted">{t('admin.resources.form.deleteConfirmBody')}</p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm text-muted underline"
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
              className="rounded bg-danger px-3 py-1.5 text-sm text-surface"
            >
              {t('admin.resources.form.deleteConfirmAction')}
            </button>
          </div>
        </dialog>
      ) : null}
    </form>
  );
}
