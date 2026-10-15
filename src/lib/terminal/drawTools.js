// Phase 11 — drawing-tool registry. PURE (no DOM / chart library).
//
// Every tool is declared once: id, name, category, points, clicks, dialog tabs, and (for the tools added in
// Phase 11) a `layout(d, c)` that turns the drawing into plain shapes. drawings.js keeps its original switch for
// the 9 Phase-6 tools and falls back to `TOOL_LAYOUT[type]` for everything else, so adding a tool never means
// touching DrawingLayer's core: add one entry here.
//
// layout context `c`: { pt:[{x,y}], proj, w, h, fmt, measure, inst, timeMap, lay, seg, extendRay, clamp }
import * as E from './engine.js'

export const CATEGORIES = [
  { id: 'lines', label: 'Lines' },
  { id: 'fib', label: 'Fibonacci' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'annotation', label: 'Annotation' },
  { id: 'trading', label: 'Trading tools' },
  { id: 'measure', label: 'Measure' },
]

// Metadata for ALL tools (old + new). `tabs`: dialog tabs in order.
export const TOOL_META = {
  trend: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  ray: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  extended: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  hray: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  hline: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  vline: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  arrow: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  channel: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  pitchfork: { cat: 'lines', tabs: ['style', 'coords', 'vis'] },
  fib: { cat: 'fib', tabs: ['style', 'levels', 'coords', 'vis'] },
  fibext: { cat: 'fib', tabs: ['style', 'levels', 'coords', 'vis'] },
  rect: { cat: 'shapes', tabs: ['style', 'coords', 'vis'] },
  ellipse: { cat: 'shapes', tabs: ['style', 'coords', 'vis'] },
  triangle: { cat: 'shapes', tabs: ['style', 'coords', 'vis'] },
  text: { cat: 'annotation', tabs: ['style', 'text', 'coords', 'vis'] },
  callout: { cat: 'annotation', tabs: ['style', 'text', 'coords', 'vis'] },
  arrowMarker: { cat: 'annotation', tabs: ['style', 'coords', 'vis'] },
  long: { cat: 'trading', tabs: ['style', 'coords', 'vis'] },
  short: { cat: 'trading', tabs: ['style', 'coords', 'vis'] },
  measure: { cat: 'measure', tabs: ['style'] },
  priceRange: { cat: 'measure', tabs: ['style', 'coords', 'vis'] },
  dateRange: { cat: 'measure', tabs: ['style', 'coords', 'vis'] },
  dateAndPriceRange: { cat: 'measure', tabs: ['style', 'coords', 'vis'] },
}

// Specs of the tools that are NEW in Phase 11 (merged into DRAW_TYPES by drawings.js).
export const NEW_SPECS = {
  extended: { name: 'Extended line', points: 2, clicks: 2 },
  hray: { name: 'Horizontal ray', points: 1, clicks: 1 },
  arrow: { name: 'Arrow', points: 2, clicks: 2 },
  pitchfork: { name: 'Pitchfork', points: 3, clicks: 3 },
  fibext: { name: 'Fib extension', points: 3, clicks: 3 },
  ellipse: { name: 'Ellipse', points: 2, clicks: 2 },
  triangle: { name: 'Triangle', points: 3, clicks: 3 },
  callout: { name: 'Callout', points: 2, clicks: 2 },
  arrowMarker: { name: 'Arrow marker', points: 1, clicks: 1 },
  long: { name: 'Long position', points: 2, clicks: 2 },
  short: { name: 'Short position', points: 2, clicks: 2 },
  priceRange: { name: 'Price range', points: 2, clicks: 2 },
  dateRange: { name: 'Date range', points: 2, clicks: 2 },
  dateAndPriceRange: { name: 'Date & price range', points: 2, clicks: 2 },
}
export const NEW_ORDER = ['extended', 'hray', 'arrow', 'pitchfork', 'fibext', 'ellipse', 'triangle', 'callout', 'arrowMarker', 'long', 'short', 'priceRange', 'dateRange', 'dateAndPriceRange']

