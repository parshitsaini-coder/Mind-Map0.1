import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as L from '../lib/terminal/ledger'
import { ORDER_LABEL, slipQuote } from '../lib/terminal/engine'
import { getCandles, getMidAt, quoteFromMid, setSpreadMode } from '../lib/terminal/feed/simulatedFeed'
import { beep, osNotify } from '../lib/terminal/alerts'
import { toJournalEntry, journalKey } from '../lib/terminal/journal'
import { useTradeAnalysisStore } from './tradeAnalysisStore'
import { INDICATOR_DEFS, defaultParams, cleanParams, MAX_INDICATORS } from '../lib/terminal/indicators'
import { sanitizeDrawings, MAX_DRAWINGS_PER_SYMBOL } from '../lib/terminal/drawings'
import { SYMBOLS, TIMEFRAMES, INSTRUMENTS } from '../lib/terminal/instruments'
import { sanitizeIndicators, DEFAULT_CHARTS, validCell, HISTORY_CAP } from '../lib/terminal/cloudSync'

// Demo trading terminal state: UI prefs + the virtual account (balance, positions, orders, history).
// All trading rules live in lib/terminal/ledger.js (pure); these actions only apply the result.
const pick = (s) => ({ account: s.account, positions: s.positions, orders: s.orders, history: s.history, transactions: s.transactions, nextId: s.nextId })
const nowSec = () => Math.floor(Date.now() / 1000)
const money = (n) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`
const label = (t) => `${t.side.toUpperCase()} ${t.symbol} ${t.lots}`
const orderLabel = (o) => `${o.side.toUpperCase()} ${ORDER_LABEL[o.type]} ${o.lots} ${o.symbol}`
let noticeSeq = 0
let indSeq = 0
const newIndId = () => `i${Date.now().toString(36)}${(++indSeq).toString(36)}`
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
      chartType: 'candles', // 'candles' | 'line'
      dockOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
      dockTab: 'positions', // 'positions' | 'orders' | 'history'
      // ── Phase 6: indicators, drawings, layouts ──
      indicators: [], // [{ id, type, params, colors, visible }] — shown on every chart
      drawings: {}, // symbol -> [drawing]  (see lib/terminal/drawings.js)
      drawTool: 'cursor', // 'cursor' | a drawing type
      drawSticky: false, // keep the tool after each drawing
      drawSel: null, // selected drawing id
      drawHidden: false,
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
      setChartType: (chartType) => set({ chartType }),

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
        const ind = { id: newIndId(), type, params: defaultParams(type), colors: {}, visible: true }
        set((s) => ({ indicators: [...s.indicators, ind] }))
        return ind.id
      },
      updateIndicator: (id, patch) => set((s) => ({
        indicators: s.indicators.map((i) => (i.id !== id ? i : { ...i, ...patch, ...(patch.params ? { params: cleanParams(i.type, { ...i.params, ...patch.params }) } : {}), ...(patch.colors ? { colors: { ...i.colors, ...patch.colors } } : {}) })),
      })),
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
        set((s) => ({ drawings: { ...s.drawings, [symbol]: [...list, d] }, drawSel: d.id, drawTool: s.drawSticky ? s.drawTool : 'cursor' }))
        return true
      },
      updateDrawing: (symbol, id, patch) => set((s) => ({ drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).map((d) => (d.id === id ? { ...d, ...patch } : d)) } })),
      removeDrawing: (symbol, id) => set((s) => ({ drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).filter((d) => d.id !== id) }, drawSel: s.drawSel === id ? null : s.drawSel })),
      clearDrawings: (symbol) => set((s) => ({ drawings: { ...s.drawings, [symbol]: [] }, drawSel: null })),
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
      setPickRes: (field, price) => set({ pickReq: null, pickRes: { field, price, n: Date.now() } }),
      notify: (text, kind = 'info') =>
        set((s) => ({ notices: [...s.notices.slice(-2), { id: ++noticeSeq, text, kind }] })),
      dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
      // toast + (optional) sound + OS notification for loud events
      announce: (events) => {
        let loudest = null
        for (const e of events) {
          const d = describe(e)
          if (!d) continue
          get().notify(d.text, d.kind)
          if (LOUD.has(e.type)) { loudest = d; if (get().settings.sound) beep(d.kind); osNotify(d.text) }
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
          drawSticky: p.drawSticky, drawHidden: p.drawHidden,
          symbol: cell.symbol, timeframe: cell.timeframe, drawSel: null, drawTool: 'cursor', pickReq: null,
        }
      }),
      // Account switch / sign-out: forget the previous person's demo account on this browser.
      resetLocalData: () => set({
        ...L.createLedger(), journaled: {}, drawings: {}, indicators: [], layout: 1, charts: DEFAULT_CHARTS.map((c) => ({ ...c })), activeChart: 0,
        symbol: DEFAULT_CHARTS[0].symbol, timeframe: DEFAULT_CHARTS[0].timeframe, drawSel: null, drawTool: 'cursor', pickReq: null,
        settings: { ...DEFAULT_SETTINGS },
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
        get().notify(`${p.side === 'buy' ? 'Bought' : 'Sold'} ${p.lots} ${p.symbol} @ ${p.entry}`, 'info')
        return { ok: true }
      },
      closePosition: (id, quotes) => {
        const r = L.closePosition(pick(get()), id, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        get().notify(`Closed ${label(r.trade)} · ${money(r.trade.pnl)}`, r.trade.pnl >= 0 ? 'win' : 'loss')
        return { ok: true }
      },
      partialClose: (id, pct, quotes) => {
        const r = L.partialClose(pick(get()), id, pct, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        get().notify(`Closed ${pct}% · ${label(r.trade)} · ${money(r.trade.pnl)}`, r.trade.pnl >= 0 ? 'win' : 'loss')
        return { ok: true }
      },
      closeMany: (ids, quotes) => {
        const r = L.closeMany(pick(get()), ids, slipFor(get, quotes, symbolsOf(get, ids)))
        if (!r.trades.length) return { ok: false }
        set(r.ledger)
        const total = r.trades.reduce((a, t) => a + t.pnl, 0)
        get().notify(`Closed ${r.trades.length} position(s) · ${money(total)}`, total >= 0 ? 'win' : 'loss')
        return { ok: true }
      },
      reversePosition: (id, quotes) => {
        const r = L.reversePosition(pick(get()), id, slipFor(get, quotes, symbolsOf(get, [id])))
        if (r.error) { get().notify(r.error, 'error'); return { ok: false, error: r.error } }
        set(r.ledger)
        get().notify(`Reversed → ${r.position.side.toUpperCase()} ${r.position.symbol} ${r.position.lots}`, 'info')
        return { ok: true }
      },

      // ── Phase 4: modify / pending orders ──
      modifyPosition: (id, patch, quotes) => {
        const r = L.modifyPosition(pick(get()), id, patch, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        return { ok: true }
      },
      breakEven: (id, quotes) => {
        const r = L.breakEven(pick(get()), id, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        get().notify('Stop loss moved to break-even', 'info')
        return { ok: true }
      },
      placeOrder: (spec, quotes) => {
        const r = L.placeOrder(pick(get()), { tf: get().timeframe, ...spec }, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        const o = r.order
        get().notify(`Order placed: ${orderLabel(o)} @ ${o.price}${o.type === 'stoplimit' ? ` → limit ${o.limitPrice}` : ''}`, 'info')
        return { ok: true, order: o }
      },
      cancelOrder: (id) => {
        const r = L.cancelOrder(pick(get()), id)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
        get().notify(`Order cancelled: ${orderLabel(r.order)}`, 'info')
        return { ok: true }
      },
      modifyOrder: (id, patch, quotes) => {
        const r = L.modifyOrder(pick(get()), id, patch, quotes)
        if (r.error) return { ok: false, error: r.error }
        set(r.ledger)
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
        m.drawSel = null
        m.cloudMeta = sanitizeMeta(saved?.cloudMeta)
        m.cloudStatus = 'idle'
        return m
      },
      partialize: (s) => ({
        isOpen: s.isOpen, symbol: s.symbol, timeframe: s.timeframe, chartType: s.chartType,
        dockOpen: s.dockOpen, dockTab: s.dockTab, settings: s.settings,
        indicators: s.indicators, drawings: s.drawings, layout: s.layout, charts: s.charts, activeChart: s.activeChart,
        drawSticky: s.drawSticky, drawHidden: s.drawHidden,
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
