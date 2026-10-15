// Chart appearance + chart-trading display settings (Phase 9).
//
// Everything here is pure data / pure functions (no DOM, no chart library), so it is unit-testable
// in plain node. The ONLY place that pushes these values into a live lightweight-charts instance
// is chartApply.js.
//
// Shape (every leaf has a default; unknown keys are dropped; bad values fall back to the default):
//   theme   preset id ('dark' | 'midnight' | 'black' | 'light' | 'paper' | 'matrix' | 'system' | 'custom')
//   symbol  candle colours, chart-type options, precision, time zone
//   status  which parts of the OHLC status line are shown
//   scales  price scale, price lines / labels, time scale, crosshair
//   canvas  background, grid, text, watermark
//   trading what the chart shows about positions / orders
//   alerts  toast length

import { EVENTS } from './eventCatalog.js'
import { SOUND_IDS, PACK_IDS } from './soundDesign.js'

export const CHART_SETTINGS_VERSION = 1

export const CHART_TYPES = [
  { id: 'candles', label: 'Candles' },
  { id: 'hollow', label: 'Hollow candles' },
  { id: 'bars', label: 'Bars (OHLC)' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'heikin', label: 'Heikin Ashi' },
]
export const CHART_TYPE_IDS = CHART_TYPES.map((t) => t.id)

