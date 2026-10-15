// Chart drawings — schema, migration and pure editing helpers (Phase 11).
//
// A drawing is stored in DATA space so it stays put when you zoom, scroll or switch timeframe:
//   { id, type, points:[{t: unixSeconds(UTC), p: price}], color, width,
//     style:{opacity,lineStyle,extendLeft,extendRight,arrowStart,arrowEnd,fill,fillColor,fillOpacity,labels,stats,fib*},
//     textStyle:{size,bold,italic,color,align,bg,border}, levels?:[{v,on,color,style}], text?, offset?, extend?, dir?,
//     visibility:{tfMin,tfMax}, z, locked, hidden, createdAt, name }
// Tool geometry lives in drawingTools.js (registry), generic geometry in drawingGeom.js. Everything is
// re-exported from here so older imports keep working. No DOM, no chart library.
import { TIMEFRAMES } from './instruments.js'
import { TOOLS, DRAW_ORDER, BASE_STYLE, BASE_TEXT, LINE_STYLES, ARROW_ENDS, defaultFibLevels, layoutTool } from './drawingTools.js'
import { channelOffset } from './drawingGeom.js'

export * from './drawingGeom.js'
export { TOOLS, DRAW_ORDER, BASE_STYLE, BASE_TEXT, LINE_STYLES, ARROW_ENDS, defaultFibLevels, FIB_LEVELS, FIBEXT_LEVELS, TEXT_H, CATEGORIES, positionStats, buildPosition, specOf } from './drawingTools.js'

