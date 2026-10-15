// Drawing tool registry (Phase 11). Every tool is declared ONCE here: id, name, category, how many
// points / clicks it needs, its default style, how it lays out (drawing + projector -> shapes) and
// which dialog tabs it has. DrawingLayer / toolbar / dialog read this table and never name a tool.
//
// layout(d, proj, view) -> { segs, fills, labels, handles } | null
//   seg   { x1,y1,x2,y2, dash?, alpha?, color?, arrowStart?, arrowEnd?, fibLevel? }
//   fill  { poly, alpha, hit?, main?, color? }   main = the tool's own fill (honours style.fill / fillOpacity)
//   label { x,y,text,align,plain } | { x,y,lines,bw,bh,up,box } | { note:true, ... } (text / callout)
//   handle{ x,y,idx }
import { extendRay, measureInfo, formatDuration } from './drawingGeom.js'
import * as E from './engine.js'

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIBEXT_LEVELS = [0, 0.618, 1, 1.618, 2.618]
export const TEXT_H = 20
export const LINE_STYLES = ['solid', 'dashed', 'dotted']
export const ARROW_ENDS = ['none', 'arrow', 'circle']

export const BASE_STYLE = {
  opacity: 1, lineStyle: 'solid', extendLeft: false, extendRight: false, arrowStart: 'none', arrowEnd: 'none',
  fill: false, fillColor: '', fillOpacity: 0.12, labels: true, stats: false,
  fibPrices: true, fibLevels: true, fibPercent: false, fibTrend: true, fibBg: true, fibReverse: false,
}
export const BASE_TEXT = { size: 12, bold: false, italic: false, color: '', align: 'left', bg: true, border: true }

const estimateWidth = (text, size = 12) => text.length * size * 0.56
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const sgn = (n) => (n >= 0 ? '+' : '−')
const clr = (c) => c || undefined

export const defaultFibLevels = (ext = false) => (ext ? FIBEXT_LEVELS : FIB_LEVELS).map((v) => ({ v, on: true, color: '', style: 'solid' }))

// ── Long / Short position tool maths (matches engine.pnl exactly) ──
// points: [entry, end(time only), stop(price only), target(price only)]
export function positionStats(d, inst, lots = 1) {
  const side = d.type === 'short' ? 'sell' : 'buy'
  const entry = d.points[0].p, stop = d.points[2].p, target = d.points[3].p
  const risk = Math.abs(entry - stop), reward = Math.abs(target - entry)
  const valid = side === 'buy' ? stop < entry && entry < target : stop > entry && entry > target
  const money = (px) => E.roundMoney(E.pnl(side, lots, entry, px, inst))
  return {
    side, entry, stop, target, risk, reward, valid,
    rr: risk > 0 ? reward / risk : null,
    moneyTarget: money(target), moneyStop: money(stop),
    pipsTarget: E.pipsMoved(side, entry, target, inst), pipsStop: E.pipsMoved(side, entry, stop, inst),
  }
}

// default box for a freshly clicked position tool: stop / target from the Settings default pips
export function buildPosition(type, p0, { inst, tfSec, slPips = 20, tpPips = 40 }) {
  const dir = type === 'long' ? 1 : -1
  const r = (n) => Number(n.toFixed(inst.digits))
  return [
    { t: p0.t, p: p0.p },
    { t: p0.t + tfSec * 20, p: p0.p },
    { t: p0.t, p: r(p0.p - dir * slPips * inst.pipSize) },
    { t: p0.t, p: r(p0.p + dir * tpPips * inst.pipSize) },
  ]
}

const statBox = (lay, x, y, lines, up, measure) => lay.labels.push({ x, y, lines, align: 'center', box: true, up, bh: lines.length * 14 + 8, bw: Math.max(...lines.map((s) => measure(s))) + 14 })

// stats text for a 2-point tool
function statLines(a, b, view) {
  if (!view.timeMap || !view.inst) return null
  const m = measureInfo(a, b, view.inst, view.timeMap)
  const s = sgn(m.dp)
  return { m, lines: [`${s}${view.fmt(Math.abs(m.dp))}  (${s}${Math.abs(m.pct).toFixed(2)}%)`, `${m.pips == null ? '' : `${Math.abs(m.pips).toFixed(1)} pips · `}${Math.abs(m.bars)} bars · ${formatDuration(m.secs)}`] }
}

