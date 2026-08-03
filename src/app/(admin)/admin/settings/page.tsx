import { requirePageRole } from '@/lib/admin/guard';
import { readSettings } from '@/lib/admin/readers';
import SettingsForm from '@/components/admin/SettingsForm';
import { t } from '@/lib/i18n';

/**
 * Admin-only (PRD §3's capability table: Settings is one row above Site
 * Content, which editor may write; Settings, only admin may). `requirePageRole`
 * calls `notFound()` for an editor or viewer rather than redirecting with a
 * message — whether this route exists is not information a non-admin needs.
 *
 * Not the security boundary: `saveSetting` re-checks `requireRole(['admin'])`
 * itself, and `settings_write_admin` (supabase/migrations/0006_site.sql)
 * refuses the write at the database regardless of what this page or that
 * action do.
 */
export default async function AdminSettingsPage() {
  await requirePageRole(['admin']);
  const settings = await readSettings();

  return (
    <main data-route="/admin/settings" className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">{t('admin.settings.heading')}</h1>
        <p className="text-sm text-muted">{t('admin.settings.intro')}</p>
      </div>
      <SettingsForm settings={settings} />
    </main>
  );
}
