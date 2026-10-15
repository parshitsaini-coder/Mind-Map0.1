// Pure candle helpers (Phase 14): merge, aggregate, fold a live tick into the forming bar, find gaps. Candle = { time (UTC sec,
// bar start), open, high, low, close, volume }. Nothing here mutates its input.
export function mergeCandles(base, incoming) {
  const map = new Map()
  for (const c of base || []) map.set(c.time, c)
  for (const c of incoming || []) map.set(c.time, c) // newer data wins
  return [...map.values()].sort((a, b) => a.time - b.time)
}

// Build a higher timeframe from a lower one (H1 -> H4, M1 -> M5 ...). The last bucket may still be forming.
export function aggregate(candles, toSec) {
  const out = []
  let cur = null
  for (const c of candles || []) {
    const b = Math.floor(c.time / toSec) * toSec
    if (!cur || cur.time !== b) {
      if (cur) out.push(cur)
      cur = { time: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 }
    } else {
      if (c.high > cur.high) cur.high = c.high
      if (c.low < cur.low) cur.low = c.low
      cur.close = c.close
      cur.volume += c.volume || 0
    }
  }
  if (cur) out.push(cur)
  return out
}

// Fold one tick (price at tsSec) into the series. Returns { candle, isNew } for the bar the tick belongs to, or null when the
// tick is older than the newest bar (late / out of order: dropped). A real gap keeps the new bar's open at the tick price.
export function tickIntoCandle(last, price, tsSec, tfSec) {
  if (!Number.isFinite(price) || !Number.isFinite(tsSec)) return null
  const b = Math.floor(tsSec / tfSec) * tfSec
  if (!last || b > last.time) return { candle: { time: b, open: price, high: price, low: price, close: price, volume: 0 }, isNew: true }
  if (b < last.time) return null
  return { candle: { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price }, isNew: false }
}

// Time ranges [from, to) where bars are MISSING although the market was open. isOpenAt(timeSec) says whether a bar starting then
// should exist (weekends / closed hours produce no bars and are not gaps). Used to refetch holes after a reconnect.
export function gapRanges(candles, tfSec, isOpenAt = () => true) {
  const gaps = []
  for (let i = 1; i < (candles || []).length; i++) {
    const a = candles[i - 1].time, b = candles[i].time
    if (b - a <= tfSec) continue
    let start = null
    for (let t = a + tfSec; t < b; t += tfSec) {
      if (isOpenAt(t)) { if (start == null) start = t } else if (start != null) { gaps.push({ from: start, to: t }); start = null }
    }
    if (start != null) gaps.push({ from: start, to: b })
  }
  return gaps
}
