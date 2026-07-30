/**
 * The honest alternative to a placeholder figure. Takes copy, never a number
 * — an empty state that renders "0" in a stat card is a fabricated value with
 * extra steps unless that zero was actually counted.
 */
export default function EmptyState({ heading, body }: { heading: string; body?: string }) {
  return (
    <div className="rounded border border-hairline bg-tint-1 p-6">
      <p className="font-medium text-navy">{heading}</p>
      {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
    </div>
  );
}