// trend-like line with optional extension / stats
function lineLayout(d, pt, view, { forceL, forceR } = {}) {
  const { w, h } = view
  const st = d.style
  const lay = { segs: [], fills: [], labels: [], handles: [{ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 }] }
  let [x1, y1, x2, y2] = [pt[0].x, pt[0].y, pt[1].x, pt[1].y]
  if (forceL || st.extendLeft) { const e = extendRay(pt[1].x, pt[1].y, pt[0].x, pt[0].y, w, h); x1 = e.x; y1 = e.y }
  if (forceR || st.extendRight) { const e = extendRay(pt[0].x, pt[0].y, pt[1].x, pt[1].y, w, h); x2 = e.x; y2 = e.y }
  lay.segs.push({ x1, y1, x2, y2, arrowStart: st.arrowStart, arrowEnd: st.arrowEnd })
  if (st.stats) {
    const s = statLines(d.points[0], d.points[1], view)
    if (s) statBox(lay, (pt[0].x + pt[1].x) / 2, s.m.up ? Math.min(pt[0].y, pt[1].y) - 8 : Math.max(pt[0].y, pt[1].y) + 8, s.lines, s.m.up, view.measure)
  }
  return lay
}

function rectLike(pt, lay) {
  const [a, b] = pt
  lay.handles.push({ ...a, idx: 0 }, { ...b, idx: 1 }, { x: b.x, y: a.y, idx: 2 }, { x: a.x, y: b.y, idx: 3 })
}
function boxPoly(a, b) { return [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]] }
function boxSegs(lay, a, b, o = {}) {
  const s = (x1, y1, x2, y2) => lay.segs.push({ x1, y1, x2, y2, ...o })
  s(a.x, a.y, b.x, a.y); s(b.x, a.y, b.x, b.y); s(b.x, b.y, a.x, b.y); s(a.x, b.y, a.x, a.y)
}

function fibLayout(d, proj, view, pt, ext) {
  const st = d.style
  const [A, B, C] = d.points
  const xl = Math.min(...pt.map((q) => q.x))
  const xr = d.extend === false ? Math.max(...pt.map((q) => q.x)) : Math.max(view.w, ...pt.map((q) => q.x))
  const lay = { segs: [], fills: [], labels: [], handles: pt.map((q, idx) => ({ ...q, idx })) }
  const priceOf = (v) => {
    if (ext) return C.p + (B.p - A.p) * v
    const [hi, lo] = st.fibReverse ? [B, A] : [A, B]
    return lo.p + (hi.p - lo.p) * v // 0 at the 2nd anchor, 1 at the 1st
  }
  let prev = null
  const levels = d.levels.filter((l) => l.on)
  levels.forEach((lv, i) => {
    const price = priceOf(lv.v)
    const y = proj.y(price)
    if (y == null) return
    lay.segs.push({ x1: xl, y1: y, x2: xr, y2: y, alpha: lv.v === 0 || lv.v === 1 ? 1 : 0.8, fibLevel: lv.v, color: clr(lv.color), dash: lv.style === 'dashed' ? true : undefined, dotted: lv.style === 'dotted' })
    const parts = []
    if (st.fibLevels) parts.push(st.fibPercent ? `${+(lv.v * 100).toFixed(1)}%` : String(lv.v))
    if (st.fibPrices) parts.push(`(${view.fmt(price)})`)
    if (st.labels && parts.length) lay.labels.push({ x: xl + 4, y: y - 3, text: parts.join(' '), align: 'left', plain: true, color: clr(lv.color) })
    if (st.fibBg && prev != null && i % 2 === 1) lay.fills.push({ poly: [[xl, prev], [xr, prev], [xr, y], [xl, y]], alpha: 0.07 })
    prev = y
  })
  if (st.fibTrend) {
    lay.segs.push({ x1: pt[0].x, y1: pt[0].y, x2: pt[1].x, y2: pt[1].y, dash: true, alpha: 0.7 })
    if (ext) lay.segs.push({ x1: pt[1].x, y1: pt[1].y, x2: pt[2].x, y2: pt[2].y, dash: true, alpha: 0.7 })
  }
  return lay
}

