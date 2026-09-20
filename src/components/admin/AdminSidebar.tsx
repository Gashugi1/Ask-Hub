import { visibleNavItems } from '@/lib/admin/guard';
import { t } from '@/lib/i18n';
import AdminNav from './AdminNav';
import AdminFooter from './AdminFooter';
import type { Role, CurrentUser } from '@/lib/auth';

/**
 * Transcribed from the approved prototype
 * (the approved prototype): a 232px #1A2332 column that sticks for the full viewport
 * height, carrying the wordmark, the screen list, and the signed-in user at
 * its foot.
 *
 * The user block moved in here from a separate footer bar across the bottom
 * of the content area, which is where the prototype puts it. AdminFooter
 * still owns that block -- it is rendered at the end of this column rather
 * than deleted, because what it renders and why is unchanged.
 *
 * PRD 6's sidebar in the prototype's order -- Dashboard, Reach &
 * Engagement, Resources, Review Queue, Settings, Audit Log -- filtered by
 * role in `visibleNavItems`, so a viewer's column lists only the three
 * read-only screens. Whichever screens a role cannot see also `notFound()`
 * for it, so the sidebar never advertises a route the reader would be
 * refused. The prototype's subscribers, updates and partnerships screens
 * are not in this application and are not listed: a nav item leading
 * nowhere is worse than an absent one.
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
      className="admin-rail"
      style={{
        background: '#1A2332',
        color: '#fff',
        padding: '22px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AdminNav
        items={visibleNavItems(role)}
        brand={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
            {/* The prototype sets an accent bead beside the wordmark here. It
                is not transcribed, with the rest of the dot device -- see
                WelcomeBand, which holds the note for every surface that
                carried one. */}
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {t('site.wordmark')}
            </span>
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
        }
      />

      {/* The signed-in block, at the foot of the rail on a desktop. At phone
          width this copy is hidden and AdminLayout renders it again as a page
          footer under the content. */}
      <AdminFooter user={user} className="admin-rail-foot" />
    </nav>
  );
}
