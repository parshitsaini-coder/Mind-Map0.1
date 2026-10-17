// Phase 14 against the REAL store: closed-market rules, real-candle catch-up through the API,
// old-save migration, XAUUSD-only fallbacks. Run via ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// an OLD save: simulated-era account with EURUSD + XAUUSD items and a removed symbol selected
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: {
  symbol: 'EURUSD', timeframe: 'H1', charts: [{ symbol: 'EURUSD', timeframe: 'M15' }, { symbol: 'GBPUSD', timeframe: 'M15' }, { symbol: 'USDJPY', timeframe: 'H1' }, { symbol: 'NIFTY50', timeframe: 'H1' }],
  account: { balance: 10250, startBalance: 10000, currency: 'USD', leverage: 100, createdAt: 1 },
  positions: [{ id: 'p1', symbol: 'EURUSD', side: 'buy', lots: 0.5, entry: 1.1, openTime: 5, leverage: 100 }],
  orders: [{ id: 'o2', symbol: 'XAUUSD', type: 'limit', side: 'buy', lots: 1, price: 4000, createdAt: 3 }],
  history: [{ id: 'h1', symbol: 'GBPUSD', side: 'buy', lots: 1, entry: 1.3, exit: 1.31, pnl: 25, closeTime: 9, openTime: 1, reason: 'manual' }],
  nextId: 12,
} }))
const { setTradeGate, useTerminalStore } = await import('../src/store/terminalStore.js')
const M = await import('../src/lib/terminal/liveMigration.js')
const { INSTRUMENTS, SYMBOLS } = await import('../src/lib/terminal/instruments.js')
const s = () => useTerminalStore.getState()

check('instruments: XAUUSD only', SYMBOLS.length === 1 && SYMBOLS[0] === 'XAUUSD' && Object.keys(INSTRUMENTS).length === 1)
check('old save: removed symbol -> XAUUSD, all 4 chart cells are XAUUSD', s().symbol === 'XAUUSD' && s().charts.every((c) => c.symbol === 'XAUUSD') && s().charts.length === 4, JSON.stringify(s().charts))
check('old save keeps its trades (not silently dropped) and its balance', s().history.length === 1 && s().positions.length === 1 && s().orders.length === 1 && s().account.balance === 10250)
check('old save needs the migration dialog', M.needsMigration(s()))
const Q = { XAUUSD: { bid: 4350, ask: 4350.3 } }

// closed market / no live price
let msg = 'Market closed — opens in 5h 12m'
setTradeGate(() => msg)
let r = s().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, Q)
check('market closed: market order refused with the countdown, nothing opened', r.ok === false && r.error === msg && s().positions.length === 1)
r = s().closePosition('p1', Q)
check('market closed: closing at a stale price is refused too', r.ok === false && s().positions.length === 1)
r = s().placeOrder({ symbol: 'XAUUSD', lots: 0.1, type: 'limit', side: 'buy', price: 4300 }, Q)
check('market closed: pending orders are still accepted (they just wait)', r.ok === true && s().orders.length === 2 && s().orders[1].source === 'live')

// migration (keep)
const bal = s().account.balance
check('keep: ok, balance unchanged, old open trade closed flat, old order gone, live pending order kept', (() => {
  const x = s().migrateToLive('keep')
  const flat = s().history.find((h) => h.positionId === 'p1')
  return x.ok && s().account.balance === bal && flat && flat.pnl === 0 && flat.source === 'simulated' && s().positions.length === 0 && s().orders.length === 1 && s().orders[0].source === 'live'
})())
check('keep: old history tagged simulated; dialog no longer needed', s().history.every((h) => h.source === 'simulated') && !M.needsMigration(s()))
check('migration is idempotent (second call does nothing)', s().migrateToLive('keep').noop === true && s().history.length === 2)

// live trades are tagged live, and a fresh migration never touches them
setTradeGate(() => null)
r = s().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, Q)
check('live position is tagged source:live and does not re-trigger migration', r.ok && s().positions[0].source === 'live' && !M.needsMigration(s()))
s().closePosition(s().positions[0].id, { XAUUSD: { bid: 4351, ask: 4351.3 } })
check('live trade in history is tagged live', s().history[0].source === 'live')
check('stats exclude simulated by default', M.liveOnly(s().history, s().showSimulated).length === 1 && (s().setShowSimulated(true), M.liveOnly(s().history, s().showSimulated).length === 3))

// real-candle catch-up through the (fake) /api/candles
s().resetLocalData()
setTradeGate(() => null)
s().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 1, sl: 4340, tp: 4400 }, Q)
const T0 = 1_700_000_000 - (1_700_000_000 % 60)
const mk = (n, f) => Array.from({ length: n }, (_, i) => f(T0 + 60 * i, i))
let asked = []
globalThis.fetch = async (url) => {
  asked.push(String(url))
  const u = new URL(String(url), 'http://x')
  const tf = u.searchParams.get('tf')
  const step = tf === 'M5' ? 300 : 60
  const n = Math.min(Number(u.searchParams.get('limit')), 5000)
  const candles = Array.from({ length: n }, (_, i) => {
    const t = T0 + step * i - step * 20
    const crash = t >= T0 + 60 * 90 && t < T0 + 60 * 91
    return { time: t, open: 4350, high: crash ? 4351 : 4351, low: crash ? 4330 : 4349, close: crash ? 4332 : 4350, volume: 1 }
  })
  return { ok: true, status: 200, json: async () => ({ provider: 'Twelve Data', candles }) }
}
await s().catchUp(T0, T0 + 60 * 150)
check('catch-up: 2.5 h away -> 1-min candles from the API, SL found and closed', asked.some((u) => /tf=M1/.test(u)) && s().positions.length === 0 && s().history[0].reason === 'sl' && s().history[0].approx === true, JSON.stringify(s().history[0]))
check('catch-up: the trade log says it was replayed from real candles', s().notices.some((n) => /real 1-min candles/.test(n.text)))
asked = []
s().openPosition({ symbol: 'XAUUSD', side: 'buy', lots: 1, sl: 3000, tp: 9000 }, Q)
await s().catchUp(T0, T0 + 86400 * 6)
check('catch-up: 6 days away -> coarser 5-min candles', asked.some((u) => /tf=M5/.test(u)))
globalThis.fetch = async () => { throw new TypeError('offline') }
const nH = s().history.length
await s().catchUp(T0, T0 + 60 * 150)
check('catch-up while offline: no crash, nothing invented (falls back to stored candles)', s().history.length === nH)

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
