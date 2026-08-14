/**
 * Shared admin-screen chrome, transcribed from the approved prototype
 * (docs/prototype/prototype.html).
 *
 * Unlike the public pages -- whose titles run 30, 34, 36 and 40px depending on
 * the page -- every admin screen in the prototype uses one title size, one
 * subtitle and one panel. That makes it a real scale rather than a set of
 * one-offs, so it is stated once here and imported by the nine screens instead
 * of transcribed nine times, where the ninth would eventually disagree with
 * the first.
 */

/** Admin page title, reference line 694: 24px/800 at -0.01em. */
export const ADMIN_H1 = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: '-0.01em',
} as const;

/** The line beneath an admin title, reference line 695. */
export const ADMIN_SUB = {
  fontSize: 13,
  color: '#5B6B8C',
  marginTop: 4,
} as const;

/** Section heading within an admin screen, reference line 914: 18px/800. */
export const ADMIN_H2 = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.01em',
} as const;

/** The white panel every admin screen groups content into, reference line 697. */
export const ADMIN_PANEL = {
  background: '#fff',
  border: '1px solid #DDE5EE',
  borderRadius: 13,
  padding: 22,
} as const;

/** Uppercase micro-label above a control, reference line 1698. */
export const ADMIN_LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
} as const;

/** Text input / select, reference line 1247. */
export const ADMIN_FIELD = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #C9D3E8',
  borderRadius: 8,
  fontSize: 13.5,
  color: '#1A2332',
  background: '#fff',
  outline: 'none',
} as const;

/** Solid primary action, reference line 1263. */
export const ADMIN_PRIMARY = {
  background: '#1F5FBF',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

/** Outlined secondary action, reference line 183. */
export const ADMIN_SECONDARY = {
  border: '1.5px solid #C9D3E8',
  color: '#1F5FBF',
  background: '#fff',
  borderRadius: 9,
  padding: '10px 16px',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

/** Table header cell, reference line 1267. */
export const ADMIN_TH = {
  textAlign: 'left',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0 0 10px 0',
} as const;

/** Table body cell, reference line 1276. */
export const ADMIN_TD = {
  fontSize: 13,
  padding: '11px 0',
  borderTop: '1px solid #F1F4FA',
  verticalAlign: 'top',
} as const;
