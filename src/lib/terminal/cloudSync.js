// Phase 7 — pure cloud-sync logic for the demo terminal. No React, no Supabase, no storage:
// everything here is unit-tested directly (tests/terminal-phase7.test.mjs).
//
// One row per user in `public.terminal_accounts`:
//   account   { v, account:{balance,startBalance,currency,leverage,createdAt}, transactions[], nextId, journaled{} }
//   positions []        orders []        history  (plain array, or compact — see encodeHistory)
//   drawings  { SYMBOL: [drawing] }
//   settings  { v, terminal:{...terminal settings}, prefs:{ indicators, layout, charts, activeChart, chartType, drawSticky, drawHidden } }
import { SYMBOLS, KNOWN_SYMBOLS, TIMEFRAMES } from './instruments.js'
import { INDICATOR_DEFS, cleanParams, MAX_INDICATORS } from './indicators.js'
import { cleanVisibility, sanitizeDrawings, cleanDefaultsMap, cleanTemplateMap } from './drawings.js'
import { LEVERAGES } from './ledger.js'
import { cleanChartSettings, CHART_TYPE_IDS } from './chartSettings.js'

export const CLOUD_VERSION = 1
export const HISTORY_CAP = 2000 // same cap the local (persisted) copy uses
export const COMPACT_AT = 300 // history longer than this is stored compactly
export const MAX_ROW_BYTES = 4_000_000 // keep one upsert comfortably under typical request limits
export const TX_CAP = 200

export const DEFAULT_CHARTS = [
  { symbol: 'XAUUSD', timeframe: 'M15' }, { symbol: 'XAUUSD', timeframe: 'M5' },
  { symbol: 'XAUUSD', timeframe: 'H1' }, { symbol: 'XAUUSD', timeframe: 'H4' },
]
export const validCell = (c) => c && SYMBOLS.includes(c.symbol) && TIMEFRAMES.some((t) => t.id === c.timeframe)

// Saved indicator list -> only entries that still make sense (unknown types / junk are dropped).
// per-line look: { key: { width 1-4, lineStyle, hidden } } — only keys the indicator really has
export function cleanLineStyles(type, raw) {
  const out = {}
  const r = raw && typeof raw === 'object' ? raw : {}
  for (const ln of INDICATOR_DEFS[type].lines) {
    const v = r[ln.key]
    if (!v || typeof v !== 'object') continue
    out[ln.key] = { width: Number.isInteger(v.width) && v.width >= 1 && v.width <= 4 ? v.width : (ln.width || 1), lineStyle: ['solid', 'dashed', 'dotted'].includes(v.lineStyle) ? v.lineStyle : (ln.dash ? 'dashed' : 'solid'), hidden: !!v.hidden }
  }
  return out
}
export const sanitizeIndicators = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((i) => i && typeof i.id === 'string' && INDICATOR_DEFS[i.type])
    .slice(0, MAX_INDICATORS)
    .map((i) => ({
      id: i.id, type: i.type, params: cleanParams(i.type, i.params), colors: i.colors && typeof i.colors === 'object' ? i.colors : {}, visible: i.visible !== false,
      styles: cleanLineStyles(i.type, i.styles), visibility: cleanVisibility(i.visibility),
      paneSize: [0.5, 1, 2].includes(i.paneSize) ? i.paneSize : 1, collapsed: !!i.collapsed,
    }))

// Store keys whose change means "there is something new to upload".
export const SYNCED_KEYS = [
  'account', 'positions', 'orders', 'history', 'transactions', 'journaled', 'nextId',
  'drawings', 'settings', 'chartSettings', 'indicators', 'layout', 'charts', 'activeChart', 'chartType', 'drawSticky', 'drawHidden', 'drawDefaults', 'drawTemplates',
]

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const num = (v) => typeof v === 'number' && Number.isFinite(v)
const str = (v) => typeof v === 'string' && v.length > 0 && v.length < 80

// ── compact history ──────────────────────────────────────────────────────
// Closed trades repeat the same 14 key names thousands of times. Above COMPACT_AT trades they are
// stored column-wise: { v:2, cols:[...], rows:[[...values], ...] }; rare extra fields (tf, approx…)
// ride in an optional last element. decodeHistory() accepts both shapes.
const H_CORE = ['id', 'positionId', 'symbol', 'side', 'lots', 'entry', 'exit', 'sl', 'tp', 'openTime', 'closeTime', 'pnl', 'pips', 'reason']