export const DRAWING_SCHEMA = 2
export const DRAW_TYPES = Object.fromEntries(Object.entries(TOOLS).map(([id, t]) => [id, { name: t.name, points: t.points, clicks: t.clicks, ...(t.transient ? { transient: true } : {}) }]))
export const DRAW_COLORS = ['#38bdf8', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#f472b6', '#e5e7eb', '#14b8a6']
export const MAX_DRAWINGS_PER_SYMBOL = 300
export const TF_IDS = TIMEFRAMES.map((t) => t.id)

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const HEX = /^#[0-9a-f]{6}$/i
let seq = 0
export const newId = () => `d${Date.now().toString(36)}${(++seq).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

const toolColor = (type) => (type === 'fib' || type === 'fibext' ? '#f59e0b' : type === 'text' || type === 'callout' ? '#e5e7eb' : type === 'arrowmark' ? '#22c55e' : '#38bdf8')

// ── cleaning (every field falls back to its default; unknown keys are dropped) ──
export function cleanStyle(raw, toolStyle = {}) {
  const base = { ...BASE_STYLE, ...toolStyle }
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const [k, d] of Object.entries(base)) {
    const v = r[k]
    if (typeof d === 'boolean') out[k] = typeof v === 'boolean' ? v : d
    else if (k === 'lineStyle') out[k] = LINE_STYLES.includes(v) ? v : d
    else if (k === 'arrowStart' || k === 'arrowEnd') out[k] = ARROW_ENDS.includes(v) ? v : d
    else if (k === 'fillColor') out[k] = typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : ''
    else if (k === 'opacity') out[k] = isNum(v) ? Math.min(1, Math.max(0.1, v)) : d
    else if (k === 'fillOpacity') out[k] = isNum(v) ? Math.min(1, Math.max(0.02, v)) : d
    else out[k] = d
  }
  return out
}
export function cleanTextStyle(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    size: isNum(r.size) ? Math.min(40, Math.max(8, Math.round(r.size))) : BASE_TEXT.size,
    bold: typeof r.bold === 'boolean' ? r.bold : BASE_TEXT.bold,
    italic: typeof r.italic === 'boolean' ? r.italic : BASE_TEXT.italic,
    color: typeof r.color === 'string' && HEX.test(r.color) ? r.color.toLowerCase() : '',
    align: ['left', 'center', 'right'].includes(r.align) ? r.align : BASE_TEXT.align,
    bg: typeof r.bg === 'boolean' ? r.bg : BASE_TEXT.bg,
    border: typeof r.border === 'boolean' ? r.border : BASE_TEXT.border,
  }
}
export function cleanLevels(raw, ext) {
  if (!Array.isArray(raw)) return defaultFibLevels(ext)
  const out = raw.filter((l) => l && isNum(l.v) && Math.abs(l.v) <= 50).slice(0, 24).map((l) => ({
    v: l.v, on: l.on !== false, color: typeof l.color === 'string' && HEX.test(l.color) ? l.color.toLowerCase() : '', style: LINE_STYLES.includes(l.style) ? l.style : 'solid',
  }))
  return out.length ? out : defaultFibLevels(ext)
}
export function cleanVisibility(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  let lo = TF_IDS.indexOf(r.tfMin), hi = TF_IDS.indexOf(r.tfMax)
  if (lo < 0) lo = 0
  if (hi < 0) hi = TF_IDS.length - 1
  if (lo > hi) [lo, hi] = [hi, lo]
  return { tfMin: TF_IDS[lo], tfMax: TF_IDS[hi] }
}
export const visibleOn = (d, tfId) => {
  const v = d.visibility || cleanVisibility()
  const i = TF_IDS.indexOf(tfId)
  return i < 0 || (i >= TF_IDS.indexOf(v.tfMin) && i <= TF_IDS.indexOf(v.tfMax))
}

export function newDrawing(type, points, extra = {}) {
  const spec = TOOLS[type]
  const d = {
    id: newId(), type, points, color: toolColor(type), width: 2,
    style: cleanStyle(extra.style, spec?.style), textStyle: cleanTextStyle(extra.textStyle),
    visibility: cleanVisibility(extra.visibility), z: 0, locked: false, hidden: false, createdAt: Math.floor(Date.now() / 1000), name: '',
    ...(type === 'text' || type === 'callout' ? { text: type === 'text' ? 'Note' : 'Callout' } : {}),
    ...(type === 'channel' ? { offset: 0 } : {}),
    ...(type === 'fib' ? { extend: true } : {}),
    ...(spec?.levels ? { levels: defaultFibLevels(spec.levels === 'ext') } : {}),
    ...(type === 'arrowmark' ? { dir: 'up' } : {}),
    ...extra,
  }
  d.style = cleanStyle(extra.style, spec?.style)
  d.textStyle = cleanTextStyle(extra.textStyle)
  d.visibility = cleanVisibility(extra.visibility)
  return d
}

// Old (schema 1) records and anything hand-edited come in; only valid, fully-populated records come out.
export function cleanDrawings(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const d of list) {
    const spec = d && TOOLS[d.type]
    if (!spec || spec.transient || typeof d.id !== 'string') continue
    if (!Array.isArray(d.points) || d.points.length < spec.points || !d.points.every((q) => q && isNum(q.t) && isNum(q.p))) continue
    const legacyDash = d.dash === true && !(d.style && d.style.lineStyle)
    const style = cleanStyle({ ...(d.style || {}), ...(legacyDash ? { lineStyle: 'dashed' } : {}) }, spec.style)
    out.push({
      id: d.id, type: d.type, points: d.points.slice(0, spec.points).map((q) => ({ t: q.t, p: q.p })),
      color: typeof d.color === 'string' && HEX.test(d.color) ? d.color.toLowerCase() : toolColor(d.type),
      width: Number.isInteger(d.width) && d.width >= 1 && d.width <= 8 ? d.width : 2,
      style, textStyle: cleanTextStyle(d.textStyle),
      visibility: cleanVisibility(d.visibility),
      z: isNum(d.z) ? d.z : out.length, locked: !!d.locked, hidden: !!d.hidden,
      createdAt: isNum(d.createdAt) ? d.createdAt : 0, name: typeof d.name === 'string' ? d.name.slice(0, 40) : '',
      ...(d.type === 'text' || d.type === 'callout' ? { text: String(d.text ?? 'Note').slice(0, 200) } : {}),
      ...(d.type === 'channel' ? { offset: isNum(d.offset) ? d.offset : 0 } : {}),
      ...(d.type === 'fib' ? { extend: d.extend !== false } : {}),
      ...(spec.levels ? { levels: cleanLevels(d.levels, spec.levels === 'ext') } : {}),
      ...(d.type === 'arrowmark' ? { dir: d.dir === 'down' ? 'down' : 'up' } : {}),
    })
    if (out.length >= MAX_DRAWINGS_PER_SYMBOL) break
  }
  return out
}
export const sanitizeDrawings = cleanDrawings

export const layoutOf = layoutTool

// ── editing ──
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
    case 'rect': case 'ellipse': case 'prange': case 'dprange':
      if (idx === 0) pts[0] = { t, p }
      else if (idx === 1) pts[1] = { t, p }
      else if (idx === 2) { pts[1].t = t; pts[0].p = p }
      else { pts[0].t = t; pts[1].p = p }
      return { points: pts }
    case 'channel':
      if (idx === 2) return { offset: channelOffset(d, timeMap, timeMap.toLogical(t), p) }
      pts[idx] = { t, p }
      return { points: pts }
    case 'long': case 'short':
      if (idx === 0) { pts[0] = { t, p }; pts[1].p = p; pts[2].t = t; pts[3].t = t }
      else if (idx === 1) pts[1] = { t, p: pts[0].p }
      else pts[idx].p = p
      return { points: pts }
    default:
      pts[idx] = { t, p }
      return { points: pts }
  }
}

// Which numbers of an anchor can be typed in the Coordinates tab.
export function editableFields(d, idx) {
  if (d.type === 'hline' || d.type === 'hray') return { t: d.type === 'hray', p: true }
  if (d.type === 'vline') return { t: true, p: false }
  if (d.type === 'long' || d.type === 'short') return idx === 0 ? { t: true, p: true } : idx === 1 ? { t: true, p: false } : { t: false, p: true }
  return { t: true, p: true }
}
export const POINT_NAMES = {
  long: ['Entry', 'Right edge', 'Stop', 'Target'], short: ['Entry', 'Right edge', 'Stop', 'Target'],
  fibext: ['A', 'B', 'C'], triangle: ['Point 1', 'Point 2', 'Point 3'], callout: ['Anchor', 'Label'],
}
export const pointName = (d, i) => POINT_NAMES[d.type]?.[i] || (d.points.length === 1 ? 'Point' : `Point ${i + 1}`)

// Type a price / time into one anchor (price snapped to the tick, position tools kept consistent).
export function setAnchor(d, idx, { t, p }, inst) {
  const pts = d.points.map((q) => ({ ...q }))
  const f = editableFields(d, idx)
  if (isNum(t) && f.t) pts[idx].t = Math.round(t)
  if (isNum(p) && f.p && p > 0) pts[idx].p = Number(p.toFixed(inst.digits))
  if (d.type === 'long' || d.type === 'short') {
    pts[1].p = pts[0].p
    if (idx === 0) { pts[2].t = pts[0].t; pts[3].t = pts[0].t }
  }
  return { points: pts }
}

// "YYYY-MM-DD HH:MM" in the chart's time zone <-> unix seconds
const pad = (n) => String(n).padStart(2, '0')
export function fmtDT(t, offsetSec = 0) {
  const x = new Date((t + offsetSec) * 1000)
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`
}
export function parseDT(str, offsetSec = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(str).trim())
  if (!m) return null
  const [y, mo, da, h, mi] = m.slice(1).map(Number)
  const ms = Date.UTC(y, mo - 1, da, h, mi)
  const x = new Date(ms)
  if (x.getUTCFullYear() !== y || x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== da || h > 23 || mi > 59) return null
  return ms / 1000 - offsetSec
}

