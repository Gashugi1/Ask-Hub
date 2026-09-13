import { requirePageRole, canAdminister } from '@/lib/admin/guard';
import { readSettings, readSiteContent, readUsers } from '@/lib/admin/readers';
import { CONTACT_EMAIL } from '@/lib/schemas/settings';
import AnalyticsCard from '@/components/admin/AnalyticsCard';
import TeamAccessCard from '@/components/admin/TeamAccessCard';
import ContactEmailCard from '@/components/admin/ContactEmailCard';
import WelcomeBandCard from '@/components/admin/WelcomeBandCard';
import { ADMIN_H1, ADMIN_SUB } from '@/components/admin/chrome';
import { t } from '@/lib/i18n';

/**
 * Settings, as the approved prototype lays it out: four cards, in its order
 * -- Analytics, Team access, Contact email, Welcome band -- and nothing
 * else. Every field saves when the operator leaves it; there are no Save
 * buttons.
 *
 * Two roles reach the screen, and they see different subsets rather than
 * the same cards with some disabled. The first three cards write `settings`
 * and `profiles`, which only an admin may write, so they exist only in an
 * admin's render. The Welcome band writes `site_content`, which an editor
 * may write, so it is the one card an editor sees. A viewer gets
 * `notFound()`, matching a sidebar that does not list the screen.
 *
 * Not the security boundary. `saveSetting`, `changeUserRole`,
 * `setUserActive`, `inviteUser` and `saveContentEntry` each re-check the
 * caller's role as their first statement, and the RLS policies on the three
 * tables refuse the write regardless of what this page renders.
 *
 * The user list is read only for an admin: an editor's page has no card to
 * put it in, and `profiles` should not be read for a render that will not
 * show it.
 */
export default async function AdminSettingsPage() {
  const actor = await requirePageRole(['admin', 'editor']);
  const isAdmin = canAdminister(actor.role);

  const [settings, content, users] = await Promise.all([
    readSettings(),
    readSiteContent(),
    isAdmin ? readUsers() : Promise.resolve(null),
  ]);

  const measurementId =
    typeof settings.ga4_measurement_id === 'string' ? settings.ga4_measurement_id : '';
  const contactEmail =
    typeof settings.contact_email === 'string' ? settings.contact_email : CONTACT_EMAIL;

  return (
    <main data-route="/admin/settings">
      <h1 style={ADMIN_H1}>{t('admin.settings.heading')}</h1>
      <div style={ADMIN_SUB}>{t('admin.settings.intro')}</div>

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isAdmin ? <AnalyticsCard measurementId={measurementId} /> : null}
        {users ? <TeamAccessCard rows={users} currentProfileId={actor.profileId} /> : null}
        {isAdmin ? <ContactEmailCard contactEmail={contactEmail} /> : null}
        <WelcomeBandCard title={content.welcome_title} body={content.welcome_body} />
      </div>
    </main>
  );
}
