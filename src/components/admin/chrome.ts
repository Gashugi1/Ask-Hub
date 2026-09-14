/**
 * Shared admin-screen chrome, transcribed from the approved prototype
 * (the approved prototype).
 *
 * Unlike the public pages -- whose titles run 30, 34, 36 and 40px depending on
 * the page -- every admin screen in the prototype uses one title size, one
 * subtitle and one panel. That makes it a real scale rather than a set of
 * one-offs, so it is stated once here and imported by the nine screens instead
 * of transcribed nine times, where the ninth would eventually disagree with
 * the first.
 */

/** Admin page title: 24px/800 at -0.01em. */
export const ADMIN_H1 = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: '-0.01em',
} as const;

/** The line beneath an admin title. */
export const ADMIN_SUB = {
  fontSize: 13,
  color: '#5B6B8C',
  marginTop: 4,
} as const;

/** Section heading within an admin screen: 18px/800. */
export const ADMIN_H2 = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '-0.01em',
} as const;

/** The white panel every admin screen groups content into. */
export const ADMIN_PANEL = {
  background: '#fff',
  border: '1px solid #DDE5EE',
  borderRadius: 13,
  padding: 22,
} as const;

/** Uppercase micro-label above a control. */
export const ADMIN_LABEL = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
} as const;

/** Text input / select. */
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

/** Solid primary action. */
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

/** Outlined secondary action. */
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

/** Table header cell. */
export const ADMIN_TH = {
  textAlign: 'left',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0 0 10px 0',
} as const;

/** Table body cell. */
export const ADMIN_TD = {
  fontSize: 13,
  padding: '12px 20px',
  verticalAlign: 'top',
} as const;

/** The table itself, inside ADMIN_TABLE_PANEL. */
export const ADMIN_TABLE = {
  width: '100%',
  minWidth: 720,
  borderCollapse: 'collapse',
  textAlign: 'left',
} as const;

/** The 13px-radius white panel a table sits in. */
export const ADMIN_TABLE_PANEL = {
  marginTop: 16,
  background: '#fff',
  border: '1px solid #DDE5EE',
  borderRadius: 13,
  overflowX: 'auto',
} as const;

/** The #F4F6F9 strip behind a table's column labels. */
export const ADMIN_THEAD_ROW = {
  background: '#F4F6F9',
  borderBottom: '1px solid #DDE5EE',
} as const;

/** A body row's hairline rule. */
export const ADMIN_TR = {
  borderBottom: '1px solid #F1F4FA',
} as const;

/**
 * A label stacked over its control. The control inherits this micro-type, so
 * ADMIN_FIELD resets weight, case and tracking rather than trusting a browser
 * default to undo them.
 */
export const ADMIN_FIELD_ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11.5,
  fontWeight: 800,
  color: '#5B6B8C',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
} as const;

/** Field-level error text. */
export const ADMIN_ERROR = {
  fontSize: 12,
  fontWeight: 600,
  color: '#C0392B',
  textTransform: 'none',
  letterSpacing: 'normal',
} as const;

/** Muted helper text under a control. */
export const ADMIN_HELP = {
  fontSize: 12,
  color: '#5B6B8C',
  fontWeight: 400,
  textTransform: 'none',
  letterSpacing: 'normal',
  lineHeight: 1.5,
} as const;

/** A settings/content section: the panel, stacked. */
export const ADMIN_PANEL_COL = {
  background: '#fff',
  border: '1px solid #DDE5EE',
  borderRadius: 13,
  padding: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
} as const;

/** A small inline action. */
export const ADMIN_LINK_ACTION = {
  background: 'none',
  border: 'none',
  color: '#1F5FBF',
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0,
} as const;

/** The destructive twin of ADMIN_LINK_ACTION. */
export const ADMIN_LINK_DANGER = {
  ...ADMIN_LINK_ACTION,
  color: '#C0392B',
} as const;

/** A settings card's title, the prototype's Settings screen: 14px/800. */
export const ADMIN_CARD_TITLE = {
  margin: 0,
  fontSize: 14,
  fontWeight: 800,
} as const;

/** The line beneath a settings card's title. */
export const ADMIN_CARD_SUB = {
  fontSize: 12,
  color: '#5B6B8C',
  marginTop: 3,
} as const;