// Arrow keys: one bar / one tick.
export const nudgePoints = (d, dBars, dTicks, tickSize, timeMap) => movePoints(d, d.points, dBars, dTicks * tickSize, timeMap)

// Magnet: snap an anchor to the open / high / low / close of the bar under it.
// weak = only when within `tolPrice`; strong = always the nearest of the four.
export function magnetSnap(pt, candles, mode, tolPrice = 0) {
  if (mode === 'off' || !candles?.length) return pt
  const i = Math.min(candles.length - 1, Math.max(0, Math.round(pt.l)))
  const c = candles[i]
  let best = null
  for (const v of [c.open, c.high, c.low, c.close]) { const dist = Math.abs(v - pt.p); if (!best || dist < best.dist) best = { v, dist } }
  if (mode === 'weak' && best.dist > tolPrice) return pt
  return { ...pt, p: best.v, t: c.time, l: i }
}

// ── z-order, clone, defaults ──
export const byZ = (list) => [...list].sort((a, b) => a.z - b.z)
export function reorder(list, id, op) {
  const sorted = byZ(list)
  const i = sorted.findIndex((d) => d.id === id)
  if (i < 0) return list
  const [it] = sorted.splice(i, 1)
  const j = op === 'front' ? sorted.length : op === 'back' ? 0 : op === 'up' ? Math.min(sorted.length, i + 1) : Math.max(0, i - 1)
  sorted.splice(j, 0, it)
  return sorted.map((d, k) => ({ ...d, z: k }))
}
export const nextZ = (list) => list.reduce((m, d) => Math.max(m, d.z + 1), 0)

