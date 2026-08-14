/**
 * The honest alternative to a placeholder figure. Takes copy, never a number
 * — an empty state that renders "0" in a stat card is a fabricated value with
 * extra steps unless that zero was actually counted.
 */
export default function EmptyState({ heading, body }: { heading: string; body?: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #DDE5EE',
        borderRadius: 13,
        padding: 22,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{heading}</p>
      {body ? (
        <p style={{ margin: '8px 0 0 0', fontSize: 13, lineHeight: 1.55, color: '#5B6B8C' }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}
