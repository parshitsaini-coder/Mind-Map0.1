// Strategy Tester — field-type registry + date helpers.
//
// A "field" is one selectable column type a person can add to a strategy
// via the + menu on that strategy's header (Image, Checkbox, Notes,
// Number, Buy/Sell, SL/Target, Win Rate, RRR, P&L). Each strategy carries
// its own ordered list of fields, so two strategies can track completely
// different things side by side in the same monthly grid.

export const FIELD_TYPES = [
  { type: 'image', label: 'Image', icon: 'Image', width: 52, hint: 'Attach a chart screenshot' },
  { type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare', width: 36, hint: 'Yes/no — rule followed, setup valid…' },
  { type: 'notes', label: 'Notes', icon: 'StickyNote', width: 40, hint: 'Free text, opens in a popup' },
  { type: 'number', label: 'Number', icon: 'Hash', width: 52, hint: 'Any custom number (qty, points…)' },
  { type: 'buysell', label: 'Buy/Sell', icon: 'ArrowLeftRight', width: 56, hint: 'Trade direction' },
  { type: 'sltarget', label: 'SL / Target', icon: 'Crosshair', width: 76, hint: 'Stop-loss & target price' },
  { type: 'outcome', label: 'Win Rate', icon: 'Trophy', width: 58, hint: 'Win / Loss / Breakeven' },
  { type: 'rrr', label: 'RRR', icon: 'Scale', width: 58, hint: 'Reward:Risk ratio' },
  { type: 'pnl', label: 'P&L', icon: 'IndianRupee', width: 66, hint: 'Profit / loss for that entry' },
  { type: 'select', label: 'Select', icon: 'Tag', width: 84, hint: 'Your own options — create tags and pick one (like Notion)' },
]

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
  if (type === 'checkbox') return value === true
  if (typeof value === 'string') return value.trim() !== ''
  return true
}
