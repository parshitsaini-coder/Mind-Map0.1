// Chart drawing tools — PURE geometry (no DOM, no chart library), so it can be unit-tested.
//
// A drawing is stored in DATA space so it stays put when you zoom, scroll or switch timeframe:
//   { id, type, points: [{ t: unixSeconds (UTC), p: price }], color, width, dash, locked,
//     text?, offset?, extend? }
//
// To draw it, a "projector" turns data space into pixels:
//   proj = { x(t) -> px|null, y(price) -> px|null, t(px) -> time, p(px) -> price, l(px) -> logicalIndex }
// layoutOf() turns a drawing + projector into plain shapes (segments, fills, labels, handles) that the
// canvas renderer paints and that hitTest() tests the pointer against — one geometry for both.

export const DRAW_TYPES = {
  trend: { name: 'Trend line', points: 2, clicks: 2 },
  ray: { name: 'Ray', points: 2, clicks: 2 },
  hline: { name: 'Horizontal line', points: 1, clicks: 1 },
  vline: { name: 'Vertical line', points: 1, clicks: 1 },
  rect: { name: 'Rectangle', points: 2, clicks: 2 },
  fib: { name: 'Fib retracement', points: 2, clicks: 2 },
  channel: { name: 'Parallel channel', points: 2, clicks: 3 }, // 2 points + a third click for the width
  text: { name: 'Text note', points: 1, clicks: 1 },
  measure: { name: 'Measure', points: 2, clicks: 2, transient: true },
}
export const DRAW_ORDER = ['trend', 'ray', 'hline', 'vline', 'rect', 'fib', 'channel', 'text', 'measure']
export const DRAW_COLORS = ['#38bdf8', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#f472b6', '#e5e7eb', '#14b8a6']
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const MAX_DRAWINGS_PER_SYMBOL = 300

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
let seq = 0
export const newId = () => `d${Date.now().toString(36)}${(++seq).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

export function newDrawing(type, points, extra = {}) {
  return {
    id: newId(), type, points,
    color: type === 'fib' ? '#f59e0b' : type === 'text' ? '#e5e7eb' : '#38bdf8',
    width: 2, dash: false, locked: false,
    ...(type === 'text' ? { text: 'Note' } : {}),
    ...(type === 'channel' ? { offset: 0 } : {}),
    ...(type === 'fib' ? { extend: true } : {}),
    ...extra,
  }
}

// Drop anything malformed (hand-edited / corrupted saved data must never crash the chart).
export function sanitizeDrawings(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const d of list) {
    const spec = d && DRAW_TYPES[d.type]
    if (!spec || spec.transient || typeof d.id !== 'string') continue
    if (!Array.isArray(d.points) || d.points.length < spec.points || !d.points.every((q) => q && isNum(q.t) && isNum(q.p))) continue
    out.push({
      id: d.id, type: d.type, points: d.points.slice(0, spec.points).map((q) => ({ t: q.t, p: q.p })),
      color: typeof d.color === 'string' ? d.color : '#38bdf8',
      width: [1, 2, 3, 4].includes(d.width) ? d.width : 2, dash: !!d.dash, locked: !!d.locked,
      ...(d.type === 'text' ? { text: String(d.text ?? 'Note').slice(0, 200) } : {}),
      ...(d.type === 'channel' ? { offset: isNum(d.offset) ? d.offset : 0 } : {}),
      ...(d.type === 'fib' ? { extend: d.extend !== false } : {}),
    })
    if (out.length >= MAX_DRAWINGS_PER_SYMBOL) break
  }
  return out
}

// ── time <-> logical bar index ─────────────────────────────────────────────
// `times` = sorted candle open times (UTC seconds). Fractional logical = position between bars.
// Outside the data it extrapolates with one timeframe step per bar.
export function makeTimeMap(times, tfSec) {
  const n = times.length
  const toLogical = (t) => {
    if (n === 0) return 0
    if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / tfSec
    if (t <= times[0]) return (t - times[0]) / tfSec
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (times[mid] <= t) lo = mid
      else hi = mid
    }
    return lo + (t - times[lo]) / (times[lo + 1] - times[lo])
  }
  const toTime = (l) => {
    if (n === 0) return 0
    if (l >= n - 1) return times[n - 1] + (l - (n - 1)) * tfSec
    if (l <= 0) return times[0] + l * tfSec
    const i = Math.floor(l)
    return times[i] + (l - i) * (times[i + 1] - times[i])
  }
  return { toLogical, toTime, n, tfSec }
}

// Builds a projector from a time map plus the chart's own coordinate converters.
export function makeProjector(timeMap, conv) {
  return {
    x: (t) => conv.logicalToX(timeMap.toLogical(t)),
    y: (p) => conv.priceToY(p),
    t: (x) => { const l = conv.xToLogical(x); return l == null ? null : timeMap.toTime(l) },
    p: (y) => conv.yToPrice(y),
    l: (x) => conv.xToLogical(x),
  }
}

// ── geometry helpers ───────────────────────────────────────────────────────
export function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

// Extend the ray (x1,y1)->(x2,y2) until it leaves the view box (with a margin).
export function extendRay(x1, y1, x2, y2, w, h) {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return { x: x2, y: y2 }
  const M = 60
  const tx = dx > 0 ? (w + M - x1) / dx : dx < 0 ? (-M - x1) / dx : Infinity
  const ty = dy > 0 ? (h + M - y1) / dy : dy < 0 ? (-M - y1) / dy : Infinity
  const t = Math.max(1, Math.min(tx, ty))
  return { x: x1 + dx * t, y: y1 + dy * t }
}

const pointInPoly = (px, py, poly) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Price on the channel's base line at logical position l.
export function lineAt(p1, p2, l1, l2, l) {
  return l2 === l1 ? p1.p : p1.p + ((p2.p - p1.p) * (l - l1)) / (l2 - l1)
}

// Price offset of a channel's parallel, from a third click at (logical l3, price p3).
export function channelOffset(d, timeMap, l3, p3) {
  const [a, b] = d.points
  return p3 - lineAt(a, b, timeMap.toLogical(a.t), timeMap.toLogical(b.t), l3)
}

export function formatDuration(sec) {
  const s = Math.abs(Math.round(sec))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

// Numbers shown by the Measure tool.
export function measureInfo(a, b, inst, timeMap) {
  const dp = b.p - a.p
  return {
    dp,
    pips: inst?.pipSize ? dp / inst.pipSize : null,
    pct: a.p ? (dp / a.p) * 100 : 0,
    bars: Math.round(timeMap.toLogical(b.t) - timeMap.toLogical(a.t)),
    secs: b.t - a.t,
    up: dp >= 0,
  }
}

const estimateWidth = (text, size = 12) => text.length * size * 0.56
export const TEXT_H = 20

// ── layout: drawing -> shapes ─────────────────────────────────────────────
// view = { w, h, fmt(price)->string, measure?(text)->px, inst?, timeMap? }
// Returns null when the drawing cannot be placed (e.g. coordinates unavailable).
export function layoutOf(d, proj, view) {
  const { w, h } = view
  const fmt = view.fmt || ((v) => String(v))
  const measure = view.measure || estimateWidth
  const pt = d.points.map((q) => ({ x: proj.x(q.t), y: proj.y(q.p) }))
  if (pt.some((q) => q.x == null || q.y == null)) return null
  const lay = { segs: [], fills: [], labels: [], handles: [] }
  const seg = (x1, y1, x2, y2, o = {}) => lay.segs.push({ x1, y1, x2, y2, ...o })
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  switch (d.type) {
    case 'trend':
      seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y)
      lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
      break
    case 'ray': {
      const e = extendRay(pt[0].x, pt[0].y, pt[1].x, pt[1].y, w, h)
      seg(pt[0].x, pt[0].y, e.x, e.y)
      lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
      break
    }
    case 'hline': {
      const y = pt[0].y
      seg(0, y, w, y)
      lay.labels.push({ x: w - 6, y: y - 3, text: fmt(d.points[0].p), align: 'right', plain: true })
      lay.handles.push({ x: clamp(pt[0].x, 14, w - 14), y, idx: 0 })
      break
    }
    case 'vline': {
      const x = pt[0].x
      seg(x, 0, x, h)
      lay.handles.push({ x, y: clamp(pt[0].y, 14, h - 14), idx: 0 })
      break
    }
    case 'rect': {
      const [a, b] = pt
      lay.fills.push({ poly: [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], alpha: 0.12, hit: true })
      seg(a.x, a.y, b.x, a.y); seg(b.x, a.y, b.x, b.y); seg(b.x, b.y, a.x, b.y); seg(a.x, b.y, a.x, a.y)
      lay.handles.push({ ...a, idx: 0 }, { ...b, idx: 1 }, { x: b.x, y: a.y, idx: 2 }, { x: a.x, y: b.y, idx: 3 })
      break
    }
    case 'fib': {
      const [a, b] = d.points
      const xl = Math.min(pt[0].x, pt[1].x)
      const xr = d.extend === false ? Math.max(pt[0].x, pt[1].x) : Math.max(w, pt[0].x, pt[1].x)
      let prevY = null
      FIB_LEVELS.forEach((lvl, i) => {
        const price = b.p + (a.p - b.p) * lvl // 0 at the 2nd anchor, 1 at the 1st
        const y = proj.y(price)
        if (y == null) return
        seg(xl, y, xr, y, { alpha: lvl === 0 || lvl === 1 ? 1 : 0.8, fibLevel: lvl })
        lay.labels.push({ x: xl + 4, y: y - 3, text: `${lvl} (${fmt(price)})`, align: 'left', plain: true })
        if (prevY != null && i % 2 === 1) lay.fills.push({ poly: [[xl, prevY], [xr, prevY], [xr, y], [xl, y]], alpha: 0.07 })
        prevY = y
      })
      seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y, { dash: true, alpha: 0.7 })
      lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
      break
    }
    case 'channel': {
      const [a, b] = d.points
      const off = d.offset || 0
      const y1 = proj.y(a.p + off)
      const y2 = proj.y(b.p + off)
      if (y1 == null || y2 == null) return null
      seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y)
      seg(pt[0].x, y1, pt[1].x, y2)
      seg(pt[0].x, (pt[0].y + y1) / 2, pt[1].x, (pt[1].y + y2) / 2, { dash: true, alpha: 0.6 })
      lay.fills.push({ poly: [[pt[0].x, pt[0].y], [pt[1].x, pt[1].y], [pt[1].x, y2], [pt[0].x, y1]], alpha: 0.1 })
      lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 }, { x: (pt[0].x + pt[1].x) / 2, y: (y1 + y2) / 2, idx: 2 })
      break
    }
    case 'text': {
      const text = d.text || 'Note'
      const tw = measure(text) + 14
      lay.labels.push({ x: pt[0].x, y: pt[0].y, text, align: 'left', box: true, bw: tw, bh: TEXT_H })
      lay.fills.push({ poly: [[pt[0].x, pt[0].y - TEXT_H / 2], [pt[0].x + tw, pt[0].y - TEXT_H / 2], [pt[0].x + tw, pt[0].y + TEXT_H / 2], [pt[0].x, pt[0].y + TEXT_H / 2]], alpha: 0, hit: true })
      lay.handles.push({ ...pt[0], idx: 0 })
      break
    }
    case 'measure': {
      const [a, b] = pt
      lay.fills.push({ poly: [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]], alpha: 0.12, hit: true })
      seg(a.x, a.y, b.x, b.y, { arrow: true })
      const m = view.timeMap && view.inst ? measureInfo(d.points[0], d.points[1], view.inst, view.timeMap) : null
      if (m) {
        const sign = m.dp >= 0 ? '+' : '−'
        const lines = [
          `${sign}${fmt(Math.abs(m.dp))}  (${sign}${Math.abs(m.pct).toFixed(2)}%)`,
          `${m.pips == null ? '' : `${Math.abs(m.pips).toFixed(1)} pips · `}${Math.abs(m.bars)} bars · ${formatDuration(m.secs)}`,
        ]
        lay.labels.push({ x: (a.x + b.x) / 2, y: m.up ? Math.min(a.y, b.y) - 8 : Math.max(a.y, b.y) + 8, lines, align: 'center', box: true, up: m.up, bh: 36, bw: Math.max(...lines.map((s) => measure(s))) + 14 })
      }
      break
    }
    default:
      return null
  }
  return lay
}

// ── hit testing ────────────────────────────────────────────────────────────
// Returns { kind: 'handle', idx } | { kind: 'body' } | null.
export function hitTest(lay, x, y, { tol = 6, handleTol = 10, selected = false } = {}) {
  if (!lay) return null
  if (selected) {
    let best = null
    for (const hd of lay.handles) {
      const dist = Math.hypot(hd.x - x, hd.y - y)
      if (dist <= handleTol && (!best || dist < best.dist)) best = { dist, idx: hd.idx }
    }
    if (best) return { kind: 'handle', idx: best.idx }
  }
  for (const s of lay.segs) if (distToSeg(x, y, s.x1, s.y1, s.x2, s.y2) <= tol) return { kind: 'body' }
  for (const f of lay.fills) if (f.hit && pointInPoly(x, y, f.poly)) return { kind: 'body' }
  return null
}

// ── editing ────────────────────────────────────────────────────────────────
// Move the whole drawing by (dl bars, dp price).
export function movePoints(d, orig, dl, dp, timeMap) {
  const lockX = d.type === 'hline'
  const lockY = d.type === 'vline'
  return orig.map((q) => ({
    t: lockX ? q.t : timeMap.toTime(timeMap.toLogical(q.t) + dl),
    p: lockY ? q.p : q.p + dp,
  }))
}

// Drag one handle to (t, p). Returns a patch for the drawing.
export function moveHandle(d, idx, t, p, timeMap) {
  const pts = d.points.map((q) => ({ ...q }))
  switch (d.type) {
    case 'hline': pts[0].p = p; return { points: pts }
    case 'vline': pts[0].t = t; return { points: pts }
    case 'rect':
      if (idx === 0) pts[0] = { t, p }
      else if (idx === 1) pts[1] = { t, p }
      else if (idx === 2) { pts[1].t = t; pts[0].p = p }
      else { pts[0].t = t; pts[1].p = p }
      return { points: pts }
    case 'channel':
      if (idx === 2) return { offset: channelOffset(d, timeMap, timeMap.toLogical(t), p) }
      pts[idx] = { t, p }
      return { points: pts }
    default:
      pts[idx] = { t, p }
      return { points: pts }
  }
}
