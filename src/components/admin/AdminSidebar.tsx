import { visibleNavItems } from '@/lib/admin/guard';
import { t } from '@/lib/i18n';
import AdminNavList from './AdminNavList';
import AdminFooter from './AdminFooter';
import type { Role, CurrentUser } from '@/lib/auth';

/**
 * Transcribed from the approved prototype, docs/prototype/prototype.html
 * lines 669-687: a 232px #1A2332 column that sticks for the full viewport
 * height, carrying the wordmark, the screen list, and the signed-in user at
 * its foot.
 *
 * The user block moved in here from a separate footer bar across the bottom
 * of the content area, which is where the prototype puts it. AdminFooter
 * still owns that block -- it is rendered at the end of this column rather
 * than deleted, because what it renders and why is unchanged.
 *
 * PRD 6's sidebar, reduced to the launch screens (spec 1) and filtered by
 * role. Settings and Users are absent for non-admins, matching the routes,
 * which return notFound() for them. The prototype lists several screens this
 * application does not have -- review queue, reach, subscribers, updates,
 * partnerships -- and they are not added here: a nav item leading nowhere is
 * worse than an absent one.
 */
export default function AdminSidebar({
  role,
  user,
}: {
  role: Role;
  user: CurrentUser;
}) {
  return (
    <nav
      style={{
        background: '#1A2332',
        color: '#fff',
        padding: '22px 16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {t('site.wordmark')}
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            background: 'var(--acc, #F06428)',
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: '#A9B8E0',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginLeft: 2,
          }}
        >
          {t('admin.nav.label')}
        </span>
      </div>

      <AdminNavList items={visibleNavItems(role)} />

      <AdminFooter user={user} />
    </nav>
  );
}
