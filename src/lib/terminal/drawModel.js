// Phase 11 — drawing records, schema v2. PURE (no DOM / chart library / store).
//
// v1 (Phase 6):  { id, type, points, color, width, dash, locked, text?, offset?, extend? }
// v2 (this):     same fields (kept, so the renderer and old code keep working) PLUS
//   v: 2, name, hidden, z, createdAt,
//   style:      { opacity, lineStyle, extendL, extendR, arrowStart, arrowEnd, fill, fillOpacity, priceLabels, stats, text:{…} }
//   visibility: { tfs: null | ['M5',…], allSymbols }
//   levels / fib (fib tools) · stop / lots (long / short) · dir (arrow marker)
// `dash` and `style.lineStyle` are kept in step: dashed ⇔ dash === true.
import { DRAW_SPECS } from './drawSpecs.js'
import { cleanLevels, defaultFibOpts } from './drawTools.js'

export const DRAW_SCHEMA = 2
export const LINE_STYLES = ['solid', 'dashed', 'dotted']
export const ARROW_ENDS = ['none', 'arrow', 'circle']
export const TF_IDS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']
export const STATS = ['bars', 'pips', 'percent', 'angle']
export const MAX_DRAWINGS = 300

const HEX6 = /^#[0-9a-f]{6}$/i
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clampN = (v, lo, hi, d) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : d)
const pickEnum = (v, list, d) => (list.includes(v) ? v : d)

export const defaultTextStyle = () => ({ size: 12, bold: false, italic: false, color: null, align: 'left', bg: true, border: true })
export const defaultStyle = () => ({
  opacity: 1, lineStyle: 'solid', extendL: false, extendR: false, arrowStart: 'none', arrowEnd: 'none',
  fill: null, fillOpacity: 0.12, priceLabels: true, stats: [], text: defaultTextStyle(),
})
export const defaultVisibility = () => ({ tfs: null, allSymbols: false })

function cleanStyle(s, d) {
  const o = typeof s === 'object' && s ? s : {}
  const t = typeof o.text === 'object' && o.text ? o.text : {}
  const lineStyle = pickEnum(o.lineStyle, LINE_STYLES, d?.dash ? 'dashed' : 'solid')
  return {
    opacity: clampN(o.opacity, 0.05, 1, 1),
    lineStyle,
    extendL: !!o.extendL, extendR: !!o.extendR,
    arrowStart: pickEnum(o.arrowStart, ARROW_ENDS, 'none'), arrowEnd: pickEnum(o.arrowEnd, ARROW_ENDS, 'none'),
    fill: typeof o.fill === 'string' && HEX6.test(o.fill) ? o.fill.toLowerCase() : null,
    fillOpacity: clampN(o.fillOpacity, 0, 1, 0.12),
    priceLabels: o.priceLabels !== false,
    stats: Array.isArray(o.stats) ? o.stats.filter((x) => STATS.includes(x)) : [],
    text: {
      size: Math.round(clampN(t.size, 8, 48, 12)), bold: !!t.bold, italic: !!t.italic,
      color: typeof t.color === 'string' && HEX6.test(t.color) ? t.color.toLowerCase() : null,
      align: pickEnum(t.align, ['left', 'center', 'right'], 'left'), bg: t.bg !== false, border: t.border !== false,
    },
  }
}
function cleanVisibility(v) {
  const o = typeof v === 'object' && v ? v : {}
  const tfs = Array.isArray(o.tfs) ? TF_IDS.filter((t) => o.tfs.includes(t)) : null
  return { tfs: tfs && tfs.length && tfs.length < TF_IDS.length ? tfs : null, allSymbols: !!o.allSymbols }
}

