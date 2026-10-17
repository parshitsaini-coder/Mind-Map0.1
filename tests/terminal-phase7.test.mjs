// Phase 7: cloud sync — row building/parsing, compact history, the sync decision table, and the
// whole conflict flow against a fake Supabase with two simulated devices. Plain Node, no browser.
import './fixtures/legacyInstruments.js'
import { createStore } from 'zustand/vanilla'
import * as L from '../src/lib/terminal/ledger.js'
import * as C from '../src/lib/terminal/cloudSync.js'
import { createTerminalSync } from '../src/lib/terminal/terminalSync.js'
import { newDrawing } from '../src/lib/terminal/drawings.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const clone = (o) => JSON.parse(JSON.stringify(o))
const Q = { EURUSD: { bid: 1.0999, ask: 1.1001 } }

// A ledger with `n` closed trades (some carrying tf / approx extras).
function ledgerWithTrades(n, positions = 0) {
  let l = L.createLedger(10000, 100, 1000)
  for (let i = 0; i < n; i++) {
    const o = L.openPosition(l, { symbol: 'EURUSD', side: i % 2 ? 'sell' : 'buy', lots: 0.01, tf: i % 3 ? 'M15' : undefined }, Q, 1000 + i, { approx: i % 11 === 0 })
    const c = L.closePosition(o.ledger, o.position.id, { EURUSD: { bid: 1.1005 + (i % 7) * 0.0001, ask: 1.1007 + (i % 7) * 0.0001 } }, { now: 2000 + i, reason: i % 5 ? 'manual' : 'tp' })
    l = c.ledger
  }
  for (let i = 0; i < positions; i++) l = L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.09, tp: 1.12 }, Q, 3000 + i).ledger
  return l
}
const stateFrom = (ledger, extra = {}) => ({
  ...ledger, journaled: {}, drawings: {}, indicators: [], layout: 1, charts: C.DEFAULT_CHARTS.map((c) => ({ ...c })), activeChart: 0,
  chartType: 'candles', drawSticky: false, drawHidden: false,
  settings: { oneClick: false, lots: 0.01, stopOutLevel: 50, sound: true, notifAsked: false, autoJournal: false, autoSince: 0 }, ...extra,
})

// ── compact history ──────────────────────────────────────────────────────
{
  const small = ledgerWithTrades(10).history
  check('≤300 trades stay a plain array', Array.isArray(C.encodeHistory(small)) && eq(C.decodeHistory(C.encodeHistory(small)), small))
  const big = ledgerWithTrades(400).history
  const enc = C.encodeHistory(big)
  check('>300 trades are stored column-wise', !Array.isArray(enc) && enc.v === 2 && enc.rows.length === 400)
  check('compact history round-trips EXACTLY (incl. tf/approx extras, null SL/TP)', eq(C.decodeHistory(enc), big))
  const ratio = JSON.stringify(enc).length / JSON.stringify(big).length
  check(`compact form is much smaller (${(ratio * 100).toFixed(0)}% of plain)`, ratio < 0.65)
  check('decode tolerates garbage', eq(C.decodeHistory(null), []) && eq(C.decodeHistory({ v: 9 }), []) && eq(C.decodeHistory('x'), []))
}

