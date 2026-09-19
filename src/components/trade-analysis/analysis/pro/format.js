// Trade Analysis — Analysis tab tokens and formatters.
//
// Kept apart from ui.jsx so that file exports only components: mixing
// constants and components in one module breaks React Fast Refresh, and
// every widget in this folder imports from here anyway.

export const EASE = [0.16, 1, 0.3, 1]
export const SPRING = { type: 'spring', stiffness: 380, damping: 30 }

export const POS = '#16a34a'
export const NEG = '#dc2626'
export const NEUTRAL = 'var(--ta-slate)'

/** Green for profit, red for loss, neutral for zero/unknown. */
export const signColor = (v) => (v == null || v === 0 ? NEUTRAL : v > 0 ? POS : NEG)

// ---------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------

export function fmtMoney(v, symbol = '', { signed = false, compact = false } = {}) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const n = Number(v)
  const abs = Math.abs(n)
  let body
  if (compact && abs >= 1000) {
    body = abs >= 10000000
      ? `${(abs / 10000000).toFixed(2)}Cr`
      : abs >= 100000
        ? `${(abs / 100000).toFixed(2)}L`
        : `${(abs / 1000).toFixed(1)}k`
  } else {
    body = Math.round(abs).toLocaleString('en-IN')
  }
  const sign = n < 0 ? '-' : signed && n > 0 ? '+' : ''
  return `${sign}${symbol}${body}`
}

export function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return `${Number(v).toFixed(digits)}%`
}

export function fmtNum(v, digits = 2) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

export function fmtDate(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' })
}