export function encodeHistory(history) {
  const list = Array.isArray(history) ? history : []
  if (list.length <= COMPACT_AT) return list
  const rows = list.map((h) => {
    const row = H_CORE.map((k) => (h[k] === undefined ? null : h[k]))
    const extra = {}
    let any = false
    for (const k of Object.keys(h)) if (!H_CORE.includes(k) && h[k] !== undefined) { extra[k] = h[k]; any = true }
    if (any) row.push(extra)
    return row
  })
  return { v: 2, cols: H_CORE, rows }
}

export function decodeHistory(raw) {
  if (Array.isArray(raw)) return raw
  if (!isObj(raw) || raw.v !== 2 || !Array.isArray(raw.cols) || !Array.isArray(raw.rows)) return []
  const cols = raw.cols.filter((c) => typeof c === 'string')
  return raw.rows.filter(Array.isArray).map((row) => {
    const h = {}
    cols.forEach((k, i) => { h[k] = row[i] === undefined ? null : row[i] })
    const extra = row[cols.length]
    if (isObj(extra)) Object.assign(h, extra)
    return h
  })
}

// ── validation of cloud data (never trust a stored blob) ────────────────
const okPosition = (p) => isObj(p) && str(p.id) && KNOWN_SYMBOLS.includes(p.symbol) && (p.side === 'buy' || p.side === 'sell') && num(p.lots) && p.lots > 0 && num(p.entry) && num(p.openTime)
const okOrder = (o) => isObj(o) && str(o.id) && KNOWN_SYMBOLS.includes(o.symbol) && ['limit', 'stop', 'stoplimit'].includes(o.type) && (o.side === 'buy' || o.side === 'sell') && num(o.lots) && o.lots > 0 && num(o.price)
const okTrade = (h) => isObj(h) && str(h.id) && KNOWN_SYMBOLS.includes(h.symbol) && (h.side === 'buy' || h.side === 'sell') && num(h.pnl) && num(h.closeTime)
const okTx = (t) => isObj(t) && str(t.id) && (t.type === 'deposit' || t.type === 'withdraw') && num(t.amount) && num(t.time)

// numeric suffix of ids like p12 / h40 / o7 / x3 — nextId must stay above all of them.
const idNum = (id) => { const m = /^[a-z](\d+)$/.exec(id || ''); return m ? Number(m[1]) : 0 }

// ── snapshot  <->  row ───────────────────────────────────────────────────
// The terminal-settings keys that are about THIS device, not the account, are left out.
const DEVICE_SETTINGS = ['notifAsked', 'wakeLock']

export function snapshotOf(s) {
  return {
    account: s.account, transactions: s.transactions || [], nextId: s.nextId, journaled: s.journaled || {},
    positions: s.positions || [], orders: s.orders || [], history: s.history || [],
    drawings: s.drawings || {}, settings: s.settings || {},
    prefs: { indicators: s.indicators || [], layout: s.layout, charts: s.charts, activeChart: s.activeChart, chartType: s.chartType, drawSticky: !!s.drawSticky, drawHidden: !!s.drawHidden, chart: s.chartSettings || null, drawDefaults: s.drawDefaults || {}, drawTemplates: s.drawTemplates || {} },
  }
}

// Store state -> the six table columns. Returns { row, trimmed } — `trimmed` is how many of the
// oldest trades had to be left out to keep the row under MAX_ROW_BYTES (0 almost always).
export function buildRow(state, { maxBytes = MAX_ROW_BYTES } = {}) {
  const s = snapshotOf(state)
  const terminal = Object.fromEntries(Object.entries(s.settings).filter(([k]) => !DEVICE_SETTINGS.includes(k)))
  let history = s.history.slice(0, HISTORY_CAP)
  const make = (h) => ({
    account: { v: CLOUD_VERSION, account: s.account, transactions: s.transactions.slice(0, TX_CAP), nextId: s.nextId, journaled: s.journaled },
    positions: s.positions,
    orders: s.orders,
    history: encodeHistory(h),
    drawings: s.drawings,
    settings: { v: CLOUD_VERSION, terminal, prefs: s.prefs },
  })
  let row = make(history)
  let trimmed = 0
  // history is newest-first, so dropping from the tail drops the OLDEST trades
  while (JSON.stringify(row).length > maxBytes && history.length > 0) {
    const keep = Math.floor(history.length * 0.8)
    trimmed += history.length - keep
    history = history.slice(0, keep)
    row = make(history)
  }
  return { row, trimmed }
}