// ── row <-> snapshot ─────────────────────────────────────────────────────
{
  let l = ledgerWithTrades(5, 2)
  const o = L.placeOrder(l, { symbol: 'EURUSD', lots: 0.1, type: 'limit', side: 'buy', price: 1.095 }, Q, 1000)
  l = o.ledger
  const d = newDrawing('hline', [{ t: 1, p: 1.1 }])
  const st = stateFrom(l, { drawings: { EURUSD: [d] }, indicators: [{ id: 'i1', type: 'sma', params: {}, colors: {}, visible: true }], journaled: { 'h1@2000': true }, layout: 2, activeChart: 1, chartType: 'line' })
  st.settings = { ...st.settings, notifAsked: true, oneClick: true, lots: 0.5 }
  const { row, trimmed } = C.buildRow(st)
  check('row has exactly the six table columns', eq(Object.keys(row).sort(), ['account', 'drawings', 'history', 'orders', 'positions', 'settings']) && trimmed === 0)
  check('device-only setting (notifAsked) is not uploaded', row.settings.terminal.notifAsked === undefined && row.settings.terminal.oneClick === true)
  const snap = C.parseRow(clone(row))
  check('account round-trips', eq(snap.account, l.account) && snap.nextId === l.nextId && eq(snap.transactions, l.transactions))
  check('positions / orders / history round-trip', eq(snap.positions, l.positions) && eq(snap.orders, l.orders) && eq(snap.history, l.history))
  check('drawings, journal map and indicators round-trip', snap.drawings.EURUSD.length === 1 && snap.drawings.EURUSD[0].id === d.id && snap.journaled['h1@2000'] === true && snap.prefs.indicators.length === 1 && snap.prefs.indicators[0].type === 'sma')
  check('layout prefs round-trip', snap.prefs.layout === 2 && snap.prefs.activeChart === 1 && snap.prefs.chartType === 'line' && snap.settings.lots === 0.5)
}

// ── never trust cloud data ───────────────────────────────────────────────
{
  const bad = C.parseRow({
    account: { v: 1, account: { balance: 'lots', startBalance: 1, leverage: 100 }, nextId: -5, transactions: 'nope', journaled: [1] },
    positions: [{ id: 'p1', symbol: 'FAKE', side: 'buy', lots: 1, entry: 1, openTime: 1 }, { id: 'p9', symbol: 'EURUSD', side: 'buy', lots: 0.1, entry: 1.1, openTime: 5 }, null, 7],
    orders: [{ id: 'o3', symbol: 'EURUSD', type: 'magic', side: 'buy', lots: 1, price: 1 }],
    history: [{ id: 'h40', symbol: 'EURUSD', side: 'sell', pnl: 5, closeTime: 9 }, { id: 'h2', symbol: 'EURUSD', side: 'x', pnl: 1, closeTime: 1 }],
    drawings: { FAKE: [], EURUSD: 'junk' }, settings: { terminal: { lots: -3, stopOutLevel: 900, sound: 'yes' }, prefs: { layout: 7, charts: 'x', activeChart: 99, indicators: [{ id: 'a', type: 'nope' }] } },
  })
  check('junk balance -> account ignored (not applied)', bad.account === null && bad.hasAccount === false)
  check('invalid positions/orders/trades are filtered out', bad.positions.length === 1 && bad.positions[0].id === 'p9' && bad.orders.length === 0 && bad.history.length === 1)
  check('nextId is forced above every existing id (no id collisions later)', bad.nextId === 41, String(bad.nextId))
  check('bad settings fall back / are dropped', bad.settings.lots === undefined && bad.settings.stopOutLevel === undefined && bad.settings.sound === undefined)
  check('bad prefs fall back to safe defaults', bad.prefs.layout === 1 && bad.prefs.charts.length === 4 && bad.prefs.activeChart === 0 && bad.prefs.indicators.length === 0)
  check('unknown symbols / non-array drawings are dropped', Object.keys(bad.drawings).every((k) => k === 'EURUSD' && Array.isArray(bad.drawings[k])) && !bad.drawings.FAKE)
  check('non-object rows are unreadable (null)', C.parseRow('garbage') === null && C.parseRow(null) === null)
  const empty = C.parseRow({ account: {}, positions: [], orders: [], history: [], drawings: {}, settings: {} })
  check('a brand-new default row parses as an EMPTY account', empty.hasAccount === false && C.isEmptySnapshot(empty))
}

// ── size guard ───────────────────────────────────────────────────────────
{
  const st = stateFrom(ledgerWithTrades(400))
  const full = C.buildRow(st)
  const tiny = C.buildRow(st, { maxBytes: JSON.stringify(full.row).length / 2 })
  const kept = C.decodeHistory(tiny.row.history)
  check('over-size row drops the OLDEST trades only', tiny.trimmed > 0 && kept.length + tiny.trimmed === 400 && kept[0].id === st.history[0].id && JSON.stringify(tiny.row).length <= JSON.stringify(full.row).length / 2)
  check('local history beyond the 2000 cap is never uploaded', C.HISTORY_CAP === 2000)
}

