// Spot gold (XAUUSD) trading calendar, all in UTC.
//   Opens  Sunday 22:00 UTC, closes Friday 21:00 UTC.
//   Daily maintenance break Mon-Thu 21:00-22:00 UTC (and the weekend gap).
// Real brokers differ by an hour or so (daylight saving); the provider's own "is_market_open"
// flag, when available, overrides this calendar in liveFeed.
const MIN = 60
const H = 3600
const DAY = 86400
const OPEN_H = 22
const CLOSE_H = 21

// dow: 0 = Sunday ... 6 = Saturday, from UTC seconds
const dowOf = (sec) => new Date(sec * 1000).getUTCDay()
const secOfDay = (sec) => ((sec % DAY) + DAY) % DAY

export function isMarketOpen(sec = Math.floor(Date.now() / 1000)) {
  const d = dowOf(sec)
  const t = secOfDay(sec)
  if (d === 6) return false // Saturday
  if (d === 0) return t >= OPEN_H * H // Sunday: opens 22:00
  if (d === 5) return t < CLOSE_H * H // Friday: closes 21:00
  return t < CLOSE_H * H || t >= OPEN_H * H // Mon-Thu: break 21:00-22:00
}

// Next moment the market opens (seconds), or null if it is open right now.
export function nextOpen(sec = Math.floor(Date.now() / 1000)) {
  if (isMarketOpen(sec)) return null
  // walk forward in 5-minute steps (max 3 days) — simple and DST-proof
  for (let t = sec - (sec % (5 * MIN)) + 5 * MIN, i = 0; i < 3 * 288 + 5; t += 5 * MIN, i++) {
    if (isMarketOpen(t)) return t
  }
  return null
}
// Next moment the market closes (seconds), or null if it is closed right now.
export function nextClose(sec = Math.floor(Date.now() / 1000)) {
  if (!isMarketOpen(sec)) return null
  for (let t = sec - (sec % (5 * MIN)) + 5 * MIN, i = 0; i < 6 * 288 + 5; t += 5 * MIN, i++) {
    if (!isMarketOpen(t)) return t
  }
  return null
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec))
  const d = Math.floor(s / DAY), h = Math.floor((s % DAY) / H), m = Math.floor((s % H) / MIN)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${Math.max(1, m)}m`
}
export function marketStatus(sec = Math.floor(Date.now() / 1000)) {
  const open = isMarketOpen(sec)
  const next = open ? nextClose(sec) : nextOpen(sec)
  return { open, next, label: open ? 'Market open' : 'Market closed', closedMessage: open ? null : `Market closed — opens in ${fmtDuration((next ?? sec) - sec)}` }
}
// Seconds of the [from,to) interval that fall inside open hours (used to judge candle coverage).
export function openSeconds(from, to) {
  let n = 0
  for (let t = from - (from % 60); t < to; t += 60) if (isMarketOpen(t)) n += 60
  return n
}