// ── Fibonacci ────────────────────────────────────────────────────────────
export const FIB_RETRACE = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_EXT = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618]
export const defaultLevels = (type) => (type === 'fibext' ? FIB_EXT : FIB_RETRACE).map((v) => ({ v, on: true, color: null }))
export const defaultFibOpts = () => ({ reverse: false, showPrices: true, showLevels: true, showPercent: false, trendLine: true, background: true, oneColor: false })

// Retracement: level 0 sits on the 2nd anchor, 1 on the 1st (reverse flips that).
export const fibRetracePrice = (a, b, v, reverse = false) => (reverse ? a.p + (b.p - a.p) * v : b.p + (a.p - b.p) * v)
// Trend-based extension: A→B is the leg, C the pull-back; level v projects v × (B−A) from C.
export const fibExtPrice = (a, b, c, v, reverse = false) => c.p + (reverse ? -1 : 1) * (b.p - a.p) * v

// Clean level list: unknown values dropped, max 24, sorted by value on read (order kept on write).
export function cleanLevels(list, type) {
  if (!Array.isArray(list) || !list.length) return defaultLevels(type)
  const out = []
  for (const l of list.slice(0, 24)) {
    if (!l || typeof l.v !== 'number' || !Number.isFinite(l.v) || l.v < -20 || l.v > 50) continue
    out.push({ v: l.v, on: l.on !== false, color: typeof l.color === 'string' && /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : null })
  }
  return out.length ? out : defaultLevels(type)
}

function fibLayout(d, c, ext) {
  const { pt, proj, w, fmt, lay, seg } = c
  const o = { ...defaultFibOpts(), ...(d.fib || {}) }
  const levels = cleanLevels(d.levels, d.type)
  const [a, b, third] = d.points
  const xl = Math.min(...pt.map((p) => p.x))
  const xr = d.extend === false ? Math.max(...pt.map((p) => p.x)) : Math.max(w, ...pt.map((p) => p.x))
  let prevY = null
  let k = 0
  for (const lv of levels) {
    if (!lv.on) continue
    const price = ext ? fibExtPrice(a, b, third, lv.v, o.reverse) : fibRetracePrice(a, b, lv.v, o.reverse)
    const y = proj.y(price)
    if (y == null) continue
    seg(xl, y, xr, y, { alpha: lv.v === 0 || lv.v === 1 ? 1 : 0.8, fibLevel: lv.v, color: o.oneColor ? null : lv.color })
    const parts = []
    if (o.showLevels) parts.push(o.showPercent ? `${(lv.v * 100).toFixed(1)}%` : String(lv.v))
    if (o.showPrices) parts.push(`(${fmt(price)})`)
    if (parts.length) lay.labels.push({ x: xl + 4, y: y - 3, text: parts.join(' '), align: 'left', plain: true, color: o.oneColor ? null : lv.color })
    if (o.background && prevY != null && k % 2 === 1) lay.fills.push({ poly: [[xl, prevY], [xr, prevY], [xr, y], [xl, y]], alpha: 0.07 })
    prevY = y
    k++
  }
  if (o.trendLine) {
    seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y, { dash: true, alpha: 0.7 })
    if (ext) seg(pt[1].x, pt[1].y, pt[2].x, pt[2].y, { dash: true, alpha: 0.7 })
  }
  pt.forEach((p, idx) => lay.handles.push({ ...p, idx }))
}

// ── Long / short position tool ───────────────────────────────────────────
// points[0] = entry (time, price), points[1] = target (right end, price); d.stop = stop price; d.lots.
export const positionSide = (type) => (type === 'long' ? 'buy' : 'sell')
export const defaultStopFor = (entry, target) => entry - (target - entry) / 2 // mirrored at half distance → R:R 2
export const positionValid = (type, entry, stop, target) => (type === 'long' ? stop < entry && entry < target : stop > entry && entry > target)

