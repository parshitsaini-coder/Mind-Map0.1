// Phase 10 (pure): price alerts. An alert watches the MID price of one symbol and fires ONCE when
// it reaches the level from the side it was created on ('above' = created below the level,
// 'below' = created above it). Fired alerts stay in the list (flagged, with the time) until removed,
// so a missed toast is never lost. No React, no store, no I/O — tests/terminal-phase10.test.mjs.
import { INSTRUMENTS } from './instruments.js'

export const MAX_ALERTS = 60
const num = (v) => typeof v === 'number' && Number.isFinite(v)

export const midOf = (q) => (q ? (q.bid + q.ask) / 2 : null)

// The side is decided by where the level sits relative to the current mid.
export const dirFor = (price, mid) => (price > mid ? 'above' : 'below')

export function validateAlert(symbol, price, quote) {
  const inst = INSTRUMENTS[symbol]
  if (!inst) return 'Unknown symbol'
  if (!num(price) || price <= 0) return 'Enter a price above 0'
  if (!quote) return 'Waiting for live price…'
  const mid = midOf(quote)
  if (Math.abs(price - mid) < inst.pipSize - 1e-12) return `Alert must be at least 1 pip from the price ${mid.toFixed(inst.digits)}`
  return null
}

let seq = 0
export const newAlertId = () => `a${Date.now().toString(36)}${(++seq).toString(36)}`

export function createAlert(symbol, price, quote, now = Math.floor(Date.now() / 1000)) {
  const err = validateAlert(symbol, price, quote)
  if (err) return { error: err }
  const inst = INSTRUMENTS[symbol]
  const p = Number(price.toFixed(inst.digits))
  return { alert: { id: newAlertId(), symbol, price: p, dir: dirFor(p, midOf(quote)), createdAt: now, firedAt: null } }
}

// Saved / cloud data is never trusted.
export function cleanAlerts(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const a of list) {
    if (!a || typeof a !== 'object') continue
    if (typeof a.id !== 'string' || !a.id || a.id.length > 40 || seen.has(a.id)) continue
    if (!INSTRUMENTS[a.symbol] || !num(a.price) || a.price <= 0) continue
    if (a.dir !== 'above' && a.dir !== 'below') continue
    seen.add(a.id)
    out.push({ id: a.id, symbol: a.symbol, price: a.price, dir: a.dir, createdAt: num(a.createdAt) ? a.createdAt : 0, firedAt: num(a.firedAt) ? a.firedAt : null })
    if (out.length >= MAX_ALERTS) break
  }
  return out
}

export const activeAlerts = (list) => list.filter((a) => a.firedAt == null)

// One tick. Returns null when nothing fired (cheap path, no allocation), else { alerts, fired }.
export function checkAlerts(list, quotes, now = Math.floor(Date.now() / 1000)) {
  let fired = null
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.firedAt != null) continue
    const q = quotes[a.symbol]
    if (!q) continue
    const mid = (q.bid + q.ask) / 2
    if (a.dir === 'above' ? mid >= a.price : mid <= a.price) (fired || (fired = [])).push(a.id)
  }
  if (!fired) return null
  const set = new Set(fired)
  const alerts = list.map((a) => (set.has(a.id) ? { ...a, firedAt: now } : a))
  return { alerts, fired: alerts.filter((a) => set.has(a.id)) }
}

export const alertText = (a) => {
  const inst = INSTRUMENTS[a.symbol]
  const px = a.price.toFixed(inst ? inst.digits : 2)
  return `Alert: ${a.symbol} ${a.dir === 'above' ? 'rose to' : 'fell to'} ${px}`
}

// Moving an alert on the chart: same rules as creating one (side is recomputed).
export function moveAlert(list, id, price, quote) {
  const a = list.find((x) => x.id === id)
  if (!a) return { error: 'Alert not found' }
  const err = validateAlert(a.symbol, price, quote)
  if (err) return { error: err }
  const inst = INSTRUMENTS[a.symbol]
  const p = Number(price.toFixed(inst.digits))
  return { alerts: list.map((x) => (x.id === id ? { ...x, price: p, dir: dirFor(p, midOf(quote)), firedAt: null } : x)) }
}

// ── on-chart pill stacking (positions / orders at nearly the same price must not overlap) ──
// ys: [{ id, y }] in pixels, returns { id: top } with at least `gap` px between neighbours.
export function stackPills(ys, gap = 34) {
  const sorted = ys.filter((o) => o.y != null).sort((a, b) => a.y - b.y)
  const out = {}
  let prev = -Infinity
  for (const o of sorted) {
    const top = Math.max(o.y - 16, prev + gap)
    out[o.id] = top
    prev = top
  }
  return out
}
