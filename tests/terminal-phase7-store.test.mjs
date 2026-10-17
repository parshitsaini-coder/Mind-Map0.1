// Phase 7 against the REAL terminal store (applyCloud, resetLocalData, persisted sync bookkeeping)
// plus a full sign-in -> trade -> new browser -> sign-in round trip with a fake Supabase.
// Run through ./tests/run.sh (it mirrors src/ with .js import extensions).
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const clone = (o) => JSON.parse(JSON.stringify(o))

// A save with junk sync bookkeeping must not crash or be trusted.
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { cloudMeta: { userId: 5, dirty: 'yes', cloudUpdatedAt: 12 } } }))

await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const { createTerminalSync } = await import('../src/lib/terminal/terminalSync.js')
const { newDrawing } = await import('../src/lib/terminal/drawings.js')
const s = () => useTerminalStore.getState()
const Q = { EURUSD: { bid: 1.0999, ask: 1.1001 } }

check('junk sync bookkeeping in an old save is discarded', s().cloudMeta.userId === null && s().cloudMeta.dirty === false && s().cloudMeta.cloudUpdatedAt === null && s().cloudStatus === 'idle')

mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { cloudMeta: { userId: 'u9', cloudUpdatedAt: '2026-10-12T10:00:01.000Z', dirty: true, localUpdatedAt: 77, force: true } } }))
await useTerminalStore.persist.rehydrate()
check('valid sync bookkeeping survives a reload', s().cloudMeta.userId === 'u9' && s().cloudMeta.dirty === true && s().cloudMeta.localUpdatedAt === 77 && s().cloudMeta.force === true)
s().resetLocalData()

// ── applyCloud / resetLocalData / resetAccount ──
s().setSettings({ notifAsked: true })
s().setDockOpen(false)
const snap = {
  hasAccount: true, account: { balance: 12345, startBalance: 10000, currency: 'USD', leverage: 50, createdAt: 5 },
  transactions: [], nextId: 40, journaled: { 'h1@9': true }, positions: [], orders: [], history: [{ id: 'h39', symbol: 'GBPUSD', side: 'buy', pnl: 10, closeTime: 9 }],
  drawings: {}, settings: { oneClick: true, lots: 0.3 },
  prefs: { indicators: [], layout: 2, charts: [{ symbol: 'GBPUSD', timeframe: 'H1' }, { symbol: 'EURUSD', timeframe: 'M5' }, { symbol: 'XAUUSD', timeframe: 'M15' }, { symbol: 'USDJPY', timeframe: 'H4' }], activeChart: 1, chartType: 'line', drawSticky: false, drawHidden: false },
}
s().applyCloud(snap)
check('applyCloud: account, history and ids replaced', s().account.balance === 12345 && s().account.leverage === 50 && s().history.length === 1 && s().nextId === 40 && s().journaled['h1@9'] === true)
check('applyCloud: synced settings applied, device-only ones kept', s().settings.oneClick === true && s().settings.lots === 0.3 && s().settings.notifAsked === true && s().dockOpen === false)
check('applyCloud: top-level symbol/timeframe follow the active chart cell', s().symbol === 'EURUSD' && s().timeframe === 'M5' && s().layout === 2 && s().chartType === 'line')
s().applyCloud({ ...snap, account: null })
check('applyCloud with no usable account keeps the local account', s().account.balance === 12345)

s().resetLocalData()
check('resetLocalData: back to a fresh $10,000 account, closed, no history/drawings/indicators', s().account.balance === 10000 && s().history.length === 0 && s().positions.length === 0 && Object.keys(s().drawings).length === 0 && s().indicators.length === 0 && s().isOpen === false && s().cloudMeta.userId === null && s().layout === 1)

const r = s().resetAccount(5000, 50)
check('resetAccount flags the next upload as a deliberate reset', r.ok && s().cloudMeta.force === true && s().account.balance === 5000)
s().resetLocalData()

