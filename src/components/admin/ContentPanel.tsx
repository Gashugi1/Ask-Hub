import type { ContentKey } from '@/lib/schemas/content';
import type { SiteContentMap } from '@/lib/admin/types';
import TextAreaField from './TextAreaField';

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
    <section className="flex flex-col gap-3 rounded border border-hairline p-4">
      <h2 className="text-base font-semibold text-navy">{heading}</h2>
      <div className="flex flex-col gap-4">
        {fields.map((field) =>
          canWrite ? (
            <TextAreaField
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              initialValue={content[field.key]}
            />
          ) : (
            <div key={field.key} className="flex flex-col gap-1">
              <p className="text-sm font-medium text-navy">{field.label}</p>
              <p className="whitespace-pre-wrap text-sm text-muted">
                {content[field.key]}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