// Same maths as the ledger (engine.pnl) so the box and a real trade agree.
export function positionNumbers(d, inst, rates) {
  const side = positionSide(d.type)
  const entry = d.points[0].p
  const target = d.points[1].p
  const stop = Number.isFinite(d.stop) ? d.stop : defaultStopFor(entry, target)
  const lots = d.lots > 0 ? d.lots : 0.1
  const risk = Math.abs(E.pnl(side, lots, entry, stop, inst, rates))
  const reward = Math.abs(E.pnl(side, lots, entry, target, inst, rates))
  return {
    side, entry, stop, target, lots,
    riskMoney: E.roundMoney(risk), rewardMoney: E.roundMoney(reward),
    riskPips: Math.round((Math.abs(entry - stop) / inst.pipSize) * 10) / 10,
    rewardPips: Math.round((Math.abs(target - entry) / inst.pipSize) * 10) / 10,
    rr: risk > 0 ? reward / risk : null,
    valid: positionValid(d.type, entry, stop, target),
  }
}

const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function positionLayout(d, c) {
  const { pt, proj, fmt, lay, seg, inst } = c
  if (!inst) return null
  const n = positionNumbers(d, inst)
  const ys = proj.y(n.stop)
  if (ys == null) return null
  const x0 = Math.min(pt[0].x, pt[1].x)
  const x1 = Math.max(pt[0].x, pt[1].x)
  const GREEN = '#22c55e'
  const RED = '#ef4444'
  lay.fills.push({ poly: [[x0, pt[0].y], [x1, pt[0].y], [x1, pt[1].y], [x0, pt[1].y]], alpha: 0.16, color: GREEN, hit: true, main: true })
  lay.fills.push({ poly: [[x0, pt[0].y], [x1, pt[0].y], [x1, ys], [x0, ys]], alpha: 0.16, color: RED, hit: true })
  seg(x0, pt[0].y, x1, pt[0].y)
  seg(x0, pt[1].y, x1, pt[1].y, { color: GREEN })
  seg(x0, ys, x1, ys, { color: RED })
  const pips = (v) => `${v.toFixed(1)} pips`
  lay.labels.push({ x: (x0 + x1) / 2, y: pt[1].y + (pt[1].y < pt[0].y ? -9 : 9), text: `Target ${fmt(n.target)} · +${money(n.rewardMoney)} (${pips(n.rewardPips)})`, align: 'center', plain: true, color: GREEN })
  lay.labels.push({ x: (x0 + x1) / 2, y: ys + (ys < pt[0].y ? -9 : 9), text: `Stop ${fmt(n.stop)} · \u2212${money(n.riskMoney)} (${pips(n.riskPips)})`, align: 'center', plain: true, color: RED })
  lay.labels.push({ x: (x0 + x1) / 2, y: pt[0].y - 8 * (pt[1].y < pt[0].y ? -1 : 1), text: `${d.type === 'long' ? 'Long' : 'Short'} ${n.lots} lot${n.valid ? '' : ' · invalid levels'}${n.rr != null ? ` · R:R ${n.rr.toFixed(2)}` : ''}`, align: 'center', plain: true })
  lay.handles.push({ x: pt[0].x, y: pt[0].y, idx: 0 }, { x: pt[1].x, y: pt[1].y, idx: 1 }, { x: pt[1].x, y: ys, idx: 2 })
  return lay
}

