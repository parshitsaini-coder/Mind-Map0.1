// Finnhub adapter (Phase 14): crypto candles + a "last price" derived from the newest 1-minute bar (Finnhub's /quote is for
// stocks). Pure: the proxy passes fetched JSON in. Shape: { c:[], h:[], l:[], o:[], t:[], v:[], s:'ok'|'no_data' } or { error }.
// Free key: ~60 calls / minute, personal use (see README). Finnhub has no 4h bar: H4 is built from H1 (candleMath.aggregate).
import { feedError } from './errors.js'

export const BASE = 'https://finnhub.io/api/v1'
export const RESOLUTION = { M1: '1', M5: '5', M15: '15', M30: '30', H1: '60', D1: 'D', W1: 'W' }
export const needsAggregate = (tf) => tf === 'H4' // built from H1
export const authHeaders = (key) => ({ 'X-Finnhub-Token': key })

export function candlesUrl(vendor, tf, { from, to }) {
  const res = RESOLUTION[tf] || RESOLUTION.H1
  const p = new URLSearchParams({ symbol: vendor, resolution: res, from: String(Math.floor(from)), to: String(Math.floor(to)) })
  return `${BASE}/crypto/candle?${p}`
}

export function errorOf(json, httpStatus) {
  const msg = String(json?.error || '').slice(0, 160)
  if (httpStatus === 429) return feedError('rate_limited', 'Price provider is busy, retrying', { retryAfter: 30 })
  if (httpStatus === 401 || /api key|token/i.test(msg)) return feedError('auth', 'Price provider key was rejected')
  if (httpStatus === 403 || /access|premium|plan/i.test(msg)) return feedError('plan', 'This symbol is not included in the data plan')
  return feedError('upstream', 'Price provider error')
}

export function normalizeCandles(json, httpStatus = 200) {
  if (!json || httpStatus >= 400 || json.error) throw errorOf(json, httpStatus)
  if (json.s === 'no_data') return []
  if (json.s !== 'ok' || !Array.isArray(json.t)) throw feedError('upstream', 'Unexpected response from the price provider')
  const out = []
  for (let i = 0; i < json.t.length; i++) {
    const c = { time: Number(json.t[i]), open: Number(json.o?.[i]), high: Number(json.h?.[i]), low: Number(json.l?.[i]), close: Number(json.c?.[i]), volume: Number(json.v?.[i]) || 0 }
    if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) continue
    out.push(c)
  }
  out.sort((a, b) => a.time - b.time)
  return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time)
}

// Newest bar of a 1-minute response -> Tick. No bid / ask: the app adds a clearly labelled simulated spread on the mid.
export function tickFromCandles(candles) {
  const c = candles && candles[candles.length - 1]
  if (!c) return null
  return { bid: null, ask: null, last: c.close, ts: (c.time + 60) * 1000, source: 'finnhub', dayOpen: candles[0].open }
}
