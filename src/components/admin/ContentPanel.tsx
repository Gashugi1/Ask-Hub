import type { ContentKey } from '@/lib/schemas/content';
import type { SiteContentMap } from '@/lib/admin/types';
import TextAreaField from './TextAreaField';
import { ADMIN_H2, ADMIN_PANEL_COL, ADMIN_HELP } from './chrome';

interface Field {
  key: ContentKey;
  label: string;
}

/**
 * One `site_content` panel — the Welcome band (3 fields) or the
 * Identity/About band (2 fields), PRD 6.7 panels 3 and 4.
 *
 * `canWrite` gates the form element itself, not just the button: when false,
 * every field renders as a heading and a paragraph of its current value,
 * with no `<textarea>`, no `<form>` and no Save control anywhere in the
 * markup. CLAUDE.md: a viewer sees no write affordance at all, not a
 * disabled one.
 */
export default function ContentPanel({
  heading,
  fields,
  content,
  canWrite,
}: {
  heading: string;
  fields: readonly Field[];
  content: SiteContentMap;
  canWrite: boolean;
}) {
  return (
    <section style={ADMIN_PANEL_COL}>
      <h2 style={ADMIN_H2}>{heading}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.map((field) =>
          canWrite ? (
            <TextAreaField
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              initialValue={content[field.key]}
            />
          ) : (
            <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ fontSize: 13.5, fontWeight: 800 }}>{field.label}</p>
              <p style={{ ...ADMIN_HELP, fontSize: 13, whiteSpace: "pre-wrap" }}>
                {content[field.key]}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