// ── measure-like persistent ranges ───────────────────────────────────────
function rangeLayout(d, c) {
  const { pt, lay, seg, fmt, measure, inst, timeMap } = c
  const [a, b] = pt
  const showP = d.type !== 'dateRange'
  const showT = d.type !== 'priceRange'
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
  const up = d.points[1].p >= d.points[0].p
  const fx0 = showT ? x0 : 0, fx1 = showT ? x1 : c.w
  const fy0 = showP ? y0 : 0, fy1 = showP ? y1 : c.h
  lay.fills.push({ poly: [[fx0, fy0], [fx1, fy0], [fx1, fy1], [fx0, fy1]], alpha: 0.12, hit: true, main: true })
  if (showP) { seg(fx0, y0, fx1, y0, { dash: true }); seg(fx0, y1, fx1, y1, { dash: true }) }
  if (showT) { seg(x0, fy0, x0, fy1, { dash: true }); seg(x1, fy0, x1, fy1, { dash: true }) }
  const lines = []
  if (showP) {
    const dp = d.points[1].p - d.points[0].p
    const pips = inst?.pipSize ? ` · ${Math.abs(dp / inst.pipSize).toFixed(1)} pips` : ''
    const pct = d.points[0].p ? ` · ${(Math.abs(dp / d.points[0].p) * 100).toFixed(2)}%` : ''
    lines.push(`${dp >= 0 ? '+' : '\u2212'}${fmt(Math.abs(dp))}${pct}${pips}`)
  }
  if (showT && timeMap) {
    const bars = Math.round(timeMap.toLogical(d.points[1].t) - timeMap.toLogical(d.points[0].t))
    const secs = Math.abs(d.points[1].t - d.points[0].t)
    const dur = secs >= 86400 ? `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h` : secs >= 3600 ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m` : `${Math.floor(secs / 60)}m`
    lines.push(`${Math.abs(bars)} bars · ${dur}`)
  }
  lay.labels.push({ x: (x0 + x1) / 2, y: showP ? (up ? y0 - 8 : y1 + 8) : 14, lines, align: 'center', box: true, up, bh: 4 + lines.length * 16, bw: Math.max(...lines.map((s) => measure(s))) + 14 })
  lay.handles.push({ ...a, idx: 0 }, { ...b, idx: 1 })
}

const ellipsePoly = (cx, cy, rx, ry, n = 40) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)])

// ── layouts of the new tools ─────────────────────────────────────────────
export const TOOL_LAYOUT = {
  extended(d, c) {
    const { pt, w, h, lay, seg, extendRay } = c
    const f = extendRay(pt[0].x, pt[0].y, pt[1].x, pt[1].y, w, h)
    const bk = extendRay(pt[1].x, pt[1].y, pt[0].x, pt[0].y, w, h)
    seg(bk.x, bk.y, f.x, f.y)
    lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
    return lay
  },
  hray(d, c) {
    const { pt, w, lay, seg, fmt, clamp } = c
    seg(pt[0].x, pt[0].y, w, pt[0].y)
    lay.labels.push({ x: w - 6, y: pt[0].y - 3, text: fmt(d.points[0].p), align: 'right', plain: true })
    lay.handles.push({ x: clamp(pt[0].x, 14, w - 14), y: pt[0].y, idx: 0 })
    return lay
  },
  arrow(d, c) {
    const { pt, lay, seg } = c
    seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y, { arrow: true })
    lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
    return lay
  },
  pitchfork(d, c) {
    const { pt, w, h, lay, seg, extendRay } = c
    const [a, b, k] = pt
    const mid = { x: (b.x + k.x) / 2, y: (b.y + k.y) / 2 }
    const dx = mid.x - a.x, dy = mid.y - a.y
    const far = (p) => extendRay(p.x, p.y, p.x + dx, p.y + dy, w, h)
    const m = far(a), tb = far(b), tk = far(k)
    seg(a.x, a.y, m.x, m.y)
    seg(b.x, b.y, tb.x, tb.y)
    seg(k.x, k.y, tk.x, tk.y)
    seg(b.x, b.y, k.x, k.y, { dash: true, alpha: 0.7 })
    lay.fills.push({ poly: [[b.x, b.y], [tb.x, tb.y], [tk.x, tk.y], [k.x, k.y]], alpha: 0.06 })
    pt.forEach((p, idx) => lay.handles.push({ ...p, idx }))
    return lay
  },
  fibext(d, c) { fibLayout(d, c, true); return c.lay },
  ellipse(d, c) {
    const { pt, lay, seg } = c
    const cx = (pt[0].x + pt[1].x) / 2, cy = (pt[0].y + pt[1].y) / 2
    const rx = Math.abs(pt[1].x - pt[0].x) / 2, ry = Math.abs(pt[1].y - pt[0].y) / 2
    const poly = ellipsePoly(cx, cy, rx, ry)
    lay.fills.push({ poly, alpha: 0.12, hit: true, main: true })
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; seg(p[0], p[1], q[0], q[1]) })
    lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
    return lay
  },
  triangle(d, c) {
    const { pt, lay, seg } = c
    lay.fills.push({ poly: pt.map((p) => [p.x, p.y]), alpha: 0.12, hit: true, main: true })
    seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y); seg(pt[1].x, pt[1].y, pt[2].x, pt[2].y); seg(pt[2].x, pt[2].y, pt[0].x, pt[0].y)
    pt.forEach((p, idx) => lay.handles.push({ ...p, idx }))
    return lay
  },
  callout(d, c) {
    const { pt, lay, seg, measure } = c
    const text = d.text || 'Note'
    const size = d.style?.text?.size || 12
    const tw = (measure(text) * size) / 11 + 14
    seg(pt[0].x, pt[0].y, pt[1].x, pt[1].y, { arrow: true })
    lay.labels.push({ x: pt[1].x, y: pt[1].y, text, align: 'left', textbox: true, bw: tw, bh: size + 10 })
    lay.fills.push({ poly: [[pt[1].x, pt[1].y - (size + 10) / 2], [pt[1].x + tw, pt[1].y - (size + 10) / 2], [pt[1].x + tw, pt[1].y + (size + 10) / 2], [pt[1].x, pt[1].y + (size + 10) / 2]], alpha: 0, hit: true })
    lay.handles.push({ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 })
    return lay
  },
  arrowMarker(d, c) {
    const { pt, lay } = c
    const up = d.dir !== 'down'
    const { x, y } = pt[0]
    const s = 11
    const poly = up
      ? [[x, y], [x + s, y + s * 1.4], [x + s / 2.5, y + s * 1.4], [x + s / 2.5, y + s * 2.6], [x - s / 2.5, y + s * 2.6], [x - s / 2.5, y + s * 1.4], [x - s, y + s * 1.4]]
      : [[x, y], [x + s, y - s * 1.4], [x + s / 2.5, y - s * 1.4], [x + s / 2.5, y - s * 2.6], [x - s / 2.5, y - s * 2.6], [x - s / 2.5, y - s * 1.4], [x - s, y - s * 1.4]]
    lay.fills.push({ poly, alpha: 0.9, hit: true, main: true })
    lay.handles.push({ x, y, idx: 0 })
    return lay
  },
  long: positionLayout,
  short: positionLayout,
  priceRange(d, c) { rangeLayout(d, c); return c.lay },
  dateRange(d, c) { rangeLayout(d, c); return c.lay },
  dateAndPriceRange(d, c) { rangeLayout(d, c); return c.lay },
}

// Layout of the Phase-6 fib uses the same configurable code.
export const fibRetraceLayout = (d, c) => { fibLayout(d, c, false); return c.lay }

// Points to give a new drawing right after the FIRST click (extra anchors start on top of it).
export const initialPoints = (type, p0, spec) => Array.from({ length: Math.max(spec.points, 1) }, () => ({ ...p0 }))
// Called when creation finishes — fills fields that depend on the final shape (e.g. the stop of a position box).
export function finishCreate(d, extra = {}) {
  if (d.type === 'long' || d.type === 'short') {
    const entry = d.points[0].p
    let target = d.points[1].p
    if (target === entry) target = entry + (d.type === 'long' ? 1 : -1) * (extra.minMove || 1) // a plain click still makes a usable box
    return { ...d, points: [d.points[0], { t: d.points[1].t, p: target }], stop: defaultStopFor(entry, target), lots: extra.lots > 0 ? extra.lots : 0.1 }
  }
  return d
}
