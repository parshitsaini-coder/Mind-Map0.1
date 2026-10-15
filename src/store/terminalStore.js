import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as L from '../lib/terminal/ledger'
import { validateCloseLots } from '../lib/terminal/chartOrders'
import { ORDER_LABEL, slipQuote } from '../lib/terminal/engine'
import { getCandles, getMidAt, quoteFromMid, setSpreadMode } from '../lib/terminal/feed/simulatedFeed'
import { osNotify } from '../lib/terminal/alerts'
import { emitTerminalEvent, registerSubscriber } from '../lib/terminal/effects'
import { configureSound, installUnlock } from '../lib/terminal/soundEngine'
import { LEDGER_EVENT, buyOrSell, closeEvent } from '../lib/terminal/eventCatalog'
import { motionFlags, showToast } from '../lib/terminal/motionPolicy'
import { popupFor } from '../lib/terminal/popupModel'
import { toJournalEntry, journalKey } from '../lib/terminal/journal'
import { useTradeAnalysisStore } from './tradeAnalysisStore'
import { INDICATOR_DEFS, defaultParams, cleanParams, MAX_INDICATORS } from '../lib/terminal/indicators'
import { cleanVisibility, sanitizeDrawings, MAX_DRAWINGS_PER_SYMBOL, cloneDrawing, reorder, nextZ, styleOf, applyStyle, cleanTemplateMap, cleanDefaultsMap, TOOLS } from '../lib/terminal/drawings'
import { SYMBOLS, TIMEFRAMES, INSTRUMENTS } from '../lib/terminal/instruments'
import { cleanChartSettings, mergeChartSettings, withTheme, CHART_TYPE_IDS } from '../lib/terminal/chartSettings'
import { sanitizeIndicators, cleanLineStyles, DEFAULT_CHARTS, validCell, HISTORY_CAP } from '../lib/terminal/cloudSync'

