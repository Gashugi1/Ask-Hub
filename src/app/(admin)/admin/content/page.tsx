import { requireRole } from '@/lib/auth';
import { canWrite } from '@/lib/admin/guard';
import {
  readSiteContent,
  readStats,
  readComputeMetrics,
  readProgrammes,
  readImpactStories,
} from '@/lib/admin/readers';
import {
  createStat,
  saveStat,
  deleteStat,
  createComputeMetric,
  saveComputeMetric,
  deleteComputeMetric,
  createProgramme,
  saveProgramme,
  deleteProgramme,
  createImpactStory,
  saveImpactStory,
  deleteImpactStory,
} from '@/lib/actions/content';
import ContentPanel from '@/components/admin/ContentPanel';
import StatRows, { type StatRow } from '@/components/admin/StatRows';
import EntityRows, { type EntityField, type EntityRow } from '@/components/admin/EntityRows';
import type { Stat, ComputeMetric, Programme, ImpactStory } from '@/lib/admin/types';
import { t } from '@/lib/i18n';

function statToRow(stat: Stat): StatRow {
  return {
    id: stat.id,
    value: stat.value,
    label: stat.label,
    sortOrder: stat.sortOrder != null ? String(stat.sortOrder) : '',
    source: stat.source,
    attestedBy: stat.attestedBy,
    attestedOn: stat.attestedOn,
    isHero: stat.isHero,
    subNote: '',
  };
}

function computeMetricToRow(metric: ComputeMetric): StatRow {
  return {
    id: metric.id,
    value: metric.value,
    label: metric.label,
    sortOrder: metric.sortOrder != null ? String(metric.sortOrder) : '',
    source: metric.source,
    attestedBy: metric.attestedBy,
    attestedOn: metric.attestedOn,
    isHero: false,
    subNote: metric.subNote ?? '',
  };
}

const PROGRAMME_FIELDS: readonly EntityField[] = [
  { key: 'title', label: t('admin.content.programme.title') },
  { key: 'timeframe', label: t('admin.content.programme.timeframe') },
  { key: 'description', label: t('admin.content.programme.description'), multiline: true },
];

function programmeToRow(programme: Programme): EntityRow {
  return {
    id: programme.id,
    title: programme.title,
    timeframe: programme.timeframe,
    description: programme.description,
    sortOrder: programme.sortOrder != null ? String(programme.sortOrder) : '',
  };
}

const IMPACT_STORY_FIELDS: readonly EntityField[] = [
  { key: 'organisation', label: t('admin.content.impactStory.organisation') },
  { key: 'country', label: t('admin.content.impactStory.country') },
  { key: 'description', label: t('admin.content.impactStory.description'), multiline: true },
];

function impactStoryToRow(story: ImpactStory): EntityRow {
  return {
    id: story.id,
    organisation: story.organisation,
    country: story.country,
    description: story.description,
    sortOrder: story.sortOrder != null ? String(story.sortOrder) : '',
  };
}

/**
 * Site Content (PRD 6.7 panels 3-8, design spec §3.1). GA4, the contact
 * mailbox and the two feature flags are deliberately absent from this
 * screen and its header: §3.1 moves them to the admin-only
 * `/admin/settings` because they write `settings`, which only `admin` may
 * write, while these six areas are editor-writable. A single role check on
 * one screen covering both would be wrong in one direction or the other.
 *
 * All three roles may view; `canWrite` (admin or editor) is threaded into
 * every panel, which is what decides whether a save control exists at all.
 */
export default async function AdminContentPage() {
  const user = await requireRole(['admin', 'editor', 'viewer']);
  const userCanWrite = canWrite(user.role);

  const [content, stats, computeMetrics, programmes, impactStories] = await Promise.all([
    readSiteContent(),
    readStats(),
    readComputeMetrics(),
    readProgrammes(),
    readImpactStories(),
  ]);

  return (
    <main data-route="/admin/content" className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">{t('admin.content.heading')}</h1>
        <p className="text-sm text-muted">{t('admin.content.intro')}</p>
      </div>

      <ContentPanel
        heading={t('admin.content.section.welcome')}
        canWrite={userCanWrite}
        content={content}
        fields={[
          { key: 'welcome_title', label: t('admin.content.field.welcomeTitle') },
          { key: 'welcome_body', label: t('admin.content.field.welcomeBody') },
          { key: 'welcome_cta', label: t('admin.content.field.welcomeCta') },
        ]}
      />

      <ContentPanel
        heading={t('admin.content.section.identity')}
        canWrite={userCanWrite}
        content={content}
        fields={[
          { key: 'identity_lead', label: t('admin.content.field.identityLead') },
          { key: 'identity_align', label: t('admin.content.field.identityAlign') },
        ]}
      />

      <section className="flex flex-col gap-3 rounded border border-hairline p-4">
        <h2 className="text-base font-semibold text-navy">
          {t('admin.content.section.headlineStats')}
        </h2>
        <StatRows
          kind="headline"
          canWrite={userCanWrite}
          rows={stats.map(statToRow)}
          actions={{ create: createStat, save: saveStat, delete: deleteStat }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded border border-hairline p-4">
        <h2 className="text-base font-semibold text-navy">
          {t('admin.content.section.computeMetrics')}
        </h2>
        <StatRows
          kind="compute"
          canWrite={userCanWrite}
          rows={computeMetrics.map(computeMetricToRow)}
          actions={{
            create: createComputeMetric,
            save: saveComputeMetric,
            delete: deleteComputeMetric,
          }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded border border-hairline p-4">
        <h2 className="text-base font-semibold text-navy">{t('admin.content.section.programmes')}</h2>
        <EntityRows
          fields={PROGRAMME_FIELDS}
          canWrite={userCanWrite}
          rows={programmes.map(programmeToRow)}
          actions={{ create: createProgramme, save: saveProgramme, delete: deleteProgramme }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded border border-hairline p-4">
        <h2 className="text-base font-semibold text-navy">
          {t('admin.content.section.impactStories')}
        </h2>
        <EntityRows
          fields={IMPACT_STORY_FIELDS}
          canWrite={userCanWrite}
          rows={impactStories.map(impactStoryToRow)}
          actions={{
            create: createImpactStory,
            save: saveImpactStory,
            delete: deleteImpactStory,
          }}
        />
      </section>
    </main>
  );
}