function positionLayout(d, proj, view, pt) {
  const [E0, W, S, T] = pt
  const x0 = E0.x, x1 = W.x, yE = E0.y, yS = S.y, yT = T.y
  const s = positionStats(d, view.inst, view.lots || 1)
  const lay = { segs: [], fills: [], labels: [], handles: [{ x: x0, y: yE, idx: 0 }, { x: x1, y: yE, idx: 1 }, { x: (x0 + x1) / 2, y: yS, idx: 2 }, { x: (x0 + x1) / 2, y: yT, idx: 3 }] }
  lay.fills.push({ poly: [[x0, yE], [x1, yE], [x1, yT], [x0, yT]], alpha: 0.18, hit: true, color: '#22c55e' })
  lay.fills.push({ poly: [[x0, yE], [x1, yE], [x1, yS], [x0, yS]], alpha: 0.18, hit: true, color: '#ef4444' })
  lay.segs.push({ x1: x0, y1: yE, x2: x1, y2: yE, color: '#94a3b8' }, { x1: x0, y1: yS, x2: x1, y2: yS, color: '#ef4444' }, { x1: x0, y1: yT, x2: x1, y2: yT, color: '#22c55e' })
  if (view.inst && st(d).labels) {
    const f = (n) => `${sgn(n)}$${Math.abs(n).toFixed(2)}`
    statBox(lay, (x0 + x1) / 2, yT < yE ? yT - 4 : yT + 4, [`Target ${view.fmt(s.target)}`, `${f(s.moneyTarget)} · ${sgn(s.pipsTarget)}${Math.abs(s.pipsTarget).toFixed(1)} pips`], yT < yE, view.measure)
    statBox(lay, (x0 + x1) / 2, yS < yE ? yS - 4 : yS + 4, [`Stop ${view.fmt(s.stop)}`, `${f(s.moneyStop)} · ${sgn(s.pipsStop)}${Math.abs(s.pipsStop).toFixed(1)} pips`], false, view.measure)
    if (s.rr != null) lay.labels.push({ x: x0 + 6, y: yE - 8, text: `R:R ${s.rr.toFixed(2)}${s.valid ? '' : ' (invalid)'}`, align: 'left', plain: true, color: s.valid ? undefined : '#f59e0b' })
  }
  return lay
}
const st = (d) => d.style

function textLayout(d, pt, view, withBox) {
  const ts = d.textStyle
  const text = d.text || 'Note'
  const size = ts.size
  const tw = (view.measure || estimateWidth)(text) * (size / 11) + 14
  const th = size + 8
  const lay = { segs: [], fills: [], labels: [], handles: [{ ...pt[0], idx: 0 }] }
  lay.labels.push({ x: pt[0].x, y: pt[0].y, text, align: 'left', note: true, bw: tw, bh: th })
  lay.fills.push({ poly: [[pt[0].x, pt[0].y - th / 2], [pt[0].x + tw, pt[0].y - th / 2], [pt[0].x + tw, pt[0].y + th / 2], [pt[0].x, pt[0].y + th / 2]], alpha: 0, hit: true })
  return { lay, tw, th, withBox }
}