// ── emptiness ────────────────────────────────────────────────────────────
{
  const fresh = C.snapshotOf(stateFrom(L.createLedger(10000, 100, 1)))
  check('fresh account is empty', C.isEmptySnapshot(fresh))
  check('indicators/drawings alone do NOT make an account non-empty', C.isEmptySnapshot(C.snapshotOf(stateFrom(L.createLedger(), { indicators: [{ id: 'x' }], drawings: { EURUSD: [{}] } }))))
  check('a trade makes it non-empty', !C.isEmptySnapshot(C.snapshotOf(stateFrom(ledgerWithTrades(1)))))
  const dep = L.deposit(L.createLedger(10000, 100, 1), 500)
  check('a deposit makes it non-empty', !C.isEmptySnapshot(C.snapshotOf(stateFrom(dep.ledger))))
  check('null is empty', C.isEmptySnapshot(null))
}

// ── error classification ─────────────────────────────────────────────────
{
  const k = C.classifyError
  check('missing table -> missing', k({ code: 'PGRST205', message: "Could not find the table 'public.terminal_accounts'" }) === 'missing' && k({ code: '42P01' }) === 'missing' && k({ message: 'relation "terminal_accounts" does not exist' }) === 'missing')
  check('missing column -> missing (table needs updating)', k({ code: '42703' }) === 'missing' && k({ code: 'PGRST204' }) === 'missing')
  check('RLS / expired JWT -> auth', k({ code: '42501' }) === 'auth' && k({ message: 'JWT expired' }) === 'auth' && k({ status: 401 }) === 'auth')
  check('network -> offline', k({ message: 'TypeError: Failed to fetch' }) === 'offline')
  check('duplicate key -> conflict', k({ code: '23505' }) === 'conflict')
  check('anything else -> other, null -> null', k({ message: 'boom' }) === 'other' && k(null) === null)
}

// ── decision table ───────────────────────────────────────────────────────
{
  const empty = C.snapshotOf(stateFrom(L.createLedger(10000, 100, 1)))
  const traded = C.snapshotOf(stateFrom(ledgerWithTrades(3)))
  const T1 = '2026-10-12T10:00:00.000Z'
  const T2 = '2026-10-12T10:05:00.000Z'
  const meta = (o = {}) => ({ userId: 'u', cloudUpdatedAt: null, dirty: false, localUpdatedAt: 0, force: false, ...o })
  const d = (local, cloud, cloudTs, m) => C.decideSync({ local, cloud, cloudTs, meta: m }, 'u')
  check('no cloud row + empty local -> nothing to do', d(empty, null, null, meta()).action === 'noop')
  check('no cloud row + data -> first upload', d(traded, null, null, meta()).action === 'push')
  check('no cloud row + empty local but deliberate wipe -> upload', d(empty, null, null, meta({ force: true })).action === 'push')
  check('EMPTY local never overwrites non-empty cloud (new device)', d(empty, traded, T1, meta()).action === 'pull')
  check('…even if this browser had stale bookkeeping from another user', d(empty, traded, T1, { ...meta({ cloudUpdatedAt: T1, dirty: true }), userId: 'someone-else' }).action === 'pull')
  check('same cloud version + unsynced edits -> push', d(traded, traded, T1, meta({ cloudUpdatedAt: T1, dirty: true })).action === 'push')
  check('same cloud version + nothing new -> noop', d(traded, traded, T1, meta({ cloudUpdatedAt: T1 })).action === 'noop')
  check('cloud moved, no local edits -> pull (fast-forward)', d(traded, traded, T2, meta({ cloudUpdatedAt: T1 })).action === 'pull')
  check('cloud was RESET elsewhere, no local edits -> pull the empty account (reset is not undone)', d(traded, empty, T2, meta({ cloudUpdatedAt: T1 })).action === 'pull')
  check('first sync, local data + empty cloud -> push local', d(traded, empty, T1, meta()).action === 'push')
  check('first sync, both have data, local newer -> push', d(traded, traded, T1, meta({ localUpdatedAt: Date.parse(T1) + 1000 })).action === 'push')
  check('first sync, both have data, cloud newer -> pull', d(traded, traded, T2, meta({ localUpdatedAt: Date.parse(T1) })).action === 'pull')
  check('legacy local data (no bookkeeping) is dated by its own newest trade', d(traded, traded, T2, meta()).action === 'pull')
  check('conflict: edited here AND cloud moved, here newer -> push', d(traded, traded, T2, meta({ cloudUpdatedAt: T1, dirty: true, localUpdatedAt: Date.parse(T2) + 5000 })).action === 'push')
  const c = d(traded, traded, T2, meta({ cloudUpdatedAt: T1, dirty: true, localUpdatedAt: Date.parse(T1) + 5000 }))
  check('conflict: cloud newer -> pull AND tell the user', c.action === 'pull' && c.notify === true)
  check('deliberate reset beats an old cloud account', d(empty, traded, T2, meta({ cloudUpdatedAt: T1, dirty: true, force: true, localUpdatedAt: Date.parse(T2) + 1000 })).action === 'push')
}

