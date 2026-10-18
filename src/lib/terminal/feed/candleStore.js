// Pure candle helpers (UTC seconds) + a small in-memory / IndexedDB store.
import { TF_SECONDS } from './feedTypes.js'

const num = (x) => Number.isFinite(x)
export const okCandle = (c) => c && num(c.time) && num(c.open) && num(c.high) && num(c.low) && num(c.close) && c.high >= c.low
export const bucketOf = (sec, tfSec) => Math.floor(sec / tfSec) * tfSec

// Merge two oldest-first candle arrays. `b` wins on equal time. Sorted, de-duplicated, invalid dropped.
export function mergeCandles(a, b) {
  const m = new Map()
  for (const c of a || []) if (okCandle(c)) m.set(c.time, c)
  for (const c of b || []) if (okCandle(c)) m.set(c.time, c)
  return [...m.values()].sort((x, y) => x.time - y.time)
}

// Fold a live price into the forming candle (creates a new one when the bucket changes).
export function applyTick(candles, price, tsSec, tfSec) {
  if (!num(price)) return candles
  const bucket = bucketOf(tsSec, tfSec)
  const last = candles[candles.length - 1]
  if (last && bucket < last.time) return candles // old tick, ignore
  if (!last || bucket > last.time) {
    const open = last ? last.close : price
    return [...candles, { time: bucket, open, high: Math.max(open, price), low: Math.min(open, price), close: price, volume: 0 }]
  }
  const next = { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price }
  return [...candles.slice(0, -1), next]
}

// Fill holes (feed outage) with flat candles at the previous close so indicators/time axis stay even.
// Only gaps up to maxGap candles are filled; long gaps (weekend/closed market) are left as real gaps.
// `isOpen(sec)` lets the caller skip closed-market periods.
export function fillGaps(candles, tfSec, { maxGap = 5, isOpen = () => true } = {}) {
  if (candles.length < 2) return candles
  const out = [candles[0]]
  for (let i = 1; i < candles.length; i++) {
    const prev = out[out.length - 1]
    const c = candles[i]
    const missing = Math.round((c.time - prev.time) / tfSec) - 1
    if (missing > 0 && missing <= maxGap) {
      for (let k = 1; k <= missing; k++) {
        const t = prev.time + k * tfSec
        if (isOpen(t)) out.push({ time: t, open: prev.close, high: prev.close, low: prev.close, close: prev.close, volume: 0, filled: true })
      }
    }
    out.push(c)
  }
  return out
}

// Remove "idle" placeholder bars that providers emit while a market is shut (weekend / maintenance):
// flat bars (open≈high≈low≈close). A flat bar is dropped when it sits in closed hours, OR when it is part of
// a run of 2+ flat bars at the same price (no trading happened — also catches a provider whose session
// hours differ from our calendar). A single isolated flat bar in open hours is real and kept.
export function dropIdle(candles, { isOpen = () => true } = {}) {
  const flat = (c) => c.high - c.low <= Math.max(1e-9, Math.abs(c.close) * 2e-6) && Math.abs(c.open - c.close) <= Math.max(1e-9, Math.abs(c.close) * 2e-6)
  const out = []
  for (let i = 0; i < candles.length; ) {
    const c = candles[i]
    if (!flat(c)) { out.push(c); i++; continue }
    let j = i + 1
    while (j < candles.length && flat(candles[j]) && Math.abs(candles[j].close - c.close) <= Math.max(1e-9, Math.abs(c.close) * 2e-6)) j++
    const run = candles.slice(i, j)
    if (run.length < 2) { if (isOpen(c.time)) out.push(c) }
    // runs of 2+ are idle → dropped
    i = j
  }
  return out
}

// Build a higher timeframe from a lower one (e.g. H4 from H1). Buckets are aligned to UTC.
export function aggregate(candles, targetSec) {
  const out = []
  let cur = null
  for (const c of candles) {
    const b = bucketOf(c.time, targetSec)
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
// Which provider timeframe do we fetch to build `tf`?
export const sourceTf = (tf) => (tf === 'H4' ? 'H1' : tf)
export const tfSeconds = (tf) => TF_SECONDS[tf] || 60

// ── store: memory (+ IndexedDB when available) ───────────────────────────
const mem = new Map() // `${symbol}|${tf}` -> candles
const key = (s, tf) => `${s}|${tf}`
const MAX_KEEP = 6000
export const memGet = (s, tf) => mem.get(key(s, tf)) || []
export function memPut(s, tf, candles) {
  const merged = mergeCandles(memGet(s, tf), candles)
  mem.set(key(s, tf), merged.length > MAX_KEEP ? merged.slice(-MAX_KEEP) : merged)
  return mem.get(key(s, tf))
}
export const memClear = () => mem.clear()

const DB = 'mm-terminal-candles'
const openDb = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') return reject(new Error('no idb'))
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore('c')
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})
export async function idbLoad(s, tf) {
  try {
    const db = await openDb()
    return await new Promise((res) => {
      const q = db.transaction('c').objectStore('c').get(key(s, tf))
      q.onsuccess = () => res(Array.isArray(q.result) ? q.result.filter(okCandle) : [])
      q.onerror = () => res([])
    })
  } catch { return [] }
}
export async function idbSave(s, tf, candles) {
  try {
    const db = await openDb()
    db.transaction('c', 'readwrite').objectStore('c').put(candles.slice(-2000), key(s, tf))
  } catch { /* private mode / quota: memory only */ }
}