// Table row -> store-ready, sanitised snapshot. Returns null when the row is unusable
// (so the caller keeps the local copy instead of applying garbage).
export function parseRow(row) {
  if (!isObj(row)) return null
  const A = isObj(row.account) ? row.account : {}
  const a = isObj(A.account) ? A.account : null
  // An account with no ledger numbers at all is a brand-new/empty row, not corrupt data.
  const hasAccount = a && num(a.balance) && num(a.startBalance) && LEVERAGES.includes(a.leverage)
  const positions = (Array.isArray(row.positions) ? row.positions : []).filter(okPosition)
  const orders = (Array.isArray(row.orders) ? row.orders : []).filter(okOrder)
  const history = decodeHistory(row.history).filter(okTrade).slice(0, HISTORY_CAP)
  const transactions = (Array.isArray(A.transactions) ? A.transactions : []).filter(okTx).slice(0, TX_CAP)
  const journaled = isObj(A.journaled) ? Object.fromEntries(Object.entries(A.journaled).filter(([k, v]) => v === true && k.length < 60)) : {}
  const maxId = Math.max(0, ...positions.map((p) => idNum(p.id)), ...orders.map((o) => idNum(o.id)), ...history.map((h) => idNum(h.id)), ...history.map((h) => idNum(h.positionId)), ...transactions.map((t) => idNum(t.id)))
  const nextId = Math.max(num(A.nextId) && A.nextId >= 1 ? Math.floor(A.nextId) : 1, maxId + 1)

  const drawingsIn = isObj(row.drawings) ? row.drawings : {}
  const drawings = Object.fromEntries(Object.entries(drawingsIn).filter(([k]) => SYMBOLS.includes(k)).map(([k, v]) => [k, sanitizeDrawings(v)]))

  const S = isObj(row.settings) ? row.settings : {}
  const terminal = isObj(S.terminal) ? S.terminal : {}
  const P = isObj(S.prefs) ? S.prefs : {}
  const layout = [1, 2, 4].includes(P.layout) ? P.layout : 1
  const charts = Array.isArray(P.charts) && P.charts.length === 4 && P.charts.every(validCell)
    ? P.charts.map((c) => ({ symbol: c.symbol, timeframe: c.timeframe })) : DEFAULT_CHARTS.map((c) => ({ ...c }))
  const activeChart = Number.isInteger(P.activeChart) && P.activeChart >= 0 && P.activeChart < layout ? P.activeChart : 0

  const settings = {}
  if (typeof terminal.oneClick === 'boolean') settings.oneClick = terminal.oneClick
  if (num(terminal.lots) && terminal.lots > 0 && terminal.lots <= 100) settings.lots = terminal.lots
  if (num(terminal.stopOutLevel) && terminal.stopOutLevel >= 0 && terminal.stopOutLevel <= 100) settings.stopOutLevel = terminal.stopOutLevel
  if (typeof terminal.sound === 'boolean') settings.sound = terminal.sound
  if (typeof terminal.autoJournal === 'boolean') settings.autoJournal = terminal.autoJournal
  if (num(terminal.autoSince) && terminal.autoSince >= 0) settings.autoSince = terminal.autoSince
  if (terminal.spreadMode === 'fixed' || terminal.spreadMode === 'variable') settings.spreadMode = terminal.spreadMode
  if (typeof terminal.slippage === 'boolean') settings.slippage = terminal.slippage

  const snap = {
    hasAccount: !!hasAccount,
    account: hasAccount ? { balance: a.balance, startBalance: a.startBalance, currency: typeof a.currency === 'string' ? a.currency : 'USD', leverage: a.leverage, createdAt: num(a.createdAt) ? a.createdAt : Math.floor(Date.now() / 1000), ...(num(a.commission) && a.commission > 0 && a.commission <= 100 ? { commission: a.commission } : {}) } : null,
    transactions, nextId, journaled, positions, orders, history, drawings, settings,
    prefs: { indicators: sanitizeIndicators(P.indicators), layout, charts, activeChart, chartType: CHART_TYPE_IDS.includes(P.chartType) ? P.chartType : 'candles', drawSticky: !!P.drawSticky, drawHidden: !!P.drawHidden, chart: isObj(P.chart) ? cleanChartSettings(P.chart) : null, drawDefaults: cleanDefaultsMap(P.drawDefaults), drawTemplates: cleanTemplateMap(P.drawTemplates) },
  }
  return snap
}

// ── emptiness / activity ────────────────────────────────────────────────
// "Empty" = no trading data worth protecting: no positions, orders, history or transactions, and
// the balance was never changed. A fresh install, or a freshly reset account. Drawings and
// indicators are preferences, not account data, so they don't count — otherwise a new device where
// someone merely added an indicator could overwrite a real cloud account.
export function isEmptySnapshot(s) {
  if (!s) return true
  if (s.positions?.length || s.orders?.length || s.history?.length || s.transactions?.length) return false
  if (s.account && s.account.balance !== s.account.startBalance) return false
  return true
}