// ── engine: fake Supabase + simulated devices ───────────────────────────
const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))
function fakeRemote() {
  const r = { row: null, tick: 0, failWith: null, gate: null, calls: { fetch: 0, insert: 0, update: 0 } }
  const ts = () => new Date(Date.UTC(2026, 9, 12, 10, 0, 0) + (++r.tick) * 1000).toISOString()
  r.fetch = async () => { r.calls.fetch++; if (r.failWith) return { row: null, error: r.failWith }; return { row: r.row ? clone(r.row) : null, error: null } }
  r.insert = async (uid, cols) => {
    r.calls.insert++
    if (r.failWith) return { updatedAt: null, error: r.failWith }
    if (r.row) return { updatedAt: null, error: { code: '23505', message: 'duplicate key value' } }
    r.row = { user_id: uid, ...clone(cols), updated_at: ts() }
    return { updatedAt: r.row.updated_at, error: null }
  }
  r.update = async (uid, cols, exp) => {
    r.calls.update++
    if (r.gate) await r.gate
    if (r.failWith) return { updatedAt: null, error: r.failWith }
    if (!r.row || r.row.updated_at !== exp) return { updatedAt: null, error: null }
    r.row = { ...r.row, ...clone(cols), updated_at: ts() }
    return { updatedAt: r.row.updated_at, error: null }
  }
  return r
}
function device(remote, { clock = () => Date.UTC(2026, 9, 12, 10, 30, 0), ledger } = {}) {
  const pulled = []
  const notices = []
  const store = createStore((set) => ({
    ...stateFrom(ledger || L.createLedger(10000, 100, 1)),
    symbol: 'XAUUSD', timeframe: 'M15',
    cloudMeta: { userId: null, cloudUpdatedAt: null, dirty: false, localUpdatedAt: 0, force: false }, cloudStatus: 'idle',
    applyCloud: (snap) => set((s) => ({
      ...(snap.account ? { account: snap.account } : {}),
      positions: snap.positions, orders: snap.orders, history: snap.history, transactions: snap.transactions, nextId: snap.nextId, journaled: snap.journaled, drawings: snap.drawings,
      settings: { ...s.settings, ...snap.settings }, indicators: snap.prefs.indicators, layout: snap.prefs.layout, charts: snap.prefs.charts, activeChart: snap.prefs.activeChart,
    })),
  }))
  const engine = createTerminalSync({ store, remote, now: clock, onPulled: (s) => pulled.push(s), onNotice: (t) => notices.push(t) })
  return { store, engine, pulled, notices, s: () => store.getState() }
}
const tradeOnTop = (dev, i = 99) => {
  const l = L.closePosition(L.openPosition(dev.s(), { symbol: 'EURUSD', side: 'buy', lots: 0.01 }, Q, 5000 + i).ledger, `p${dev.s().nextId}`, Q, { now: 6000 + i }).ledger
  dev.store.setState({ account: l.account, positions: l.positions, history: l.history, nextId: l.nextId })
}

