// Pure geometry for the drawing tools: time <-> bar index, projector, segment maths, hit-testing.
// (Split out of drawings.js in Phase 11; drawings.js re-exports everything for older imports.)

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

export const pointInPoly = (px, py, poly) => {
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