export const TIME_ZONES = [
  { id: 'local', label: 'Local (this device)' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Kolkata', label: 'India (IST)' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
]

export const DEFAULT_CHART_SETTINGS = {
  v: CHART_SETTINGS_VERSION,
  theme: 'dark',
  symbol: {
    up: '#16a34a', down: '#dc2626',
    bodyOn: true, borderOn: false, wickOn: true,
    borderUp: '#16a34a', borderDown: '#dc2626',
    wickUp: '#16a34a', wickDown: '#dc2626',
    colorByPrev: false, // colour a bar by close vs the PREVIOUS close instead of close vs its own open
    precision: 'auto', // 'auto' | '0'..'8'
    tz: 'local',
    thinBars: false,
    lineSource: 'close', lineColor: '#38bdf8', lineWidth: 2, lineType: 'simple', // simple | steps | curved
    areaTop: '#38bdf866', areaBottom: '#38bdf805',
    baseColorUp: '#16a34a', baseColorDown: '#dc2626',
  },
  status: {
    symbol: true, desc: false, marketDot: true, ohlc: true, change: true, volume: false,
    indTitles: true, indArgs: false, indValues: true, positions: true, opacity: 1,
  },
  scales: {
    mode: 'normal', // normal | log | percent | index100
    autoScale: true, invert: false, lock: false,
    placement: 'right', // right | left
    borderVisible: true, noOverlap: true,
    marginTop: 0.1, marginBottom: 0.1,
    lastLabel: true, lastLine: true,
    lastLineColor: '#60a5fa', lastLineStyle: 'dashed', lastLineWidth: 1,
    prevClose: false, prevCloseColor: '#94a3b8', prevCloseStyle: 'dotted', prevCloseWidth: 1,
    bid: false, bidColor: '#ef4444', bidStyle: 'dashed', bidWidth: 1,
    ask: false, askColor: '#22c55e', askStyle: 'dashed', askWidth: 1,
    hiLo: false, hiLoColor: '#fbbf24',
    countdown: false,
    barSpacing: 6, rightOffset: 6, seconds: false, h24: true,
    dateFormat: 'dd MMM yy', // dd MMM yy | dd-MM-yyyy | MM-dd-yyyy | yyyy-MM-dd
    lockLast: false,
    crosshairMode: 'normal', // normal | magnet
    crosshairColor: '#758696', crosshairWidth: 1, crosshairStyle: 'dashed', crosshairLabels: true,
  },
  canvas: {
    bgType: 'solid', bg: '#0f1419', bg2: '#0b1016', // bg2 = bottom colour of the gradient
    textColor: '#9aa4b2', fontSize: 11,
    gridV: true, gridVColor: '#1b232d', gridVStyle: 'solid',
    gridH: true, gridHColor: '#1b232d', gridHStyle: 'solid',
    borderColor: '#27313d', paneSep: '#27313d',
    wmMode: 'off', // off | symbol | symbolTf | custom
    wmText: '', wmColor: '#ffffff', wmOpacity: 0.07, wmSize: 48, wmPos: 'center', // center | tl | tr | bl | br
  },
  trading: {
    showPositions: true, showOrders: true, showExecutions: false,
    plUnit: 'money', // money | pips | points | percent | r
    colorBuy: '#22c55e', colorSell: '#ef4444', colorSL: '#ef4444', colorTP: '#22c55e', colorBuyPending: '#60a5fa', colorSellPending: '#f59e0b',
    lineStyle: 'dashed', lineWidth: 1,
    confirmClose: false, confirmCancel: false,
    // Phase 10 — managing positions on the chart
    showPlPill: true, reverseBtn: true, extendLines: true,
    snap: 'off', // off | round | bars
    defSlUnit: 'pips', defSlValue: 20, defTpUnit: 'pips', defTpValue: 40, // pips | percent | atr
    marginWarn: 100,
  },
  alerts: {
    toastSeconds: 4.5,
  },
  // Phase 13: motion. mode full | reduced | off · popup full | toast | off
  anim: {
    mode: 'full', matchSystem: true, popup: 'full', popupSeconds: 1.6, popupPos: 'top', alsoToast: true,
    chartFx: true, particles: true, shake: true, rows: true,
  },
  // Phase 12: sound engine. The master on/off lives in the terminal settings (`settings.sound`, synced too).
  sounds: {
    volume: 80, muteBackground: true, vibrate: false, pack: 'classic',
    events: Object.fromEntries(EVENTS.map((e) => [e.id, { on: e.defaultOn, volume: 100, sound: 'default' }])),
  },
}

// ── validation tables ────────────────────────────────────────────────────
const ENUMS = {
  theme: ['dark', 'midnight', 'black', 'light', 'paper', 'matrix', 'system', 'custom'],
  'symbol.precision': ['auto', '0', '1', '2', '3', '4', '5', '6', '7', '8'],
  'symbol.tz': TIME_ZONES.map((t) => t.id),
  'symbol.lineSource': ['close', 'open', 'high', 'low', 'hl2'],
  'symbol.lineType': ['simple', 'steps', 'curved'],
  'scales.mode': ['normal', 'log', 'percent', 'index100'],
  'scales.placement': ['right', 'left'],
  'scales.dateFormat': ['dd MMM yy', 'dd-MM-yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'],
  'scales.crosshairMode': ['normal', 'magnet'],
  'canvas.bgType': ['solid', 'gradient'],
  'canvas.wmMode': ['off', 'symbol', 'symbolTf', 'custom'],
  'canvas.wmPos': ['center', 'tl', 'tr', 'bl', 'br'],
  'trading.plUnit': ['money', 'pips', 'points', 'percent', 'r'],
  'trading.snap': ['off', 'round', 'bars'],
  'trading.defSlUnit': ['pips', 'percent', 'atr'],
  'trading.defTpUnit': ['pips', 'percent', 'atr'],
  'trading.lineStyle': ['solid', 'dashed', 'dotted'],
}
ENUMS['sounds.pack'] = PACK_IDS
ENUMS['anim.mode'] = ['full', 'reduced', 'off']
ENUMS['anim.popup'] = ['full', 'toast', 'off']
ENUMS['anim.popupPos'] = ['top', 'bottom']
for (const k of ['lastLineStyle', 'prevCloseStyle', 'bidStyle', 'askStyle', 'crosshairStyle']) ENUMS[`scales.${k}`] = ['solid', 'dashed', 'dotted']
for (const k of ['gridVStyle', 'gridHStyle']) ENUMS[`canvas.${k}`] = ['solid', 'dashed', 'dotted']

const RANGES = {
  'anim.popupSeconds': [1, 4],
  'sounds.volume': [0, 100],
  'symbol.lineWidth': [1, 6],
  'status.opacity': [0.2, 1],
  'scales.marginTop': [0, 0.45], 'scales.marginBottom': [0, 0.45],
  'scales.lastLineWidth': [1, 4], 'scales.prevCloseWidth': [1, 4], 'scales.bidWidth': [1, 4], 'scales.askWidth': [1, 4],
  'scales.barSpacing': [2, 40], 'scales.rightOffset': [0, 100],
  'scales.crosshairWidth': [1, 4],
  'canvas.fontSize': [8, 20],
  'canvas.wmOpacity': [0.02, 0.5], 'canvas.wmSize': [16, 140],
  'trading.lineWidth': [1, 4],
  'trading.defSlValue': [0.1, 10000], 'trading.defTpValue': [0.1, 10000],
  'trading.marginWarn': [50, 1000],
  'alerts.toastSeconds': [1, 15],
  v: [1, 1000],
}

for (const e of EVENTS) { ENUMS[`sounds.events.${e.id}.sound`] = ['default', ...SOUND_IDS]; RANGES[`sounds.events.${e.id}.volume`] = [0, 100] }

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

function clean(raw, def, path) {
  const out = {}
  for (const [k, d] of Object.entries(def)) {
    const p = path ? `${path}.${k}` : k
    const v = isObj(raw) ? raw[k] : undefined
    if (isObj(d)) { out[k] = clean(v, d, p); continue }
    if (typeof d === 'boolean') { out[k] = typeof v === 'boolean' ? v : d; continue }
    if (typeof d === 'number') {
      const [lo, hi] = RANGES[p] || [-1e9, 1e9]
      out[k] = typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d
      continue
    }
    if (ENUMS[p]) { out[k] = ENUMS[p].includes(v) ? v : d; continue }
    if (HEX.test(d)) { out[k] = typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d; continue }
    out[k] = typeof v === 'string' ? v.slice(0, 60) : d // free text (watermark)
  }
  return out
}

// Always returns a complete, valid settings object — whatever came in (old save, cloud row, junk).
export function cleanChartSettings(raw) {
  const o = clean(raw, DEFAULT_CHART_SETTINGS, '')
  o.v = CHART_SETTINGS_VERSION
  return o
}

// Deep-merge a partial patch ({ canvas: { bg: '#000000' } }) into the current settings and re-validate.
export function mergeChartSettings(cur, patch) {
  const rec = (a, b) => {
    const o = { ...a }
    for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(a?.[k]) ? rec(a[k], v) : v
    return o
  }
  const base = cleanChartSettings(cur)
  const o = clean(rec(base, patch), base, '') // a bad value keeps what was there before (not the factory default)
  o.v = CHART_SETTINGS_VERSION
  return o
}

// ── themes ───────────────────────────────────────────────────────────────
// `chrome` feeds the CSS variables of the whole terminal (--tm-*); `canvas` / `scales` overlay the chart.
// Candle colours are NOT part of a theme (they are the person's own choice) except for 'matrix'.
const DARK_CHROME = { bg: '#0f1419', panel: '#131a22', panel2: '#10161d', deep: '#0b1016', border: '#27313d', border2: '#334155', active: '#334155', muted: '#9aa4b2', text: '#e5e7eb', light: false }

export const THEMES = {
  dark: { label: 'Dark', chrome: DARK_CHROME, canvas: { bgType: 'solid', bg: '#0f1419', bg2: '#0b1016', textColor: '#9aa4b2', gridVColor: '#1b232d', gridHColor: '#1b232d', borderColor: '#27313d', paneSep: '#27313d', wmColor: '#ffffff' }, scales: { crosshairColor: '#758696' } },
  midnight: { label: 'Midnight blue', chrome: { bg: '#0a1224', panel: '#0e1a33', panel2: '#0c1629', deep: '#070d1b', border: '#1f3158', border2: '#2c4474', active: '#2c4474', muted: '#8aa0c8', text: '#e6edff', light: false }, canvas: { bgType: 'solid', bg: '#0a1224', bg2: '#070d1b', textColor: '#8aa0c8', gridVColor: '#12203f', gridHColor: '#12203f', borderColor: '#1f3158', paneSep: '#1f3158', wmColor: '#ffffff' }, scales: { crosshairColor: '#6f87b5' } },
  black: { label: 'Pure black', chrome: { bg: '#000000', panel: '#0a0a0a', panel2: '#050505', deep: '#000000', border: '#222222', border2: '#333333', active: '#333333', muted: '#9a9a9a', text: '#f1f1f1', light: false }, canvas: { bgType: 'solid', bg: '#000000', bg2: '#000000', textColor: '#9a9a9a', gridVColor: '#141414', gridHColor: '#141414', borderColor: '#222222', paneSep: '#222222', wmColor: '#ffffff' }, scales: { crosshairColor: '#777777' } },
  light: { label: 'Light', chrome: { bg: '#ffffff', panel: '#f1f5f9', panel2: '#e8eef5', deep: '#e2e8f0', border: '#cbd5e1', border2: '#b6c2d1', active: '#475569', muted: '#475569', text: '#0f172a', light: true }, canvas: { bgType: 'solid', bg: '#ffffff', bg2: '#f1f5f9', textColor: '#475569', gridVColor: '#eef2f6', gridHColor: '#eef2f6', borderColor: '#cbd5e1', paneSep: '#cbd5e1', wmColor: '#000000' }, scales: { crosshairColor: '#64748b' } },
  paper: { label: 'Paper', chrome: { bg: '#faf6ec', panel: '#f3ecda', panel2: '#ece3cc', deep: '#e6dcc2', border: '#d6c9a8', border2: '#c2b48e', active: '#6b5f45', muted: '#6b5f45', text: '#2b2415', light: true }, canvas: { bgType: 'solid', bg: '#faf6ec', bg2: '#f3ecda', textColor: '#6b5f45', gridVColor: '#efe7d2', gridHColor: '#efe7d2', borderColor: '#d6c9a8', paneSep: '#d6c9a8', wmColor: '#000000' }, scales: { crosshairColor: '#8a7b58' } },
  matrix: { label: 'Terminal green', chrome: { bg: '#050d07', panel: '#08140b', panel2: '#06100a', deep: '#030a05', border: '#12301a', border2: '#1d4a29', active: '#1d4a29', muted: '#6fbf84', text: '#c9f7d6', light: false }, canvas: { bgType: 'solid', bg: '#050d07', bg2: '#030a05', textColor: '#6fbf84', gridVColor: '#0b1c10', gridHColor: '#0b1c10', borderColor: '#12301a', paneSep: '#12301a', wmColor: '#22ff88' }, scales: { crosshairColor: '#3fae62' }, symbol: { up: '#22ff88', down: '#ff4d6d', borderUp: '#22ff88', borderDown: '#ff4d6d', wickUp: '#22ff88', wickDown: '#ff4d6d', lineColor: '#22ff88' } },
}
export const THEME_IDS = ['dark', 'midnight', 'black', 'light', 'paper', 'matrix']

// 'system' follows the OS; 'custom' means the person has edited colours by hand (chrome stays as the last preset).
export function resolveThemeId(cs, prefersDark = true) {
  if (cs.theme === 'system') return prefersDark ? 'dark' : 'light'
  return THEMES[cs.theme] ? cs.theme : 'dark'
}
export function chromeOf(cs, prefersDark = true) {
  return THEMES[resolveThemeId(cs, prefersDark)].chrome
}

// Applies a theme preset: overlays its canvas / scale / (matrix) candle colours and records the id.
export function withTheme(cs, id, prefersDark = true) {
  if (id === 'system') {
    const base = withTheme(cs, prefersDark ? 'dark' : 'light', prefersDark)
    return { ...base, theme: 'system' }
  }
  const t = THEMES[id]
  if (!t) return cs
  return cleanChartSettings({ ...cs, theme: id, canvas: { ...cs.canvas, ...t.canvas }, scales: { ...cs.scales, ...(t.scales || {}) }, symbol: { ...cs.symbol, ...(t.symbol || {}) } })
}

// ── small colour / format helpers ────────────────────────────────────────
// '#rrggbbaa' -> 'rgba(r,g,b,a)' (charts and canvases accept it everywhere); other strings pass through.
export function css(c) {
  if (typeof c === 'string' && /^#[0-9a-f]{8}$/i.test(c)) {
    const n = parseInt(c.slice(1), 16)
    return `rgba(${(n >>> 24) & 255},${(n >>> 16) & 255},${(n >>> 8) & 255},${Math.round(((n & 255) / 255) * 1000) / 1000})`
  }
  return c
}
// colour + opacity (0..1) -> '#rrggbb' or '#rrggbbaa'
export function withAlpha(hex6, alpha) {
  const base = /^#[0-9a-f]{6}/i.test(hex6) ? hex6.slice(0, 7) : '#ffffff'
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return a >= 255 ? base : `${base}${a.toString(16).padStart(2, '0')}`
}
export const alphaOf = (c) => (typeof c === 'string' && /^#[0-9a-f]{8}$/i.test(c) ? parseInt(c.slice(7), 16) / 255 : 1)

export const LINE_STYLE = { solid: 0, dotted: 1, dashed: 2 } // lightweight-charts LineStyle
export const LINE_TYPE = { simple: 0, steps: 1, curved: 2 } // lightweight-charts LineType
export const SCALE_MODE = { normal: 0, log: 1, percent: 2, index100: 3 } // lightweight-charts PriceScaleMode
export const CROSSHAIR_MODE = { normal: 0, magnet: 3 } // lightweight-charts CrosshairMode

// Offset in seconds between UTC and the chosen time zone right now ('local' = this device).
// Candle times are shifted by it so the chart's UTC axis shows wall-clock time in that zone.
export function tzOffsetSec(tz, atMs = Date.now()) {
  if (tz === 'UTC') return 0
  if (!tz || tz === 'local') return -new Date(atMs).getTimezoneOffset() * 60
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(atMs))
    const g = (t) => Number(parts.find((p) => p.type === t).value)
    const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
    return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / 1000)
  } catch { return 0 }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const p2 = (n) => String(n).padStart(2, '0')
// Formats a (tz-shifted) unix-seconds value using UTC getters.
export function formatDate(sec, fmt) {
  const d = new Date(sec * 1000)
  const [dd, mm, yyyy] = [p2(d.getUTCDate()), p2(d.getUTCMonth() + 1), d.getUTCFullYear()]
  if (fmt === 'dd-MM-yyyy') return `${dd}-${mm}-${yyyy}`
  if (fmt === 'MM-dd-yyyy') return `${mm}-${dd}-${yyyy}`
  if (fmt === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`
  return `${dd} ${MONTHS[d.getUTCMonth()]} ${String(yyyy).slice(2)}`
}
export function formatTime(sec, h24, seconds) {
  const d = new Date(sec * 1000)
  const h = d.getUTCHours()
  const mm = p2(d.getUTCMinutes()), ss = p2(d.getUTCSeconds())
  if (h24) return `${p2(h)}:${mm}${seconds ? `:${ss}` : ''}`
  return `${h % 12 || 12}:${mm}${seconds ? `:${ss}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}
