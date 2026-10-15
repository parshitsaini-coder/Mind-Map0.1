export const UP_TXT = '#4ade80'
export const DOWN_TXT = '#f87171'
export const fmtPrice = (n, d) => (Number.isFinite(n) ? n.toFixed(d) : '—')
export function fmtMoney(n, { sign = false } = {}) {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 100) / 100
  const s = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${r < 0 ? '−' : sign && r > 0 ? '+' : ''}$${s}`
}
export const pnlColor = (n) => (n > 0 ? UP_TXT : n < 0 ? DOWN_TXT : 'var(--tm-text)')
export const fmtTime = (sec) =>
  new Date(sec * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