// ── full round trip with a fake Supabase ──
function fakeRemote() {
  const r = { row: null, tick: 0, calls: { fetch: 0, insert: 0, update: 0 } }
  const ts = () => new Date(Date.UTC(2026, 9, 12, 10, 0, 0) + (++r.tick) * 1000).toISOString()
  r.fetch = async () => { r.calls.fetch++; return { row: r.row ? clone(r.row) : null, error: null } }
  r.insert = async (uid, cols) => { r.calls.insert++; if (r.row) return { updatedAt: null, error: { code: '23505' } }; r.row = { user_id: uid, ...clone(cols), updated_at: ts() }; return { updatedAt: r.row.updated_at, error: null } }
  r.update = async (uid, cols, exp) => { r.calls.update++; if (!r.row || r.row.updated_at !== exp) return { updatedAt: null, error: null }; r.row = { ...r.row, ...clone(cols), updated_at: ts() }; return { updatedAt: r.row.updated_at, error: null } }
  return r
}
const remote = fakeRemote()
const pulled = []
const engine = createTerminalSync({ store: useTerminalStore, remote, onPulled: (sec) => pulled.push(sec) })

// trade with the real actions, before signing in (local-only user)
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.09, tp: 1.12 }, Q)
const pid = s().positions[0].id
s().closePosition(pid, { EURUSD: { bid: 1.1010, ask: 1.1012 } })
s().openPosition({ symbol: 'EURUSD', side: 'sell', lots: 0.2, sl: 1.12, tp: 1.08 }, Q)
s().placeOrder({ symbol: 'EURUSD', lots: 0.1, type: 'limit', side: 'buy', price: 1.095 }, Q)
s().deposit(500)
s().addIndicator('rsi')
s().addDrawing('EURUSD', newDrawing('hline', [{ t: 1, p: 1.1 }]))
const before = clone({ account: s().account, positions: s().positions, orders: s().orders, history: s().history, transactions: s().transactions, nextId: s().nextId, drawings: s().drawings })

await engine.start('u1')
check('sign-in uploads the account that was built while signed out', remote.calls.insert === 1 && remote.row.positions.length === 1 && remote.row.orders.length === 1 && remote.row.history.length === 1)
check('persisted bookkeeping records the sync (survives reload)', (() => { const m = JSON.parse(mem.get('mindmap-terminal-storage')).state.cloudMeta; return m.userId === 'u1' && m.cloudUpdatedAt === remote.row.updated_at && m.dirty === false })())

// "a different browser": nothing local, same account
engine.stop()
s().resetLocalData()
await engine.start('u1')
const after = { account: s().account, positions: s().positions, orders: s().orders, history: s().history, transactions: s().transactions, nextId: s().nextId, drawings: s().drawings }
check('new browser, same login: account, positions, orders, history, deposits and drawings all come back', JSON.stringify(after) === JSON.stringify(before))
check('…indicators too, and no echo upload happened', s().indicators.length === 1 && s().indicators[0].type === 'rsi' && remote.calls.update === 0)
check('…catch-up replay is requested from the cloud save time', pulled.length === 1)
const nid = s().nextId
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.05 }, Q)
check('ids keep counting up after a restore (no collisions with restored ones)', s().positions.at(-1).id === `p${nid}`)
await engine.flush()
check('a trade on the restored device uploads normally', remote.calls.update === 1 && remote.row.positions.length === 2)

// someone else signs in on the same browser: App wipes first, so nothing leaks into their account
engine.stop()
s().resetLocalData()
const remote2 = fakeRemote()
const engine2 = createTerminalSync({ store: useTerminalStore, remote: remote2 })
await engine2.start('u2')
check('a different user on this browser starts clean and uploads nothing of the previous account', remote2.row === null && remote2.calls.insert === 0 && s().history.length === 0 && s().account.balance === 10000)
engine2.stop()

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)

