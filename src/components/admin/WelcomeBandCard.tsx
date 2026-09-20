'use client';

import { useState } from 'react';
import { saveContentEntry } from '@/lib/actions/content';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_CARD_TITLE, ADMIN_FIELD } from './chrome';
import { useFieldCommit } from './useFieldCommit';
import SaveStatus from './SaveStatus';

/**
 * One `site_content` field that writes itself on blur. Both the title input
 * and the body textarea are this, differing only in the element rendered.
 * Enter commits the single-line title; in the textarea it is a newline, as
 * it should be, and blur is the commit.
 */
function ContentField({
  contentKey,
  initialValue,
  multiline,
}: {
  contentKey: 'welcome_title' | 'welcome_body';
  initialValue: string;
  multiline: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const { status, pending, commit } = useFieldCommit();

  function commitValue() {
    const next = value.trim();
    if (next === saved) return;
    commit(async () => {
      await saveContentEntry({ key: contentKey, value: next });
      setSaved(next);
    });
  }

  const label = t(
    contentKey === 'welcome_title' ? 'admin.settings.welcome.title' : 'admin.settings.welcome.body',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          rows={3}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitValue}
          style={{ ...ADMIN_FIELD, padding: '10px 14px', lineHeight: 1.55, resize: 'vertical' }}
        />
      ) : (
        <input
          type="text"
          aria-label={label}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue();
            }
          }}
          style={{ ...ADMIN_FIELD, padding: '10px 14px', fontWeight: 800 }}
        />
      )}
      <SaveStatus status={status} />
    </div>
  );
}

/**
 * The prototype's Welcome band card: the home page's title and body, and
 * only those two. The tagline and call-to-action keys `CONTENT_KEYS` also
 * holds are not on the prototype's card and have no field here; they keep
 * their seeded values until someone changes them by SQL, which
 * docs/deployment.md records.
 *
 * Reachable by an editor as well as an admin -- it writes `site_content`,
 * which `site_content_write_editor` allows -- and it is the one card an
 * editor's Settings shows.
 */
export default function WelcomeBandCard({ title, body }: { title: string; body: string }) {
  return (
    <section style={ADMIN_PANEL} aria-labelledby="settings-welcome">
      <h2 id="settings-welcome" style={ADMIN_CARD_TITLE}>
        {t('admin.settings.welcome.heading')}
      </h2>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ContentField contentKey="welcome_title" initialValue={title} multiline={false} />
        <ContentField contentKey="welcome_body" initialValue={body} multiline />
      </div>
    </section>
  );
}
