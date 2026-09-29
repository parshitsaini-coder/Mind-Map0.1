// Strategy Tester — field-type registry + date helpers.
//
// A "field" is one selectable column type a person can add to a strategy
// via the + menu on that strategy's header (Image, Checkbox, Notes,
// Number, Buy/Sell, SL/Target, Result, RRR, P&L). Each strategy carries
// its own ordered list of fields, so two strategies can track completely
// different things side by side in the same monthly grid.

export const FIELD_TYPES = [
  { type: 'image', label: 'Image', icon: 'Image', width: 52, hint: 'Attach a chart screenshot' },
  { type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare', width: 36, hint: 'Yes/no — rule followed, setup valid…' },
  { type: 'notes', label: 'Notes', icon: 'StickyNote', width: 40, hint: 'Free text, opens in a popup' },
  { type: 'number', label: 'Number', icon: 'Hash', width: 52, hint: 'Any custom number (qty, points…)' },
  { type: 'buysell', label: 'Buy/Sell', icon: 'ArrowLeftRight', width: 56, hint: 'Trade direction' },
  { type: 'sltarget', label: 'SL / Target', icon: 'Crosshair', width: 76, hint: 'Stop-loss & target price' },
  { type: 'outcome', label: 'Result', icon: 'Trophy', width: 58, hint: 'Win / Loss / Breakeven' },
  { type: 'rrr', label: 'RRR', icon: 'Scale', width: 58, hint: 'Reward:Risk ratio' },
  { type: 'pnl', label: 'P&L', icon: 'IndianRupee', width: 66, hint: 'Profit / loss for that entry' },
  { type: 'multiselect', label: 'Multi-select', icon: 'Tags', width: 104, hint: 'Pick several tags per day (setups, mistakes…)' },
  { type: 'text', label: 'Text', icon: 'Type', width: 96, hint: 'Short one-line text' },
  { type: 'time', label: 'Time', icon: 'Clock', width: 66, hint: 'Entry / exit time' },
  { type: 'rating', label: 'Rating', icon: 'Star', width: 72, hint: '1–5 stars — setup quality, confidence…' },
  { type: 'link', label: 'Link', icon: 'Link2', width: 84, hint: 'Chart / TradingView / news URL' },
  { type: 'select', label: 'Select', icon: 'Tag', width: 84, hint: 'Your own options — create tags and pick one (like Notion)' },
]

// Header-chip gradient per field type (from → to). Used by the coloured,
// bold column labels in the table header.
export const FIELD_HEADER_COLORS = {
  image: ['#8b5cf6', '#c026d3'],
  checkbox: ['#22c55e', '#0d9488'],
  notes: ['#f59e0b', '#ea580c'],
  number: ['#3b82f6', '#1d4ed8'],
  buysell: ['#14b8a6', '#2563eb'],
  sltarget: ['#ef4444', '#f97316'],
  outcome: ['#eab308', '#16a34a'],
  rrr: ['#06b6d4', '#6366f1'],
  pnl: ['#22c55e', '#15803d'],
  multiselect: ['#ec4899', '#8b5cf6'],
  text: ['#64748b', '#334155'],
  time: ['#0ea5e9', '#6366f1'],
  rating: ['#fbbf24', '#f97316'],
  link: ['#6366f1', '#0ea5e9'],
  select: ['#ec4899', '#f43f5e'],
}
export const DATE_HEADER_COLORS = ['#f97316', '#db2777']

// Default / minimum column widths (px) for the resizable table columns.
export const DEFAULT_FIELD_WIDTHS = {
  image: 90, checkbox: 90, notes: 80, number: 110, buysell: 90, sltarget: 120, outcome: 100,
  rrr: 90, pnl: 100, multiselect: 150, text: 140, time: 90, rating: 100, link: 140, select: 120,
}
export const defaultFieldWidth = (type) => DEFAULT_FIELD_WIDTHS[type] || 100
export const MIN_COL_WIDTH = 44
export const MAX_COL_WIDTH = 900
export const DEFAULT_DATE_WIDTH = 72

export const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f]))

// Palette for Select-field option tags (cycled when creating / recolouring).
export const SELECT_COLORS = ['#6b7280', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#0d9488']

export const RRR_OPTIONS = ['1:2', '1:3', '1:5', '1:6', '1:8', '1:10', '1:10+']

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const pad2 = (n) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' — used as the row key inside a strategy's entries map.
export const dateKey = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`

export const weekdayFor = (year, month, day) => WEEKDAY_SHORT[new Date(year, month, day).getDay()]

// Does this row have any value worth counting as "filled" for progress /
// analysis purposes? An empty string, null, undefined, or an all-empty
// sl/target object don't count; a real 0 does.
export const isValueFilled = (type, value) => {
  if (value == null) return false
  if (type === 'sltarget') return (value.sl !== '' && value.sl != null) || (value.target !== '' && value.target != null)
  if (Array.isArray(value)) return value.length > 0
  if (type === 'checkbox') return Array.isArray(value) ? value.length > 0 : value === true
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

// One-time rename: the Win/Loss/BE column used to be called "Win Rate".
// Older saved data (localStorage or cloud) still carries that label, so
// it's mapped to "Result" whenever strategies are loaded. Columns the user
// renamed to something else are left alone.
export const migrateStrategies = (strategies) =>
  (strategies || []).map((st) => ({
    ...st,
    fields: (st.fields || []).map((f) => (f.type === 'outcome' && f.label === 'Win Rate' ? { ...f, label: 'Result' } : f)),
  }))

// Text styling for a Select / Multi-select / Checkbox option's label:
// option.style = { bold, italic, underline, strike, size: 'sm' | 'md' | 'lg' }
// and option.textColor (falls back to the option's own colour).
const OPTION_SIZE_PX = { sm: 8, lg: 12 }
export const optionTextStyle = (o) => {
  const s = o?.style || {}
  const deco = [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ')
  return {
    fontWeight: s.bold ? 800 : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: deco || undefined,
    fontSize: OPTION_SIZE_PX[s.size] || undefined,
    color: o?.textColor || undefined,
  }
}
