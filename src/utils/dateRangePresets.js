// YYYY-MM-DD in local time (matches the `date` field trades already store,
// which comes from a native <input type="date">).
export function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - (n - 1)) // inclusive of today
  return isoDate(d)
}

// Quick date-range presets shown as pills above the custom from/to inputs.
// `days: null` means "All time" (no date filtering at all).
export const DATE_RANGE_PRESETS = [
  { id: 'all', label: 'All time', days: null },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '15d', label: 'Last 15 days', days: 15 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: 'custom', label: 'Custom range', days: undefined },
]