// S1/S2/S3 — first upload, new device, empty local never overwrites
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(3, 1) })
  await A.engine.start('u1')
  check('S1 first sign-in with local data uploads it (1 insert)', remote.calls.insert === 1 && remote.row.history.length === 3 && remote.row.positions.length === 1)
  check('S1 bookkeeping: cloudUpdatedAt = row.updated_at, not dirty, status synced', A.s().cloudMeta.cloudUpdatedAt === remote.row.updated_at && !A.s().cloudMeta.dirty && A.s().cloudStatus === 'synced' && A.s().cloudMeta.userId === 'u1')

  const B = device(remote)
  B.store.setState({ indicators: [{ id: 'ix', type: 'sma', params: {}, colors: {}, visible: true }] }) // a fresh device with only a preference
  await B.engine.start('u1')
  check('S2 second device loads the same account, positions and history', eq(B.s().history, A.s().history) && eq(B.s().positions, A.s().positions) && B.s().account.balance === A.s().account.balance)
  check('S3 empty local did NOT overwrite the cloud (no update/insert from B)', remote.calls.update === 0 && remote.calls.insert === 1)
  await sleep(5)
  const fetchesBefore = remote.calls.fetch
  await B.engine.flush()
  check('S2 applying cloud data is not mistaken for a local edit (no echo upload, no pending save)', remote.calls.update === 0 && !B.s().cloudMeta.dirty && remote.calls.fetch === fetchesBefore && B.s().cloudStatus === 'synced')
  check('S2 catch-up hook is told when the cloud copy was saved', B.pulled.length === 1 && B.pulled[0] === Math.floor(Date.parse(remote.row.updated_at) / 1000))

  // S4 — edit -> save
  tradeOnTop(A)
  check('S4 a real change marks the device dirty', A.s().cloudMeta.dirty === true && A.s().cloudStatus === 'pending')
  await A.engine.flush()
  check('S4 flush uploads it (compare-and-swap update)', remote.calls.update === 1 && remote.row.history.length === 4 && !A.s().cloudMeta.dirty && A.s().cloudStatus === 'synced')

  // S5 — B comes back: fast-forwards (no local edits)
  await B.engine.sync()
  check('S5 other device fast-forwards to the newer cloud copy and says so', B.s().history.length === 4 && B.notices.length === 1)
  A.engine.stop(); B.engine.stop()
}

// S6 — conflict, this device newer / cloud newer
for (const aheadOfCloud of [true, false]) {
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  const clock = aheadOfCloud ? () => Date.UTC(2026, 9, 12, 12, 0, 0) : () => Date.UTC(2026, 9, 12, 8, 0, 0)
  const B = device(remote, { clock })
  await B.engine.start('u1') // B in sync with A
  tradeOnTop(A, 1)
  await A.engine.flush() // cloud moves on
  tradeOnTop(B, 2) // B edits from a stale base -> dirty
  const aHist = A.s().history.length
  await B.engine.flush()
  if (aheadOfCloud) {
    check('S6a conflict, B newer: B wins, cloud holds B\'s data', remote.row.history.length === B.s().history.length && B.s().history[0].closeTime === 6002 && !B.s().cloudMeta.dirty)
    await A.engine.sync()
    check('S6a then A fast-forwards to B\'s version', A.s().history[0].closeTime === 6002 && A.notices.length === 1)
  } else {
    check('S6b conflict, cloud newer: B yields to the cloud and is told', eq(B.s().history, A.s().history) && B.notices.length === 1 && !B.s().cloudMeta.dirty && B.s().history.length === aHist)
  }
  A.engine.stop(); B.engine.stop()
}

