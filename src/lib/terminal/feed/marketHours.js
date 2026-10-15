// Real market hours (Phase 14). Forex / metals follow New York time (week opens Sunday 17:00 NY, closes Friday 17:00 NY, so DST is
// handled by Intl), metals also pause 17:00-18:00 NY Monday-Thursday, crypto is always open, Indian indices trade 09:15-15:30 IST
// Monday-Friday. Holidays are injected ('YYYY-MM-DD' in the exchange's time zone): the NSE list is NOT bundled because it was not
// verified against the exchange's own calendar.
const fmtCache = {}
function parts(tz, ms) {
  const f = (fmtCache[tz] ||= new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))
  const o = {}
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value
  return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), min: Number(o.hour) * 60 + Number(o.minute), date: `${o.year}-${o.month}-${o.day}` }
}

export const KIND_OF = { XAUUSD: 'metal', EURUSD: 'forex', GBPUSD: 'forex', USDJPY: 'forex', GBPJPY: 'forex', BTCUSD: 'crypto', ETHUSD: 'crypto', NIFTY50: 'india-index' }
export const kindOf = (symbol) => KIND_OF[symbol] || 'forex'

export function isOpenAt(kind, ms, holidays = []) {
  if (kind === 'crypto') return true
  if (kind === 'india-index') {
    const p = parts('Asia/Kolkata', ms)
    return p.dow >= 1 && p.dow <= 5 && !holidays.includes(p.date) && p.min >= 9 * 60 + 15 && p.min < 15 * 60 + 30
  }
  const p = parts('America/New_York', ms)
  const m = p.min
  if (p.dow === 6) return false
  if (p.dow === 5 && m >= 17 * 60) return false
  if (p.dow === 0 && m < 17 * 60) return false
  if (kind === 'metal' && p.dow >= 1 && p.dow <= 4 && m >= 17 * 60 && m < 18 * 60) return false // daily break
  return true
}

// { open, nextChangeMs }: when the state flips next (null for 24/7). Coarse 15-minute scan, then minute-exact refine.
export function marketStatus(symbol, nowMs, holidays = []) {
  const kind = kindOf(symbol)
  const open = isOpenAt(kind, nowMs, holidays)
  if (kind === 'crypto') return { open, kind, nextChangeMs: null }
  const STEP = 15 * 60000
  let t = Math.floor(nowMs / 60000) * 60000
  for (let i = 0; i < 12 * 24 * 4; i++) { // up to 12 days
    const nt = t + STEP
    if (isOpenAt(kind, nt, holidays) !== open) {
      let lo = t, hi = nt
      while (hi - lo > 60000) { const mid = Math.floor((lo + hi) / 120000) * 60000; if (isOpenAt(kind, mid, holidays) === open) lo = mid; else hi = mid }
      return { open, kind, nextChangeMs: hi }
    }
    t = nt
  }
  return { open, kind, nextChangeMs: null }
}

export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`
}
// The rejection / badge text.  "Market closed — opens in 5h 12m"
export function closedMessage(symbol, nowMs, holidays) {
  const s = marketStatus(symbol, nowMs, holidays)
  if (s.open) return null
  return s.nextChangeMs ? `Market closed — opens in ${fmtDuration(s.nextChangeMs - nowMs)}` : 'Market closed'
}
