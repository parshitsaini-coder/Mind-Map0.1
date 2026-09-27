// Strategy Tester — shared field-type config + month/date helpers.
//
// A "field" is one trackable data point a person can attach to a date row
// (Image, Checkbox, Notes, ...). Which fields are active is stored per ROW
// (see strategyTesterStore.js) — every strategy column then renders its own
// independent value for each active field on that row, which is what lets
// one date be compared apples-to-apples across every strategy.

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const RRR_OPTIONS = ['1:2', '1:3', '1:5', '1:6', '1:8', '1:10+']

// `kind` drives which mini control CellFieldControl renders.
export const FIELD_TYPES = [
  { id: 'image', label: 'Image', icon: 'Image', kind: 'image' },
  { id: 'checkbox', label: 'Checkbox', icon: 'SquareCheck', kind: 'checkbox' },
  { id: 'notes', label: 'Notes', icon: 'StickyNote', kind: 'notes' },
  { id: 'number', label: 'Number', icon: 'Hash', kind: 'number' },
  { id: 'side', label: 'Buy / Sell', icon: 'ArrowUpDown', kind: 'side' },
  { id: 'slTarget', label: 'SL / Target', icon: 'Crosshair', kind: 'slTarget' },
  { id: 'winrate', label: 'Winrate %', icon: 'Percent', kind: 'winrate' },
  { id: 'rrr', label: 'RRR', icon: 'Scale', kind: 'rrr' },
  { id: 'pnl', label: 'P&L', icon: 'Wallet', kind: 'pnl' },
]

export const FIELD_BY_ID = Object.fromEntries(FIELD_TYPES.map((f) => [f.id, f]))

export function monthKeyFor(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m - 1 }
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function shiftMonthKey(key, delta) {
  const { year, month } = parseMonthKey(key)
  const d = new Date(year, month + delta, 1)
  return monthKeyFor(d.getFullYear(), d.getMonth())
}

// RRR string ("1:3", "1:10+") -> numeric R-multiple, for averaging in analysis.
export function rrrToNumber(rrr) {
  if (!rrr) return null
  const clean = String(rrr).replace('+', '')
  const parts = clean.split(':')
  const n = Number(parts[1])
  return Number.isFinite(n) ? n : null
}

// Has anything at all been entered for this field's value?
export function isFieldFilled(kind, value) {
  if (value == null) return false
  switch (kind) {
    case 'checkbox':
      return value === true
    case 'notes':
      return typeof value === 'string' && value.trim().length > 0
    case 'image':
      return typeof value === 'string' && value.length > 0
    case 'slTarget':
      return value.sl != null && value.sl !== '' || value.target != null && value.target !== ''
    case 'side':
      return value === 'buy' || value === 'sell'
    case 'rrr':
      return RRR_OPTIONS.includes(value)
    case 'number':
    case 'winrate':
    case 'pnl':
      return value !== '' && Number.isFinite(Number(value))
    default:
      return Boolean(value)
  }
}