// Copy / paste / clone: a fresh id, moved a little so it is visible, on top.
export function cloneDrawing(d, { dBars = 2, dPrice = 0 } = {}, timeMap, z = 0) {
  return {
    ...JSON.parse(JSON.stringify(d)), id: newId(), z, createdAt: Math.floor(Date.now() / 1000), locked: false,
    points: movePoints(d, d.points, d.type === 'hline' ? 0 : dBars, dPrice, timeMap),
  }
}

// The style part of a drawing (what templates and per-tool defaults store).
export const styleOf = (d) => ({ color: d.color, width: d.width, style: { ...d.style }, textStyle: { ...d.textStyle }, ...(d.levels ? { levels: d.levels.map((l) => ({ ...l })) } : {}) })
export function applyStyle(d, tpl) {
  if (!tpl) return d
  const spec = TOOLS[d.type]
  return {
    ...d,
    color: typeof tpl.color === 'string' && HEX.test(tpl.color) ? tpl.color : d.color,
    width: Number.isInteger(tpl.width) && tpl.width >= 1 && tpl.width <= 8 ? tpl.width : d.width,
    style: cleanStyle({ ...d.style, ...(tpl.style || {}) }, spec?.style),
    textStyle: cleanTextStyle({ ...d.textStyle, ...(tpl.textStyle || {}) }),
    ...(d.levels && tpl.levels ? { levels: cleanLevels(tpl.levels, spec?.levels === 'ext') } : {}),
  }
}
export const cleanTemplateMap = (raw) => {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [tool, list] of Object.entries(raw)) {
    if (!TOOLS[tool] || !Array.isArray(list)) continue
    out[tool] = list.filter((t) => t && typeof t.name === 'string' && t.name).slice(0, 12).map((t) => ({ name: t.name.slice(0, 30), ...styleOf(applyStyle(newDrawing(tool, [{ t: 0, p: 1 }]), t)) }))
  }
  return out
}
export const cleanDefaultsMap = (raw) => {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [tool, tpl] of Object.entries(raw)) if (TOOLS[tool] && tpl && typeof tpl === 'object') out[tool] = styleOf(applyStyle(newDrawing(tool, [{ t: 0, p: 1 }]), tpl))
  return out
}

// ── risk : reward & fib helpers (also used by tests) ──
export const fibPrice = (a, b, lvl) => b.p + (a.p - b.p) * lvl
export const fibExtPrice = (a, b, c, lvl) => c.p + (b.p - a.p) * lvl