export const TOOLS = {
  trend: { name: 'Trend line', category: 'Lines', points: 2, clicks: 2, icon: 'TrendingUp', tabs: ['style', 'coords', 'vis'], layout: (d, p, v, pt) => lineLayout(d, pt, v) },
  ray: { name: 'Ray', category: 'Lines', points: 2, clicks: 2, icon: 'MoveUpRight', tabs: ['style', 'coords', 'vis'], style: { extendRight: true }, layout: (d, p, v, pt) => lineLayout(d, pt, v, { forceR: true }) },
  extline: { name: 'Extended line', category: 'Lines', points: 2, clicks: 2, icon: 'Slash', tabs: ['style', 'coords', 'vis'], layout: (d, p, v, pt) => lineLayout(d, pt, v, { forceL: true, forceR: true }) },
  arrow: { name: 'Arrow', category: 'Lines', points: 2, clicks: 2, icon: 'ArrowUpRight', tabs: ['style', 'coords', 'vis'], style: { arrowEnd: 'arrow' }, layout: (d, p, v, pt) => lineLayout(d, pt, v) },
  hline: {
    name: 'Horizontal line', category: 'Lines', points: 1, clicks: 1, icon: 'Minus', tabs: ['style', 'coords', 'vis'],
    layout: (d, p, v, pt) => {
      const y = pt[0].y
      const lay = { segs: [{ x1: 0, y1: y, x2: v.w, y2: y }], fills: [], labels: [], handles: [{ x: clamp(pt[0].x, 14, v.w - 14), y, idx: 0 }] }
      if (d.style.labels) lay.labels.push({ x: v.w - 6, y: y - 3, text: v.fmt(d.points[0].p), align: 'right', plain: true })
      return lay
    },
  },
  hray: {
    name: 'Horizontal ray', category: 'Lines', points: 1, clicks: 1, icon: 'ArrowRight', tabs: ['style', 'coords', 'vis'],
    layout: (d, p, v, pt) => {
      const lay = { segs: [{ x1: pt[0].x, y1: pt[0].y, x2: v.w, y2: pt[0].y, arrowEnd: d.style.arrowEnd }], fills: [], labels: [], handles: [{ ...pt[0], idx: 0 }] }
      if (d.style.labels) lay.labels.push({ x: v.w - 6, y: pt[0].y - 3, text: v.fmt(d.points[0].p), align: 'right', plain: true })
      return lay
    },
  },
  vline: {
    name: 'Vertical line', category: 'Lines', points: 1, clicks: 1, icon: 'GripVertical', tabs: ['style', 'coords', 'vis'],
    layout: (d, p, v, pt) => ({ segs: [{ x1: pt[0].x, y1: 0, x2: pt[0].x, y2: v.h }], fills: [], labels: [], handles: [{ x: pt[0].x, y: clamp(pt[0].y, 14, v.h - 14), idx: 0 }] }),
  },
  channel: {
    name: 'Parallel channel', category: 'Lines', points: 2, clicks: 3, icon: 'Columns2', tabs: ['style', 'coords', 'vis'], style: { fill: true },
    layout: (d, proj, v, pt) => {
      const [a, b] = d.points
      const off = d.offset || 0
      const y1 = proj.y(a.p + off), y2 = proj.y(b.p + off)
      if (y1 == null || y2 == null) return null
      const lay = { segs: [], fills: [], labels: [], handles: [{ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 }, { x: (pt[0].x + pt[1].x) / 2, y: (y1 + y2) / 2, idx: 2 }] }
      lay.segs.push({ x1: pt[0].x, y1: pt[0].y, x2: pt[1].x, y2: pt[1].y }, { x1: pt[0].x, y1: y1, x2: pt[1].x, y2: y2 }, { x1: pt[0].x, y1: (pt[0].y + y1) / 2, x2: pt[1].x, y2: (pt[1].y + y2) / 2, dash: true, alpha: 0.6 })
      lay.fills.push({ poly: [[pt[0].x, pt[0].y], [pt[1].x, pt[1].y], [pt[1].x, y2], [pt[0].x, y1]], alpha: 0.1, main: true })
      return lay
    },
  },
  fib: { name: 'Fib retracement', category: 'Fibonacci', points: 2, clicks: 2, icon: 'Waypoints', tabs: ['style', 'levels', 'coords', 'vis'], levels: true, layout: (d, p, v, pt) => fibLayout(d, p, v, pt, false) },
  fibext: { name: 'Fib extension', category: 'Fibonacci', points: 3, clicks: 3, icon: 'ChartNoAxesGantt', tabs: ['style', 'levels', 'coords', 'vis'], levels: 'ext', layout: (d, p, v, pt) => fibLayout(d, p, v, pt, true) },
  rect: {
    name: 'Rectangle', category: 'Shapes', points: 2, clicks: 2, icon: 'Square', tabs: ['style', 'coords', 'vis'], style: { fill: true },
    layout: (d, p, v, pt) => {
      const lay = { segs: [], fills: [{ poly: boxPoly(pt[0], pt[1]), alpha: 0.12, hit: true, main: true }], labels: [], handles: [] }
      boxSegs(lay, pt[0], pt[1]); rectLike(pt, lay)
      return lay
    },
  },
  ellipse: {
    name: 'Ellipse', category: 'Shapes', points: 2, clicks: 2, icon: 'Circle', tabs: ['style', 'coords', 'vis'], style: { fill: true },
    layout: (d, p, v, pt) => {
      const cx = (pt[0].x + pt[1].x) / 2, cy = (pt[0].y + pt[1].y) / 2, rx = Math.abs(pt[1].x - pt[0].x) / 2, ry = Math.abs(pt[1].y - pt[0].y) / 2
      const ring = Array.from({ length: 48 }, (_, i) => [cx + rx * Math.cos((i / 48) * Math.PI * 2), cy + ry * Math.sin((i / 48) * Math.PI * 2)])
      const lay = { segs: ring.map((q, i) => ({ x1: q[0], y1: q[1], x2: ring[(i + 1) % 48][0], y2: ring[(i + 1) % 48][1] })), fills: [{ poly: ring, alpha: 0.12, hit: true, main: true }], labels: [], handles: [] }
      rectLike(pt, lay)
      return lay
    },
  },
  triangle: {
    name: 'Triangle', category: 'Shapes', points: 3, clicks: 3, icon: 'Triangle', tabs: ['style', 'coords', 'vis'], style: { fill: true },
    layout: (d, p, v, pt) => ({
      segs: [[0, 1], [1, 2], [2, 0]].map(([i, j]) => ({ x1: pt[i].x, y1: pt[i].y, x2: pt[j].x, y2: pt[j].y })),
      fills: [{ poly: pt.map((q) => [q.x, q.y]), alpha: 0.12, hit: true, main: true }], labels: [], handles: pt.map((q, idx) => ({ ...q, idx })),
    }),
  },
  text: {
    name: 'Text note', category: 'Annotation', points: 1, clicks: 1, icon: 'Type', tabs: ['style', 'text', 'coords', 'vis'],
    layout: (d, p, v, pt) => textLayout(d, pt, v, true).lay,
  },
  callout: {
    name: 'Callout', category: 'Annotation', points: 2, clicks: 2, icon: 'MessageSquare', tabs: ['style', 'text', 'coords', 'vis'],
    layout: (d, p, v, pt) => {
      const { lay, tw, th } = textLayout(d, [pt[1]], v, true)
      lay.segs.push({ x1: pt[0].x, y1: pt[0].y, x2: pt[1].x + tw / 2, y2: pt[1].y + (pt[0].y > pt[1].y ? th / 2 : -th / 2), arrowStart: 'circle' })
      lay.handles = [{ ...pt[0], idx: 0 }, { ...pt[1], idx: 1 }]
      return lay
    },
  },
  arrowmark: {
    name: 'Arrow marker', category: 'Annotation', points: 1, clicks: 1, icon: 'ArrowBigUp', tabs: ['style', 'coords', 'vis'], style: { fill: true, fillOpacity: 1 },
    layout: (d, p, v, pt) => {
      const { x, y } = pt[0], u = d.dir === 'down' ? -1 : 1
      const poly = [[x, y], [x - 9, y + u * 11], [x - 4, y + u * 11], [x - 4, y + u * 24], [x + 4, y + u * 24], [x + 4, y + u * 11], [x + 9, y + u * 11]]
      return { segs: poly.map((q, i) => ({ x1: q[0], y1: q[1], x2: poly[(i + 1) % poly.length][0], y2: poly[(i + 1) % poly.length][1] })), fills: [{ poly, alpha: 1, hit: true, main: true }], labels: [], handles: [{ x, y, idx: 0 }] }
    },
  },
  long: { name: 'Long position', category: 'Trading tools', points: 4, clicks: 1, icon: 'TrendingUp', tabs: ['style', 'coords', 'vis'], position: true, layout: (d, p, v, pt) => positionLayout(d, p, v, pt) },
  short: { name: 'Short position', category: 'Trading tools', points: 4, clicks: 1, icon: 'TrendingDown', tabs: ['style', 'coords', 'vis'], position: true, layout: (d, p, v, pt) => positionLayout(d, p, v, pt) },
  measure: {
    name: 'Measure', category: 'Measure', points: 2, clicks: 2, icon: 'Ruler', transient: true, tabs: [],
    layout: (d, p, v, pt) => {
      const [a, b] = pt
      const lay = { segs: [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y, arrowEnd: 'arrow' }], fills: [{ poly: boxPoly(a, b), alpha: 0.12, hit: true }], labels: [], handles: [] }
      const s = statLines(d.points[0], d.points[1], v)
      if (s) { statBox(lay, (a.x + b.x) / 2, s.m.up ? Math.min(a.y, b.y) - 8 : Math.max(a.y, b.y) + 8, s.lines, s.m.up, v.measure); lay.measureUp = s.m.up }
      return lay
    },
  },
  prange: {
    name: 'Price range', category: 'Measure', points: 2, clicks: 2, icon: 'MoveVertical', tabs: ['style', 'coords', 'vis'], style: { fill: true, stats: true },
    layout: (d, p, v, pt) => {
      const [a, b] = pt
      const mx = (a.x + b.x) / 2
      const lay = { segs: [{ x1: mx, y1: a.y, x2: mx, y2: b.y, arrowEnd: 'arrow', arrowStart: 'arrow' }, { x1: a.x, y1: a.y, x2: b.x, y2: a.y, dash: true }, { x1: a.x, y1: b.y, x2: b.x, y2: b.y, dash: true }], fills: [{ poly: boxPoly(a, b), alpha: 0.1, hit: true, main: true }], labels: [], handles: [] }
      rectLike(pt, lay)
      const m = v.inst && v.timeMap ? measureInfo(d.points[0], d.points[1], v.inst, v.timeMap) : null
      if (m && d.style.stats) statBox(lay, mx, m.up ? Math.min(a.y, b.y) - 8 : Math.max(a.y, b.y) + 8, [`${sgn(m.dp)}${v.fmt(Math.abs(m.dp))} (${sgn(m.dp)}${Math.abs(m.pct).toFixed(2)}%)`, `${m.pips == null ? '' : `${Math.abs(m.pips).toFixed(1)} pips`}`], m.up, v.measure)
      return lay
    },
  },
  drange: {
    name: 'Date range', category: 'Measure', points: 2, clicks: 2, icon: 'MoveHorizontal', tabs: ['style', 'coords', 'vis'], style: { fill: true, stats: true },
    layout: (d, p, v, pt) => {
      const [a, b] = pt
      const my = (a.y + b.y) / 2
      const lay = { segs: [{ x1: a.x, y1: 0, x2: a.x, y2: v.h, dash: true }, { x1: b.x, y1: 0, x2: b.x, y2: v.h, dash: true }, { x1: a.x, y1: my, x2: b.x, y2: my, arrowEnd: 'arrow', arrowStart: 'arrow' }], fills: [{ poly: [[a.x, 0], [b.x, 0], [b.x, v.h], [a.x, v.h]], alpha: 0.08, hit: true, main: true }], labels: [], handles: [{ ...a, idx: 0 }, { ...b, idx: 1 }] }
      const m = v.inst && v.timeMap ? measureInfo(d.points[0], d.points[1], v.inst, v.timeMap) : null
      if (m && d.style.stats) statBox(lay, (a.x + b.x) / 2, my - 10, [`${Math.abs(m.bars)} bars`, formatDuration(m.secs)], true, v.measure)
      return lay
    },
  },
  dprange: {
    name: 'Date and price range', category: 'Measure', points: 2, clicks: 2, icon: 'Scan', tabs: ['style', 'coords', 'vis'], style: { fill: true, stats: true },
    layout: (d, p, v, pt) => {
      const [a, b] = pt
      const lay = { segs: [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y, arrowEnd: 'arrow' }], fills: [{ poly: boxPoly(a, b), alpha: 0.1, hit: true, main: true }], labels: [], handles: [] }
      boxSegs(lay, a, b); rectLike(pt, lay)
      const s = d.style.stats ? statLines(d.points[0], d.points[1], v) : null
      if (s) statBox(lay, (a.x + b.x) / 2, s.m.up ? Math.min(a.y, b.y) - 8 : Math.max(a.y, b.y) + 8, s.lines, s.m.up, v.measure)
      return lay
    },
  },
}

export const CATEGORIES = ['Lines', 'Fibonacci', 'Shapes', 'Annotation', 'Trading tools', 'Measure']
export const DRAW_ORDER = Object.keys(TOOLS)
export const specOf = (type) => TOOLS[type]

export function layoutTool(d, proj, view) {
  const spec = TOOLS[d.type]
  if (!spec) return null
  const pt = d.points.map((q) => ({ x: proj.x(q.t), y: proj.y(q.p) }))
  if (pt.some((q) => q.x == null || q.y == null)) return null
  const lay = spec.layout(d, proj, { ...view, fmt: view.fmt || ((n) => String(n)), measure: view.measure || estimateWidth }, pt)
  return lay
}
