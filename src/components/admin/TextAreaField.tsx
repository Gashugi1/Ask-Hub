'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveContentEntry } from '@/lib/actions/content';
import type { ContentKey } from '@/lib/schemas/content';
import { t } from '@/lib/i18n';
import { ADMIN_FIELD_ROW, ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_ERROR } from './chrome';

/**
 * One `site_content` field: a label, a textarea and its own Save button.
 * Rendered only when the caller already knows `canWrite` is true
 * (see ContentPanel) — there is no disabled variant, per CLAUDE.md: a
 * viewer must see no write affordance at all, not a greyed-out one.
 */
export default function TextAreaField({
  fieldKey,
  label,
  initialValue,
}: {
  fieldKey: ContentKey;
  label: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveContentEntry({ key: fieldKey, value });
        router.refresh();
      } catch {
        setError(t('admin.error.generic'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={ADMIN_FIELD_ROW} htmlFor={`content-${fieldKey}`}>
        {label}
        <textarea
          id={`content-${fieldKey}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={label.length > 40 ? 4 : 2}
          style={ADMIN_FIELD}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="submit"
          disabled={pending}
          className="proto-primary-button" style={{ ...ADMIN_PRIMARY, alignSelf: "flex-start" }}
        >
          {t('admin.content.save')}
        </button>
        {error ? <span style={ADMIN_ERROR}>{error}</span> : null}
      </div>
    </form>
  );
}