// Newest timestamp (ms) found in the trading data — used to date legacy local data that has no
// sync bookkeeping yet (accounts that existed before Phase 7).
export function lastActivityMs(s) {
  let t = 0
  for (const h of s.history || []) t = Math.max(t, (h.closeTime || 0) * 1000)
  for (const p of s.positions || []) t = Math.max(t, (p.openTime || 0) * 1000)
  for (const o of s.orders || []) t = Math.max(t, (o.createdAt || o.time || 0) * 1000)
  for (const x of s.transactions || []) t = Math.max(t, (x.time || 0) * 1000)
  return t
}

const sameInstant = (a, b) => !!a && !!b && Date.parse(a) === Date.parse(b)

// ── the decision ─────────────────────────────────────────────────────────
// local / cloud are snapshots (cloud null = no row yet). meta = { userId, cloudUpdatedAt, dirty,
// localUpdatedAt, force }. Returns { action: 'noop'|'pull'|'push', reason, notify? }.
//
// Rules, in order:
//  1. no cloud row            -> push local (unless local is empty and wasn't deliberately cleared)
//  2. cloud unchanged since our last sync -> push only if we have unsynced local edits
//  3. cloud changed since our last sync:
//       a. we have no unsynced edits -> pull (fast-forward). Even when the cloud is now EMPTY: that is
//          a deliberate reset/clear made on another device, and must not be undone by this one.
//       b. local empty (and not a deliberate reset)  -> pull   ← never overwrite a non-empty cloud with an empty local
//       c. cloud empty                               -> push
//       d. both have data AND we edited: the newer `updated_at` wins
export function decideSync({ local, cloud, cloudTs, meta }, userId) {
  const m = meta && meta.userId === userId ? meta : { userId, cloudUpdatedAt: null, dirty: false, localUpdatedAt: 0, force: false }
  const force = !!m.force
  const localEmpty = isEmptySnapshot(local)
  if (!cloud) {
    if (localEmpty && !force) return { action: 'noop', reason: 'nothing to save yet' }
    return { action: 'push', reason: 'first upload' }
  }
  if (sameInstant(m.cloudUpdatedAt, cloudTs)) {
    return m.dirty ? { action: 'push', reason: 'local changes' } : { action: 'noop', reason: 'in sync' }
  }
  if (m.cloudUpdatedAt && !m.dirty && !force) return { action: 'pull', reason: 'cloud is newer', notify: true }
  const cloudEmpty = isEmptySnapshot(cloud)
  if (localEmpty && !force) return cloudEmpty ? { action: 'noop', reason: 'both empty' } : { action: 'pull', reason: 'adopt cloud account' }
  if (cloudEmpty) return { action: 'push', reason: 'cloud account is empty' }
  const localMs = Math.max(m.localUpdatedAt || 0, lastActivityMs(local))
  const cloudMs = Date.parse(cloudTs) || 0
  return localMs >= cloudMs
    ? { action: 'push', reason: 'conflict — this device is newer' }
    : { action: 'pull', reason: 'conflict — cloud is newer', notify: true }
}

// ── errors ───────────────────────────────────────────────────────────────
// -> 'missing' (table/columns not created) | 'auth' | 'offline' | 'conflict' | 'other'
export function classifyError(err) {
  if (!err) return null
  const code = String(err.code || '')
  const msg = String(err.message || err.details || err || '').toLowerCase()
  if (code === '23505') return 'conflict'
  if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || code === '42703' || (err.status === 404 && /relation|schema cache|does not exist|could not find/.test(msg))) return 'missing'
  if (/relation .* does not exist|could not find the table|schema cache|column .* does not exist/.test(msg)) return 'missing'
  if (code === '42501' || code === 'PGRST301' || err.status === 401 || err.status === 403 || /jwt|row-level security|permission denied/.test(msg)) return 'auth'
  if (/failed to fetch|networkerror|network request failed|load failed|offline/.test(msg)) return 'offline'
  return 'other'
}

export const STATUS_TEXT = {
  idle: '', syncing: 'Syncing…', synced: 'Saved to cloud', pending: 'Saving…', offline: 'Offline — will sync when back online',
  missing: 'Cloud not set up (saved on this device only)', auth: 'Sign in again to sync', error: 'Cloud sync problem — retrying', signedout: 'Sign in to sync across devices',
  unreadable: 'Cloud copy unreadable — kept this device\'s data',
}
