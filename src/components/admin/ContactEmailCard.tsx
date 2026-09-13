'use client';

import { useState } from 'react';
import { saveSetting } from '@/lib/actions/settings';
import { settingUpdate, CONTACT_EMAIL } from '@/lib/schemas/settings';
import { t } from '@/lib/i18n';
import { ADMIN_PANEL, ADMIN_CARD_TITLE, ADMIN_CARD_SUB, ADMIN_FIELD } from './chrome';
import { useFieldCommit } from './useFieldCommit';
import SaveStatus from './SaveStatus';

/**
 * The prototype's Contact email card, with one difference it cannot show: the
 * address is pinned. CLAUDE.md allows one mailbox, and `settingUpdate`
 * accepts that literal and nothing else, so an edit to any other address is
 * refused on blur, the field is put back to the pinned value, and the note
 * says why. The card still exists because the prototype has it and because
 * the stored row can be blank (a fresh database); committing the pinned
 * address is how it gets set.
 */
export default function ContactEmailCard({ contactEmail }: { contactEmail: string }) {
  const [saved, setSaved] = useState(contactEmail);
  const [value, setValue] = useState(contactEmail === '' ? CONTACT_EMAIL : contactEmail);
  const { status, pending, commit, fail } = useFieldCommit();

  function commitValue() {
    const next = value.trim();
    if (next === saved) return;
    const parsed = settingUpdate.safeParse({ key: 'contact_email', value: next });
    if (!parsed.success) {
      setValue(saved === '' ? CONTACT_EMAIL : saved);
      fail(t('admin.settings.contact.note'));
      return;
    }
    commit(async () => {
      await saveSetting(parsed.data);
      setSaved(next);
    });
  }

  return (
    <section style={ADMIN_PANEL} aria-labelledby="settings-contact">
      <h2 id="settings-contact" style={ADMIN_CARD_TITLE}>
        {t('admin.settings.contact.heading')}
      </h2>
      <div style={ADMIN_CARD_SUB}>{t('admin.settings.contact.sub')}</div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="email"
          aria-label={t('admin.settings.contact.heading')}
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
          style={{ ...ADMIN_FIELD, width: 340, maxWidth: '100%', padding: '10px 14px', fontWeight: 700 }}
        />
        <SaveStatus status={status} />
      </div>
    </section>
  );
}