// Demo trading terminal state: UI prefs + the virtual account (balance, positions, orders, history).
// All trading rules live in lib/terminal/ledger.js (pure); these actions only apply the result.
const pick = (s) => ({ account: s.account, positions: s.positions, orders: s.orders, history: s.history, transactions: s.transactions, nextId: s.nextId })
const nowSec = () => Math.floor(Date.now() / 1000)
const money = (n) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`
const label = (t) => `${t.side.toUpperCase()} ${t.symbol} ${t.lots}`
const orderLabel = (o) => `${o.side.toUpperCase()} ${ORDER_LABEL[o.type]} ${o.lots} ${o.symbol}`
// Phase 13: data the popup / chart effects need, per ledger event
function ledgerData(e) {
  const t = e.trade, o = e.order, p = e.position
  switch (e.type) {
    case 'fill': return { symbol: p.symbol, side: p.side, lots: p.lots, orderType: o.type, price: p.entry }
    case 'trigger': return { symbol: o.symbol, side: o.side, lots: o.lots, orderType: o.type === 'stoplimit' ? 'stoplimit' : o.type, price: o.price }
    case 'sl': case 'tp': case 'ptp': case 'stopout': return { symbol: t.symbol, side: t.side, lots: t.lots, pnl: t.pnl, price: t.exit }
    case 'be': return { symbol: p.symbol, side: p.side, what: 'SL', to: p.sl, price: p.sl }
    case 'expired': case 'oco': return { symbol: o.symbol, side: o.side, price: o.price }
    case 'rejected': return { symbol: o.symbol, side: o.side, reason: e.error }
    default: return {}
  }
}
function modData(before, patch) {
  if (!before) return {}
  const key = ['sl', 'tp', 'price'].find((k) => patch && patch[k] !== undefined && patch[k] !== before[k])
  if (!key) return { symbol: before.symbol }
  const to = patch[key]
  return { symbol: before.symbol, what: key === 'price' ? 'PRICE' : key.toUpperCase(), from: before[key] ?? null, to, price: to }
}
const pipsOf = (symbol, diff) => { const ps = INSTRUMENTS[symbol]?.pipSize; return ps ? diff / ps : NaN }
export const motionEnv = () => ({ prefersReduced: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, adaptive: useTerminalStore.getState().adaptive })
export const motionFlagsNow = (anim) => motionFlags(anim, motionEnv())
let noticeSeq = 0
let indSeq = 0
const newIndId = () => `i${Date.now().toString(36)}${(++indSeq).toString(36)}`
// keep the selection through undo / redo when that drawing still exists
const keepSel = (id, map) => (id && Object.values(map).some((l) => l.some((d) => d.id === id)) ? id : null)
const pushHist = (s) => ({ past: [...s.drawHist.past.slice(-59), { at: Date.now(), drawings: s.drawings }], future: [] })
const MAX_CATCHUP_SEC = 7 * 86400
const DEFAULT_SETTINGS = {
  oneClick: false, lots: 0.01, stopOutLevel: L.DEFAULT_STOP_OUT, sound: true, notifAsked: false, autoJournal: false, autoSince: 0,
  spreadMode: 'fixed', // 'fixed' | 'variable'  (Phase 8)
  slippage: false, // market fills slip a little against you
  wakeLock: false, // keep the screen on while the terminal is open (this device only)
}
// Slippage works by worsening the quotes handed to the ledger for the symbols being traded.
const symbolsOf = (get, ids) => get().positions.filter((p) => ids.includes(p.id)).map((p) => p.symbol)
const slipFor = (get, quotes, symbols) => {
  if (!get().settings.slippage) return quotes
  const out = { ...quotes }
  for (const sym of symbols) if (out[sym] && INSTRUMENTS[sym]) out[sym] = slipQuote(out[sym], INSTRUMENTS[sym])
  return out
}
// Keeps stored/imported settings inside sane bounds; unknown keys are dropped.
export function cleanSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const o = { ...DEFAULT_SETTINGS }
  for (const k of ['oneClick', 'sound', 'notifAsked', 'autoJournal', 'slippage', 'wakeLock']) if (typeof r[k] === 'boolean') o[k] = r[k]
  if (Number.isFinite(r.lots) && r.lots > 0 && r.lots <= 100) o.lots = r.lots
  if (Number.isFinite(r.stopOutLevel) && r.stopOutLevel >= 0 && r.stopOutLevel <= 100) o.stopOutLevel = r.stopOutLevel
  if (Number.isFinite(r.autoSince) && r.autoSince >= 0) o.autoSince = r.autoSince
  if (r.spreadMode === 'variable' || r.spreadMode === 'fixed') o.spreadMode = r.spreadMode
  return o
}
// Phase 7 sync bookkeeping (see lib/terminal/cloudSync.js decideSync): who we last synced as, the
// cloud row's updated_at we last saw, whether there are unsynced local edits, when we last edited,
// and whether the next upload is a deliberate wipe/reset that must not be blocked by the
// "never overwrite a non-empty cloud account with an empty one" rule.
const EMPTY_META = { userId: null, cloudUpdatedAt: null, dirty: false, localUpdatedAt: 0, force: false }
const sanitizeMeta = (m) => (m && typeof m === 'object' && typeof m.userId === 'string'
  ? { userId: m.userId, cloudUpdatedAt: typeof m.cloudUpdatedAt === 'string' ? m.cloudUpdatedAt : null, dirty: !!m.dirty, localUpdatedAt: Number.isFinite(m.localUpdatedAt) ? m.localUpdatedAt : 0, force: !!m.force }
  : { ...EMPTY_META })

// One ledger event -> toast text + tone.
function describe(e) {
  const tag = e.approx ? ' (approx)' : ''
  switch (e.type) {
    case 'fill': return { text: `Order filled${tag}: ${orderLabel(e.order)} @ ${e.position.entry}`, kind: 'info' }
    case 'trigger': return { text: `Stop-limit triggered: ${orderLabel(e.order)}`, kind: 'info' }
    case 'sl': return { text: `Stop loss hit${tag}: ${label(e.trade)} · ${money(e.trade.pnl)}`, kind: e.trade.pnl >= 0 ? 'win' : 'loss' }
    case 'tp': return { text: `Take profit hit${tag}: ${label(e.trade)} · ${money(e.trade.pnl)}`, kind: 'win' }
    case 'ptp': return { text: `Partial TP${tag}: closed ${e.trade.lots} ${e.trade.symbol} · ${money(e.trade.pnl)}`, kind: 'win' }
    case 'be': return { text: `Break-even set: ${e.position.side.toUpperCase()} ${e.position.symbol}`, kind: 'info' }
    case 'stopout': return { text: `STOP-OUT${tag}: ${label(e.trade)} · ${money(e.trade.pnl)}`, kind: 'loss' }
    case 'expired': return { text: `Order expired: ${orderLabel(e.order)}`, kind: 'info' }
    case 'oco': return { text: `OCO: cancelled ${orderLabel(e.order)}`, kind: 'info' }
    case 'rejected': return { text: `Order rejected: ${orderLabel(e.order)} — ${e.error}`, kind: 'error' }
    default: return null
  }
}
const LOUD = new Set(['fill', 'sl', 'tp', 'ptp', 'stopout', 'rejected'])

export const useTerminalStore = create(
  persist(
    (set, get) => ({
      // ── UI ──
      isOpen: false,
      symbol: 'XAUUSD',
      timeframe: 'M15',
      chartType: 'candles', // one of CHART_TYPE_IDS (candles, hollow, bars, line, area, baseline, heikin)
      chartSettings: cleanChartSettings(), // Phase 9: appearance + chart-trading display (synced to the account)
      labOpen: false, // Phase 12 dev effects playground (not saved)
      setLabOpen: (v) => set({ labOpen: !!v }),
      dockOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
      dockTab: 'positions', // 'positions' | 'orders' | 'history'
      // ── Phase 6: indicators, drawings, layouts ──
      indicators: [], // [{ id, type, params, colors, visible }] — shown on every chart
      drawings: {}, // symbol -> [drawing]  (see lib/terminal/drawings.js)
      drawTool: 'cursor', // 'cursor' | a drawing type
      drawSticky: false, // keep the tool after each drawing
      drawSel: null, // selected drawing id
      drawHidden: false,
      drawHist: { past: [], future: [] }, // undo / redo snapshots of `drawings` (not saved)
      drawClip: null, // copied drawing (Ctrl+C / Ctrl+V)
      drawMagnet: 'off', // 'off' | 'weak' | 'strong'
      drawDefaults: {}, // tool -> style used by the next drawing of that tool
      drawTemplates: {}, // tool -> [{ name, ...style }]
      drawFavs: [], // tool ids pinned in the toolbar
      drawTree: false, // object-tree panel open
      indDialog: null, // id of the indicator whose settings dialog is open
      drawDialog: null, // id of the drawing whose settings dialog is open
      layout: 1, // 1 | 2 | 4 charts (desktop)
      charts: DEFAULT_CHARTS.map((c) => ({ ...c })), // one {symbol,timeframe} per chart cell
      activeChart: 0,
      settings: { ...DEFAULT_SETTINGS },
      notices: [],
      historyOpen: false, // full-screen History / Stats / Account view
      journaled: {}, // journalKey(trade) -> true, for trades already sent to Trade Analysis
      pickReq: null, // 'price' | 'limit' | 'sl' | 'tp' — the ticket is waiting for a chart tap
      pickRes: null, // { field, price, n }
      // ── Phase 7: cloud sync ──
      cloudMeta: { ...EMPTY_META },
      cloudStatus: 'idle', // idle | pending | syncing | synced | offline | missing | auth | error | unreadable (transient)
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      // The top-level symbol/timeframe always describe the ACTIVE chart (the order ticket, positions
      // and journal bridge read them), and are mirrored into that chart's cell.
      setSymbol: (symbol) => set((s) => ({ symbol, drawSel: null, charts: s.charts.map((c, i) => (i === s.activeChart ? { ...c, symbol } : c)) })),
      setTimeframe: (timeframe) => set((s) => ({ timeframe, charts: s.charts.map((c, i) => (i === s.activeChart ? { ...c, timeframe } : c)) })),
      setChartType: (chartType) => { if (CHART_TYPE_IDS.includes(chartType)) set({ chartType }) },
      // Phase 9: deep-merge a partial patch ({ canvas: { bg: '#000' } }); validated, then stored.
      setChartSettings: (patch) => set({ chartSettings: mergeChartSettings(get().chartSettings, patch) }),
      // Replaces the whole object (live-preview Cancel puts the snapshot back this way).
      replaceChartSettings: (cs) => set({ chartSettings: cleanChartSettings(cs) }),
      applyChartTheme: (id, prefersDark = true) => set({ chartSettings: withTheme(get().chartSettings, id, prefersDark) }),
      resetChartSettings: () => set({ chartSettings: cleanChartSettings() }),

      // ── layouts ──
      setLayout: (layout) => set((s) => ({ layout, ...(s.activeChart >= layout ? { activeChart: 0, symbol: s.charts[0].symbol, timeframe: s.charts[0].timeframe, drawSel: null } : {}) })),
      setActiveChart: (i) => set((s) => {
        if (i === s.activeChart || !s.charts[i]) return {}
        return { activeChart: i, symbol: s.charts[i].symbol, timeframe: s.charts[i].timeframe, drawSel: null }
      }),

      // ── indicators ──
      addIndicator: (type) => {
        if (!INDICATOR_DEFS[type]) return null
        if (get().indicators.length >= MAX_INDICATORS) { get().notify(`Up to ${MAX_INDICATORS} indicators per chart`, 'error'); return null }
        const ind = { id: newIndId(), type, params: defaultParams(type), colors: {}, visible: true, styles: {}, visibility: cleanVisibility(), paneSize: 1, collapsed: false }
        set((s) => ({ indicators: [...s.indicators, ind] }))
        return ind.id
      },
      updateIndicator: (id, patch) => set((s) => ({
        indicators: s.indicators.map((i) => (i.id !== id ? i : { ...i, ...patch, ...(patch.params ? { params: cleanParams(i.type, { ...i.params, ...patch.params }) } : {}), ...(patch.colors ? { colors: { ...i.colors, ...patch.colors } } : {}), ...(patch.styles ? { styles: cleanLineStyles(i.type, { ...i.styles, ...Object.fromEntries(Object.entries(patch.styles).map(([k, v]) => [k, { ...(i.styles?.[k] || {}), ...v }])) }) } : {}), ...(patch.visibility ? { visibility: cleanVisibility({ ...i.visibility, ...patch.visibility }) } : {}) })),
      })),
      replaceIndicator: (ind) => set((s) => ({ indicators: s.indicators.map((i) => (i.id === ind.id ? ind : i)) })),
      // move an indicator one place up / down the list (pane indicators stack in this order)
      moveIndicator: (id, dir) => set((s) => {
        const a = [...s.indicators]
        const i = a.findIndex((x) => x.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= a.length) return {}
        ;[a[i], a[j]] = [a[j], a[i]]
        return { indicators: a }
      }),
      setIndDialog: (indDialog) => set({ indDialog }),
      removeIndicator: (id) => set((s) => ({ indicators: s.indicators.filter((i) => i.id !== id) })),
      clearIndicators: () => set({ indicators: [] }),

      // ── drawings (saved per symbol) ──
      setDrawTool: (drawTool) => set({ drawTool, ...(drawTool !== 'cursor' ? { drawSel: null } : {}) }),
      setDrawSticky: (drawSticky) => set({ drawSticky }),
      setDrawSel: (drawSel) => set({ drawSel }),
      setDrawHidden: (drawHidden) => set({ drawHidden, ...(drawHidden ? { drawSel: null } : {}) }),
      addDrawing: (symbol, d) => {
        const list = get().drawings[symbol] || []
        if (list.length >= MAX_DRAWINGS_PER_SYMBOL) { get().notify(`Up to ${MAX_DRAWINGS_PER_SYMBOL} drawings per symbol — delete some first`, 'error'); return false }
        const def = get().drawDefaults[d.type]
        const dd = { ...(def ? applyStyle(d, def) : d), z: nextZ(list) }
        set((s) => ({ drawings: { ...s.drawings, [symbol]: [...list, dd] }, drawHist: pushHist(s), drawSel: dd.id, drawTool: s.drawSticky ? s.drawTool : 'cursor' }))
        return true
      },
      // Undo / redo of drawing edits. A drag or a dialog calls pushDrawHist() once, then edits with { hist: false }.
      pushDrawHist: () => set((s) => ({ drawHist: pushHist(s) })),
      dropDrawHist: () => set((s) => ({ drawHist: { ...s.drawHist, past: s.drawHist.past.slice(0, -1) } })),
      updateDrawing: (symbol, id, patch, opt = {}) => set((s) => ({
        ...(opt.hist === false ? {} : { drawHist: pushHist(s) }),
        drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).map((d) => (d.id === id ? { ...d, ...patch } : d)) },
      })),
      replaceDrawing: (symbol, d) => set((s) => ({ drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).map((x) => (x.id === d.id ? d : x)) } })),
      removeDrawing: (symbol, id) => set((s) => ({ drawHist: pushHist(s), drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).filter((d) => d.id !== id) }, drawSel: s.drawSel === id ? null : s.drawSel })),
      clearDrawings: (symbol) => set((s) => ({ drawHist: pushHist(s), drawings: { ...s.drawings, [symbol]: [] }, drawSel: null })),
      undoDraw: () => {
        const s = get()
        const h = s.drawHist
        if (!h.past.length) return false
        const prev = h.past[h.past.length - 1]
        set({ drawings: prev.drawings, drawHist: { past: h.past.slice(0, -1), future: [...h.future, { at: Date.now(), drawings: s.drawings }] }, drawSel: keepSel(s.drawSel, prev.drawings) })
        return true
      },
      redoDraw: () => {
        const s = get()
        const h = s.drawHist
        if (!h.future.length) return false
        const nx = h.future[h.future.length - 1]
        set({ drawings: nx.drawings, drawHist: { past: [...h.past, { at: Date.now(), drawings: s.drawings }], future: h.future.slice(0, -1) }, drawSel: keepSel(s.drawSel, nx.drawings) })
        return true
      },
      copyDrawing: (symbol, id) => {
        const d = (get().drawings[symbol] || []).find((x) => x.id === id)
        if (d) set({ drawClip: JSON.parse(JSON.stringify(d)) })
        return !!d
      },
      // timeMap is passed by the chart (the store does not know the candle times)
      pasteDrawing: (symbol, timeMap, dPrice = 0) => {
        const s = get()
        if (!s.drawClip) return null
        const list = s.drawings[symbol] || []
        if (list.length >= MAX_DRAWINGS_PER_SYMBOL) return null
        const c = cloneDrawing(s.drawClip, { dBars: 2, dPrice }, timeMap, nextZ(list))
        set({ drawings: { ...s.drawings, [symbol]: [...list, c] }, drawHist: pushHist(s), drawSel: c.id })
        return c.id
      },
      duplicateDrawing: (symbol, id, timeMap) => {
        const s = get()
        const d = (s.drawings[symbol] || []).find((x) => x.id === id)
        if (!d) return null
        const list = s.drawings[symbol]
        if (list.length >= MAX_DRAWINGS_PER_SYMBOL) return null
        const c = cloneDrawing(d, { dBars: 2 }, timeMap, nextZ(list))
        set({ drawings: { ...s.drawings, [symbol]: [...list, c] }, drawHist: pushHist(s), drawSel: c.id })
        return c.id
      },
      reorderDrawing: (symbol, id, op) => set((s) => ({ drawHist: pushHist(s), drawings: { ...s.drawings, [symbol]: reorder(s.drawings[symbol] || [], id, op) } })),
      // object tree bulk actions
      setAllDrawings: (symbol, patch) => set((s) => ({ drawHist: pushHist(s), drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).map((d) => ({ ...d, ...patch })) } })),
      setDrawMagnet: (m) => { if (['off', 'weak', 'strong'].includes(m)) set({ drawMagnet: m }) },
      setDrawTree: (drawTree) => set({ drawTree }),
      setDrawDialog: (drawDialog) => set({ drawDialog }),
      toggleDrawFav: (tool) => set((s) => (TOOLS[tool] ? { drawFavs: s.drawFavs.includes(tool) ? s.drawFavs.filter((t) => t !== tool) : [...s.drawFavs, tool].slice(0, 12) } : {})),
      // "Set as default": the next drawing of this tool starts with this style
      setDrawDefault: (tool, d) => { if (TOOLS[tool]) set((s) => ({ drawDefaults: { ...s.drawDefaults, [tool]: styleOf(d) } })) },
      clearDrawDefault: (tool) => set((s) => { const x = { ...s.drawDefaults }; delete x[tool]; return { drawDefaults: x } }),
      saveDrawTemplate: (tool, name, d) => {
        const n = String(name || '').trim().slice(0, 30)
        if (!TOOLS[tool] || !n) return false
        set((s) => {
          const list = (s.drawTemplates[tool] || []).filter((t) => t.name !== n)
          return { drawTemplates: { ...s.drawTemplates, [tool]: [...list, { name: n, ...styleOf(d) }].slice(-12) } }
        })
        return true
      },
      deleteDrawTemplate: (tool, name) => set((s) => ({ drawTemplates: { ...s.drawTemplates, [tool]: (s.drawTemplates[tool] || []).filter((t) => t.name !== name) } })),
      // Esc: leave the drawing tool, then deselect. Returns true if it consumed the key.
      escapeDraw: () => {
        const s = get()
        if (s.drawTool !== 'cursor') { set({ drawTool: 'cursor' }); return true }
        if (s.drawSel) { set({ drawSel: null }); return true }
        return false
      },
      setDockOpen: (dockOpen) => set({ dockOpen }),
      setDockTab: (dockTab) => set({ dockTab }),
      setSettings: (patch) => {
        const next = cleanSettings({ ...get().settings, ...patch })
        if (patch.spreadMode) setSpreadMode(next.spreadMode)
        set({ settings: next })
      },
      // Commission lives on the account (it travels with it to the cloud): USD per lot, charged on close.
      setCommission: (value) => {
        const v = Number(value)
        if (!Number.isFinite(v) || v < 0 || v > L.MAX_COMMISSION) return { ok: false, error: `Commission must be between 0 and ${L.MAX_COMMISSION} USD per lot` }
        set((s) => ({ account: { ...s.account, commission: Math.round(v * 100) / 100 } }))
        return { ok: true }
      },
      // Keyboard B / S: the order ticket listens and presses the matching button.
      hotkey: null,
      ticketPending: false, // order ticket is showing its BUY/SELL confirmation (Enter confirms, Esc cancels)
      fireHotkey: (side) => set({ hotkey: { side, n: Date.now() } }),
      setHistoryOpen: (historyOpen) => set({ historyOpen }),
      setPickReq: (pickReq) => set({ pickReq }),
      // chart right-click menu -> order ticket: { type: 'limit'|'stop', side, price, n }
      ticketPrefill: null,
      prefillTicket: (spec) => set({ ticketPrefill: { ...spec, n: Date.now() } }),
      setPickRes: (field, price) => set({ pickReq: null, pickRes: { field, price, n: Date.now() } }),
      // `action` = { label, run } adds a button to the toast (e.g. Undo)
      notify: (text, kind = 'info', action = null, eventId = null) =>
        set((s) => ({ notices: [...s.notices.slice(-3), { id: ++noticeSeq, text, kind, ...(action ? { action } : {}), ...(eventId ? { eventId } : {}) }] })),
      // Phase 13: the "Done" popup and the stop-out banner (not persisted)
      popup: null,
      banner: null,
      adaptive: false, // true after the frame-time watchdog dropped motion to Reduced (per session)
      setAdaptive: (v) => set({ adaptive: !!v }),
      showPopup: (m) => set({ popup: { ...m, key: ++noticeSeq } }),
      dismissPopup: () => set({ popup: null }),
      showBanner: (b) => set({ banner: b }),
      dismissBanner: () => set({ banner: null }),
      dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
      // toast + (optional) sound + OS notification for loud events
      announce: (events) => {
        let loudest = null
        for (const e of events) {
          const d = describe(e)
          if (!d) continue
          const id = LEDGER_EVENT[e.type]
          if (id) emitTerminalEvent({ id, text: d.text, kind: d.kind, data: ledgerData(e) })
          else get().notify(d.text, d.kind)
          if (LOUD.has(e.type)) { loudest = d; osNotify(d.text) }
        }
        return loudest
      },

      // ── Phase 7: cloud sync actions ──
      // Replace the local terminal data with a (already sanitised) cloud snapshot. Device-specific
      // things (dock layout, notification permission) are left alone.
      applyCloud: (snap) => set((s) => {
        const p = snap.prefs
        const cell = p.charts[p.activeChart]
        return {
          ...(snap.account ? { account: snap.account } : {}),
          positions: snap.positions, orders: snap.orders, history: snap.history, transactions: snap.transactions,
          nextId: snap.nextId, journaled: snap.journaled, drawings: snap.drawings,
          settings: cleanSettings({ ...s.settings, ...snap.settings }),
          indicators: p.indicators, layout: p.layout, charts: p.charts, activeChart: p.activeChart, chartType: p.chartType,
          ...(p.chart ? { chartSettings: cleanChartSettings(p.chart) } : {}),
          drawSticky: p.drawSticky, drawHidden: p.drawHidden,
          drawDefaults: p.drawDefaults || {}, drawTemplates: p.drawTemplates || {}, drawHist: { past: [], future: [] },
          symbol: cell.symbol, timeframe: cell.timeframe, drawSel: null, drawTool: 'cursor', pickReq: null,
        }
      }),
      // Account switch / sign-out: forget the previous person's demo account on this browser.
      resetLocalData: () => set({
        ...L.createLedger(), journaled: {}, drawings: {}, indicators: [], layout: 1, charts: DEFAULT_CHARTS.map((c) => ({ ...c })), activeChart: 0,
        symbol: DEFAULT_CHARTS[0].symbol, timeframe: DEFAULT_CHARTS[0].timeframe, drawSel: null, drawTool: 'cursor', pickReq: null,
        drawDefaults: {}, drawTemplates: {}, drawHist: { past: [], future: [] }, drawClip: null,
        settings: { ...DEFAULT_SETTINGS }, chartSettings: cleanChartSettings(), chartType: 'candles',
        cloudMeta: { ...EMPTY_META }, cloudStatus: 'idle', isOpen: false,
      }),

      // ── Account ──
      ...L.createLedger(),

      setLeverage: (leverage) => set((s) => ({ account: { ...s.account, leverage } })),
      // Wipes everything and starts again (defaults: same starting balance & leverage).
      resetAccount: (startBalance, leverage) => {
        const { account } = get()
        const r = L.resetLedger(startBalance ?? account.startBalance, leverage ?? account.leverage)
        if (r.error) return { ok: false, error: r.error }
        const commission = account.commission || 0
        set({ ...r.ledger, ...(commission ? { account: { ...r.ledger.account, commission } } : {}), cloudMeta: { ...get().cloudMeta, force: true } }) // a deliberate reset must reach the cloud
        get().notify(`Demo account reset to $${r.ledger.account.balance.toLocaleString('en-US')}`, 'info')
        return { ok: true }
      },
      deposit: (amount) => {
        const r = L.deposit(pick(get()), amount)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        get().notify(`Deposited $${r.transaction.amount.toLocaleString('en-US')} (virtual)`, 'win')
        return { ok: true }
      },
      withdraw: (amount, quotes) => {
        const r = L.withdraw(pick(get()), amount, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        get().notify(`Withdrew $${r.transaction.amount.toLocaleString('en-US')} (virtual)`, 'info')
        return { ok: true }
      },

      // ── Trade Analysis journal bridge ──
      // Adds the given closed trades to the existing Trade Analysis journal (once each).
      sendToJournal: (trades, { quiet = false } = {}) => {
        const s = get()
        const ta = useTradeAnalysisStore.getState()
        const journaled = { ...s.journaled }
        let n = 0
        for (const h of trades) {
          const k = journalKey(h)
          if (journaled[k]) continue
          ta.addTrade(toJournalEntry(h, { timeframeId: s.timeframe }))
          journaled[k] = true
          n++
        }
        if (n) set({ journaled })
        if (n && !quiet) get().notify(`Added ${n} trade${n > 1 ? 's' : ''} to the Trade Analysis journal`, 'info')
        return n
      },
      setAutoJournal: (on) => get().setSettings({ autoJournal: on, autoSince: on ? nowSec() : get().settings.autoSince }),
      // With auto-journal ON, every trade closed since it was switched on is sent (never older ones).
      autoJournalSync: () => {
        const s = get()
        if (!s.settings.autoJournal) return
        const fresh = s.history.filter((h) => h.closeTime >= s.settings.autoSince && !s.journaled[journalKey(h)])
        if (fresh.length) get().sendToJournal(fresh.reverse())
      },

      // Each action takes the current quotes map { SYMBOL: {bid, ask} } and returns {ok, error?}.
      openPosition: (order, quotes) => {
        const r = L.openPosition(pick(get()), { tf: get().timeframe, ...order }, slipFor(get, quotes, [order.symbol]))
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        const p = r.position
        const q0 = quotes?.[p.symbol]
        const raw = q0 ? (p.side === 'buy' ? q0.ask : q0.bid) : null
        const slipPips = raw != null ? pipsOf(p.symbol, p.side === 'buy' ? p.entry - raw : raw - p.entry) : NaN
        emitTerminalEvent({ id: buyOrSell(p.side), text: `${p.side === 'buy' ? 'Bought' : 'Sold'} ${p.lots} ${p.symbol} @ ${p.entry}`, data: { symbol: p.symbol, side: p.side, lots: p.lots, price: p.entry, sl: p.sl ?? null, tp: p.tp ?? null, slipPips } })
        return { ok: true }
      },
      closePosition: (id, quotes) => {
        const r = L.closePosition(pick(get()), id, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        emitTerminalEvent({ id: closeEvent(r.trade.pnl), text: `Closed ${label(r.trade)} · ${money(r.trade.pnl)}`, kind: r.trade.pnl >= 0 ? 'win' : 'loss', data: { symbol: r.trade.symbol, side: r.trade.side, lots: r.trade.lots, pnl: r.trade.pnl, price: r.trade.exit } })
        return { ok: true }
      },
      partialClose: (id, pct, quotes) => {
        const r = L.partialClose(pick(get()), id, pct, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        emitTerminalEvent({ id: 'position.partial', text: `Closed ${pct}% · ${label(r.trade)} · ${money(r.trade.pnl)}`, kind: r.trade.pnl >= 0 ? 'win' : 'loss', data: { symbol: r.trade.symbol, side: r.trade.side, lots: r.trade.lots, pnl: r.trade.pnl, price: r.trade.exit } })
        return { ok: true }
      },
      closeMany: (ids, quotes) => {
        const r = L.closeMany(pick(get()), ids, slipFor(get, quotes, symbolsOf(get, ids)))
        if (!r.trades.length) return { ok: false }
        set(r.ledger)
        const total = r.trades.reduce((a, t) => a + t.pnl, 0)
        emitTerminalEvent({ id: closeEvent(total), text: `Closed ${r.trades.length} position(s) · ${money(total)}`, kind: total >= 0 ? 'win' : 'loss', data: { pnl: total, lots: r.trades.length, symbol: r.trades.length === 1 ? r.trades[0].symbol : null, side: r.trades[0]?.side, price: r.trades.length === 1 ? r.trades[0].exit : null } })
        return { ok: true }
      },
      // Close an exact number of lots (the chart's "Close custom lots").
      closeLots: (id, lots, quotes) => {
        const pos = get().positions.find((p) => p.id === id)
        if (!pos) return { ok: false, error: 'Position not found' }
        const err = validateCloseLots(pos.lots, lots, INSTRUMENTS[pos.symbol])
        if (err) return { ok: false, error: err }
        const r = L.closePosition(pick(get()), id, slipFor(get, quotes, [pos.symbol]), { lots })
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        emitTerminalEvent({ id: 'position.partial', text: `Closed ${lots} lots \u00b7 ${label(r.trade)} \u00b7 ${money(r.trade.pnl)}`, kind: r.trade.pnl >= 0 ? 'win' : 'loss', data: { symbol: r.trade.symbol, side: r.trade.side, lots: r.trade.lots, pnl: r.trade.pnl, price: r.trade.exit } })
        return { ok: true }
      },
      reversePosition: (id, quotes) => {
        const r = L.reversePosition(pick(get()), id, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        emitTerminalEvent({ id: 'position.reversed', text: `Reversed → ${r.position.side.toUpperCase()} ${r.position.symbol} ${r.position.lots}`, data: { symbol: r.position.symbol, side: r.position.side, lots: r.position.lots, price: r.position.entry } })
        return { ok: true }
      },

      // ── Phase 4: modify / pending orders ──
      modifyPosition: (id, patch, quotes) => {
        const before = get().positions.find((p) => p.id === id)
        const r = L.modifyPosition(pick(get()), id, patch, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        emitTerminalEvent({ id: 'order.modified', text: null, data: modData(before, patch) })
        return { ok: true }
      },
      breakEven: (id, quotes) => {
        const r = L.breakEven(pick(get()), id, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        emitTerminalEvent({ id: 'order.modified', text: 'Stop loss moved to break-even', data: { symbol: r.position?.symbol, what: 'SL', price: r.position?.sl, to: r.position?.sl } })
        return { ok: true }
      },
      placeOrder: (spec, quotes) => {
        const r = L.placeOrder(pick(get()), { tf: get().timeframe, ...spec }, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        const o = r.order
        emitTerminalEvent({ id: 'order.pending.placed', text: `Order placed: ${orderLabel(o)} @ ${o.price}${o.type === 'stoplimit' ? ` → limit ${o.limitPrice}` : ''}`, data: { symbol: o.symbol, side: o.side, lots: o.lots, orderType: o.type, price: o.price, distPips: quotes?.[o.symbol] ? Math.abs(pipsOf(o.symbol, o.price - (quotes[o.symbol].bid + quotes[o.symbol].ask) / 2)) : NaN } })
        return { ok: true, order: o }
      },
      cancelOrder: (id) => {
        const r = L.cancelOrder(pick(get()), id)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        emitTerminalEvent({ id: 'order.cancelled', text: `Order cancelled: ${orderLabel(r.order)}`, data: { symbol: r.order.symbol, side: r.order.side, price: r.order.price } })
        return { ok: true }
      },
      modifyOrder: (id, patch, quotes) => {
        const before = get().orders.find((o) => o.id === id)
        const r = L.modifyOrder(pick(get()), id, patch, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        emitTerminalEvent({ id: 'order.modified', text: null, data: modData(before, patch) })
        return { ok: true }
      },

      // Called on every quote flush: pending fills, SL/TP, trailing, stop-out.
      tick: (quotes) => {
        const s = get()
        if (!s.positions.length && !s.orders.length) return
        const r = L.processTick(pick(s), quotes, { stopOutLevel: s.settings.stopOutLevel })
        if (!r) return
        set(r.ledger)
        get().announce(r.events)
      },

      // Replay what price did between `from` and `to` (seconds) while the terminal was closed.
      catchUp: (from, to) => {
        const s = get()
        if (!s.positions.length && !s.orders.length) return
        const start = Math.max(from, to - MAX_CATCHUP_SEC)
        const first = Math.ceil(start / 60) * 60
        const lastMin = Math.floor(to / 60) * 60
        const syms = [...new Set([...s.positions, ...s.orders].map((x) => x.symbol))]
        const candles = {}
        const mids = {}
        const minutes = Math.ceil((to - start) / 60) + 5
        for (const sym of syms) {
          candles[sym] = getCandles(sym, 'M1', minutes).filter((c) => c.time >= first && c.time < lastMin)
          mids[sym] = getMidAt(sym, start)
        }
        const r = L.catchUp(pick(s), candles, mids, { stopOutLevel: s.settings.stopOutLevel, quoteFromMid })
        if (!r.events.length) return
        set(r.ledger)
        get().announce(r.events)
        const mins = Math.round((to - start) / 60)
        const away = mins >= 120 ? `${(mins / 60).toFixed(1)} h` : `${mins} min`
        get().notify(`While you were away (${away}): ${r.events.length} event(s) — approximate, from 1-min candles`, 'info')
      },
    }),
    {
      name: 'mindmap-terminal-storage',
      // Older saves have no Phase-6 fields; corrupted ones must not crash the chart.
      merge: (saved, current) => {
        const m = { ...current, ...(saved || {}) }
        m.indicators = sanitizeIndicators(saved?.indicators)
        m.settings = cleanSettings(saved?.settings)
        m.chartSettings = cleanChartSettings(saved?.chartSettings)
        if (!CHART_TYPE_IDS.includes(m.chartType)) m.chartType = 'candles'
        setSpreadMode(m.settings.spreadMode)
        m.drawings = Object.fromEntries(Object.entries(saved?.drawings && typeof saved.drawings === 'object' ? saved.drawings : {}).filter(([k]) => SYMBOLS.includes(k)).map(([k, v]) => [k, sanitizeDrawings(v)]))
        m.layout = [1, 2, 4].includes(m.layout) ? m.layout : 1
        const cells = Array.isArray(saved?.charts) && saved.charts.length === 4 && saved.charts.every(validCell) ? saved.charts.map((c) => ({ symbol: c.symbol, timeframe: c.timeframe })) : DEFAULT_CHARTS.map((c) => ({ ...c }))
        m.activeChart = Number.isInteger(m.activeChart) && m.activeChart >= 0 && m.activeChart < m.layout ? m.activeChart : 0
        // the top-level symbol / timeframe (saved by older versions) belong to the active chart
        if (SYMBOLS.includes(m.symbol) && TIMEFRAMES.some((t) => t.id === m.timeframe)) cells[m.activeChart] = { symbol: m.symbol, timeframe: m.timeframe }
        else { m.symbol = cells[m.activeChart].symbol; m.timeframe = cells[m.activeChart].timeframe }
        m.charts = cells
        m.drawTool = 'cursor'
        m.drawHist = { past: [], future: [] }
        m.drawClip = null
        m.drawDefaults = cleanDefaultsMap(saved?.drawDefaults)
        m.drawTemplates = cleanTemplateMap(saved?.drawTemplates)
        m.drawMagnet = ['off', 'weak', 'strong'].includes(saved?.drawMagnet) ? saved.drawMagnet : 'off'
        m.drawFavs = Array.isArray(saved?.drawFavs) ? saved.drawFavs.filter((t) => TOOLS[t]).slice(0, 12) : []
        m.drawTree = false
        m.drawDialog = null
        m.indDialog = null
        m.drawSel = null
        m.cloudMeta = sanitizeMeta(saved?.cloudMeta)
        m.cloudStatus = 'idle'
        return m
      },
      partialize: (s) => ({
        isOpen: s.isOpen, symbol: s.symbol, timeframe: s.timeframe, chartType: s.chartType,
        dockOpen: s.dockOpen, dockTab: s.dockTab, settings: s.settings, chartSettings: s.chartSettings,
        indicators: s.indicators, drawings: s.drawings, layout: s.layout, charts: s.charts, activeChart: s.activeChart,
        drawSticky: s.drawSticky, drawHidden: s.drawHidden, drawMagnet: s.drawMagnet, drawFavs: s.drawFavs,
        drawDefaults: s.drawDefaults, drawTemplates: s.drawTemplates,
        account: s.account, positions: s.positions, orders: s.orders, transactions: (s.transactions || []).slice(0, 200),
        history: s.history.slice(0, HISTORY_CAP), journaled: s.journaled, nextId: s.nextId, cloudMeta: s.cloudMeta,
      }),
    },
  ),
)

// Keep the simulated feed's spread mode in step with the setting no matter how it changed
// (the Settings panel, a cloud load, a reset, a reload).
useTerminalStore.subscribe((s, prev) => {
  if (s.settings.spreadMode !== prev.settings.spreadMode) setSpreadMode(s.settings.spreadMode)
})

// Phase 12 — event bus wiring. The toast is a bus subscriber (events without text, like a silent
// "modified", show nothing); the sound engine reads its settings from the store at play time.
registerSubscriber('toast', (e) => {
  const st = useTerminalStore.getState()
  if (!e.text) return
  const flags = motionFlagsNow(st.chartSettings.anim)
  const model = popupFor(e)
  // with a full popup the toast follows "also show toast"; without a popup it shows unless everything is off; errors always show
  const show = model && flags.popup === 'full' ? showToast(flags, e.kind) : flags.popup !== 'off' || e.kind === 'error'
  if (show) st.notify(e.text, e.kind, e.action || null, e.id)
})
registerSubscriber('popup', (e) => {
  const st = useTerminalStore.getState()
  const flags = motionFlagsNow(st.chartSettings.anim)
  if (flags.popup !== 'full') return
  const model = popupFor(e)
  if (!model) return
  st.showPopup(model)
  if (model.banner) st.showBanner({ text: model.lines[0] || e.text || 'Stop-out', title: model.title })
})
configureSound({
  getConfig: () => {
    const s = useTerminalStore.getState()
    return { master: s.settings.sound, ...s.chartSettings.sounds }
  },
})
installUnlock()