// Any record (old or new, hand-edited or corrupt) -> a complete v2 record, or null when unusable.
// Unknown tools are dropped (never crash on data from a newer / older build).
export function normalizeDrawing(d, now = Math.floor(Date.now() / 1000)) {
  const spec = d && DRAW_SPECS[d.type]
  if (!spec || spec.transient || typeof d.id !== 'string') return null
  if (!Array.isArray(d.points) || d.points.length < spec.points || !d.points.every((q) => q && isNum(q.t) && isNum(q.p))) return null
  const style = cleanStyle(d.style, d)
  const dash = style.lineStyle === 'dashed' ? true : style.lineStyle === 'dotted' ? false : !!d.dash
  const out = {
    v: DRAW_SCHEMA, id: d.id, type: d.type, name: typeof d.name === 'string' ? d.name.slice(0, 40) : '',
    points: d.points.slice(0, spec.points).map((q) => ({ t: q.t, p: q.p })),
    color: typeof d.color === 'string' && HEX6.test(d.color) ? d.color.toLowerCase() : '#38bdf8',
    width: [1, 2, 3, 4, 5, 6].includes(d.width) ? d.width : 2,
    dash: d.style && d.style.lineStyle ? dash : !!d.dash,
    locked: !!d.locked, hidden: !!d.hidden,
    z: isNum(d.z) ? d.z : 0, createdAt: isNum(d.createdAt) ? d.createdAt : now,
    style, visibility: cleanVisibility(d.visibility),
  }
  if (out.dash && out.style.lineStyle === 'solid') out.style.lineStyle = 'dashed'
  if (d.type === 'text' || d.type === 'callout') out.text = String(d.text ?? 'Note').slice(0, 200)
  if (d.type === 'channel') out.offset = isNum(d.offset) ? d.offset : 0
  if (d.type === 'fib' || d.type === 'fibext') {
    out.extend = d.extend !== false
    out.levels = cleanLevels(d.levels, d.type)
    out.fib = { ...defaultFibOpts(), ...Object.fromEntries(Object.entries(typeof d.fib === 'object' && d.fib ? d.fib : {}).filter(([k, v]) => k in defaultFibOpts() && typeof v === 'boolean')) }
  }
  if (d.type === 'long' || d.type === 'short') { if (isNum(d.stop)) out.stop = d.stop; out.lots = isNum(d.lots) && d.lots > 0 ? d.lots : 0.1 }
  if (d.type === 'arrowMarker') out.dir = d.dir === 'down' ? 'down' : 'up'
  return out
}

export function normalizeList(list, now) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const d of list) {
    const n = normalizeDrawing(d, now)
    if (n) out.push(n)
    if (out.length >= MAX_DRAWINGS) break
  }
  return out
}

// ── visibility ───────────────────────────────────────────────────────────
// Visible on this chart? (hidden flag, timeframe filter, and "this symbol only" vs all symbols).
export function isVisible(d, tfId, symbol, ownerSymbol = symbol) {
  if (d.hidden) return false
  if (!d.visibility) return true
  if (d.visibility.tfs && !d.visibility.tfs.includes(tfId)) return false
  if (!d.visibility.allSymbols && ownerSymbol !== symbol) return false
  return true
}
// min / max slider -> timeframe list
export const tfRange = (min, max) => {
  const a = TF_IDS.indexOf(min), b = TF_IDS.indexOf(max)
  if (a < 0 || b < 0) return null
  const lo = Math.min(a, b), hi = Math.max(a, b)
  const r = TF_IDS.slice(lo, hi + 1)
  return r.length === TF_IDS.length ? null : r
}