// S7 — a deliberate reset reaches the cloud and is not undone by the other device
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(3, 1) })
  await A.engine.start('u1')
  const B = device(remote)
  await B.engine.start('u1')
  A.store.setState({ ...L.createLedger(5000, 50, 10), cloudMeta: { ...A.s().cloudMeta, force: true } }) // what resetAccount does
  await A.engine.flush()
  check('S7 reset uploads even though the new account is empty', remote.row.history.length === 0 && remote.row.account.account.balance === 5000 && A.s().cloudMeta.force === false)
  await B.engine.sync()
  check('S7 other device adopts the reset (old data is NOT resurrected)', B.s().history.length === 0 && B.s().account.balance === 5000 && remote.row.history.length === 0)
  A.engine.stop(); B.engine.stop()
}

// S7b — "Clear all data": local wiped (bookkeeping too), forcePush(known ts) must still reach the cloud
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(3) })
  await A.engine.start('u1')
  const known = A.s().cloudMeta.cloudUpdatedAt
  A.store.setState({ ...stateFrom(L.createLedger()), cloudMeta: { userId: null, cloudUpdatedAt: null, dirty: false, localUpdatedAt: 0, force: false } })
  await A.engine.forcePush(known)
  check('S7b forcePush wipes the cloud copy of an emptied account', remote.row.history.length === 0 && remote.row.positions.length === 0)
  A.engine.stop()
}

// S8 — table not created
{
  const remote = fakeRemote()
  remote.failWith = { code: 'PGRST205', message: "Could not find the table 'public.terminal_accounts' in the schema cache" }
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  check('S8 missing table -> status "missing", app keeps working locally', A.s().cloudStatus === 'missing' && A.s().history.length === 2)
  const before = remote.calls.fetch
  tradeOnTop(A)
  await A.engine.flush(); await A.engine.sync()
  check('S8 …and it stops calling the server for the rest of the session', remote.calls.fetch === before && A.s().history.length === 3)
  A.engine.stop()
}

// S9 — offline then back
{
  const remote = fakeRemote()
  remote.failWith = { message: 'TypeError: Failed to fetch' }
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  check('S9 offline -> status offline, local data untouched', A.s().cloudStatus === 'offline' && A.s().history.length === 2)
  remote.failWith = null
  await A.engine.sync()
  check('S9 back online -> uploads and reports synced', A.s().cloudStatus === 'synced' && remote.row.history.length === 2)
  A.engine.stop()
}

// S10 — unreadable row is never overwritten
{
  const remote = fakeRemote()
  remote.row = 'garbage'
  remote.fetch = async () => ({ row: 'garbage', error: null })
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  check('S10 unreadable cloud row -> status unreadable, nothing written', A.s().cloudStatus === 'unreadable' && remote.calls.update === 0 && remote.calls.insert === 0)
  A.engine.stop()
}

// S11 — edits made while an upload is in flight are not lost
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  let release
  remote.gate = new Promise((r) => { release = r })
  tradeOnTop(A, 1)
  const p = A.engine.flush()
  await sleep(5)
  tradeOnTop(A, 2) // edit during the request
  release()
  await p
  check('S11 edit during upload keeps the device dirty (will upload again)', A.s().cloudMeta.dirty === true)
  remote.gate = null
  await A.engine.flush()
  check('S11 …and the follow-up save carries it', remote.row.history.length === 4 && !A.s().cloudMeta.dirty)
  A.engine.stop()
}

// S12 — two fresh devices race to create the row
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  const B = device(remote, { ledger: ledgerWithTrades(3) })
  await Promise.all([A.engine.start('u1'), B.engine.start('u1')])
  check('S12 insert race: exactly one row, both devices end up identical, nothing duplicated', eq(A.s().history, B.s().history) && remote.row.history.length === A.s().history.length)
  A.engine.stop(); B.engine.stop()
}

// S13 — sign-out / user switch stops syncing
{
  const remote = fakeRemote()
  const A = device(remote, { ledger: ledgerWithTrades(2) })
  await A.engine.start('u1')
  A.engine.stop()
  const calls = { ...remote.calls }
  tradeOnTop(A)
  await A.engine.flush(); await A.engine.sync()
  check('S13 after stop() nothing is uploaded', eq(remote.calls, calls) && A.s().cloudStatus === 'idle')
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