// ── z-order (array position is drawn order; z keeps it explicit and stable across sync) ──
export const sortByZ = (list) => [...list].sort((a, b) => (a.z || 0) - (b.z || 0))
export const maxZ = (list) => list.reduce((m, d) => Math.max(m, d.z || 0), 0)
export const minZ = (list) => list.reduce((m, d) => Math.min(m, d.z || 0), 0)
export const bringToFront = (list, id) => list.map((d) => (d.id === id ? { ...d, z: maxZ(list) + 1 } : d))
export const sendToBack = (list, id) => list.map((d) => (d.id === id ? { ...d, z: minZ(list) - 1 } : d))
// Swap with the neighbour in draw order (dir: +1 forward, −1 backward). Renumbers z so ties cannot occur.
export function stepZ(list, id, dir) {
  const s = sortByZ(list)
  const i = s.findIndex((d) => d.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= s.length) return list
  ;[s[i], s[j]] = [s[j], s[i]]
  const z = new Map(s.map((d, k) => [d.id, k]))
  return list.map((d) => ({ ...d, z: z.get(d.id) }))
}

// ── clone / paste / nudge ────────────────────────────────────────────────
let cseq = 0
export const cloneId = () => `d${Date.now().toString(36)}c${(++cseq).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
// Copy of a drawing, shifted by `dt` seconds and `dp` price units, with a new id, on top, unlocked.
export function cloneDrawing(d, { dt = 0, dp = 0, z = 0 } = {}) {
  const c = JSON.parse(JSON.stringify(d))
  c.id = cloneId()
  c.points = c.points.map((q) => ({ t: q.t + dt, p: q.p + dp }))
  if (isNum(c.stop)) c.stop += dp
  c.locked = false
  c.z = z
  c.createdAt = Math.floor(Date.now() / 1000)
  if (c.name) c.name = `${c.name} copy`.slice(0, 40)
  return c
}
// Where a pasted copy lands: two bars to the right, five pips below (visibly separate, still on screen).
export const pasteOffset = (tfSec, inst) => ({ dt: 2 * tfSec, dp: -5 * (inst?.pipSize || 1) })
// Arrow-key nudge: one bar sideways, one tick vertically. hline moves only vertically, vline only sideways.
export function nudgePatch(d, dxBars, dyTicks, tfSec, inst) {
  const dt = d.type === 'hline' || d.type === 'hray' ? 0 : dxBars * tfSec
  const dp = d.type === 'vline' ? 0 : dyTicks * 10 ** -inst.digits
  return { points: d.points.map((q) => ({ t: q.t + dt, p: Number((q.p + dp).toFixed(inst.digits)) })), ...(isNum(d.stop) ? { stop: Number((d.stop + dp).toFixed(inst.digits)) } : {}) }
}

// ── undo / redo (snapshots of one symbol's list) ─────────────────────────
export const HIST_LIMIT = 60
export const emptyHist = () => ({ past: [], future: [] })
export const pushHist = (h, symbol, list) => ({ past: [...h.past.slice(-(HIST_LIMIT - 1)), { symbol, list }], future: [] })
export function undoHist(h, cur) { // cur: { symbol, list } (state now) -> { h, entry } ; entry = what to restore
  if (!h.past.length) return { h, entry: null }
  const entry = h.past[h.past.length - 1]
  return { h: { past: h.past.slice(0, -1), future: [...h.future, { symbol: entry.symbol, list: cur.symbol === entry.symbol ? cur.list : null, cur }] }, entry }
}
export function redoHist(h, cur) {
  if (!h.future.length) return { h, entry: null }
  const f = h.future[h.future.length - 1]
  return { h: { past: [...h.past, { symbol: f.cur.symbol, list: cur.symbol === f.cur.symbol ? cur.list : f.cur.list }], future: h.future.slice(0, -1) }, entry: f.cur }
}

// ── templates & per-tool defaults ────────────────────────────────────────
// A "style snapshot" is everything that is look, not geometry.
export function styleOf(d) {
  return JSON.parse(JSON.stringify({ color: d.color, width: d.width, dash: d.dash, style: d.style, ...(d.levels ? { levels: d.levels, fib: d.fib, extend: d.extend } : {}) }))
}
// Apply a snapshot to a new / existing drawing. Geometry, id, text, lock, visibility are never touched.
export function applyStyle(d, snap) {
  if (!snap || typeof snap !== 'object') return d
  const keep = { color: snap.color, width: snap.width, dash: snap.dash, style: snap.style, ...(d.type === 'fib' || d.type === 'fibext' ? { levels: snap.levels, fib: snap.fib, extend: snap.extend } : {}) }
  const merged = { ...d, ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)) }
  return normalizeDrawing(merged) || d
}
export const MAX_TEMPLATES_PER_TOOL = 12
export const cleanDrawPrefs = (raw) => {
  const o = typeof raw === 'object' && raw ? raw : {}
  const defaults = {}
  const templates = {}
  for (const type of Object.keys(DRAW_SPECS)) {
    const dflt = o.defaults?.[type]
    if (dflt && typeof dflt === 'object') defaults[type] = styleOf(normalizeDrawing({ id: 'x', type, points: [{ t: 0, p: 1 }, { t: 1, p: 1 }, { t: 2, p: 1 }], ...dflt }) || { color: '#38bdf8', width: 2, dash: false, style: defaultStyle() })
    const tp = o.templates?.[type]
    if (tp && typeof tp === 'object') {
      const e = Object.entries(tp).slice(0, MAX_TEMPLATES_PER_TOOL).filter(([name, v]) => name && name.length <= 30 && v && typeof v === 'object')
      if (e.length) templates[type] = Object.fromEntries(e.map(([name, v]) => [name, styleOf(normalizeDrawing({ id: 'x', type, points: [{ t: 0, p: 1 }, { t: 1, p: 1 }, { t: 2, p: 1 }], ...v }) || { color: '#38bdf8', width: 2, dash: false, style: defaultStyle() })]))
    }
  }
  const favs = Array.isArray(o.favs) ? o.favs.filter((t) => DRAW_SPECS[t]).slice(0, 8) : ['trend', 'hline', 'rect', 'fib']
  return { defaults, templates, favs, magnet: pickEnum(o.magnet, ['off', 'weak', 'strong'], 'off') }
}

// ── coordinates tab ──────────────────────────────────────────────────────
export const snapToTick = (price, inst) => Number(Number(price).toFixed(inst.digits))
export function parseUtc(text) { // 'YYYY-MM-DD HH:mm' (UTC) -> unix seconds | null
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(text).trim())
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const ms = Date.UTC(y, mo - 1, d, h, mi)
  const back = new Date(ms)
  return back.getUTCMonth() !== mo - 1 ? null : ms / 1000 // rejects 31 Feb etc.
}
export const formatUtc = (sec) => { const d = new Date(sec * 1000); const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` }
// Validated edit of one anchor. Returns { patch } or { error }.
export function editAnchor(d, idx, { price, time }, inst) {
  const pt = d.points[idx]
  if (!pt) return { error: 'No such point' }
  let p = pt.p, t = pt.t
  if (price !== undefined) { const v = Number(price); if (price === '' || !Number.isFinite(v) || v <= 0) return { error: 'Enter a price above 0' }; p = snapToTick(v, inst) }
  if (time !== undefined) { const v = typeof time === 'number' ? time : parseUtc(time); if (v == null) return { error: 'Time must look like 2026-10-12 14:30 (UTC)' }; t = v }
  return { patch: { points: d.points.map((q, i) => (i === idx ? { t, p } : q)) } }
}

// ── magnet (snap to OHLC) ────────────────────────────────────────────────
// weak: only when the pointer is within `tolPrice` of a level; strong: always the nearest level.
export function magnetPrice(candle, price, tolPrice, mode) {
  if (!candle || mode === 'off') return price
  let best = null
  for (const v of [candle.open, candle.high, candle.low, candle.close]) {
    const dist = Math.abs(v - price)
    if (best == null || dist < best.dist) best = { v, dist }
  }
  if (!best) return price
  return mode === 'strong' || best.dist <= tolPrice ? best.v : price
}
