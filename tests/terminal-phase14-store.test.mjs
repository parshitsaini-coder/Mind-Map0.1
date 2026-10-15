// Phase 14 slice 2 against the REAL store: closed market rejects orders and never triggers SL/TP, async catch-up replays
// real candles from the (faked) /api, migration actions. Run through ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// fake /api/candles: M1 candles for the requested window
let apiCalls = []
let candleScript = () => []
globalThis.fetch = async (url) => {
  apiCalls.push(String(url))
  const u = new URL(String(url), 'http://x')
  const body = u.pathname.endsWith('/candles') ? { symbol: u.searchParams.get('symbol'), tf: 'M1', source: 'twelvedata', serverTime: 1, candles: candleScript(u) } : { serverTime: 1, quotes: {} }
  return { ok: true, status: 200, json: async () => body }
}
const { useTerminalStore } = await import('../src/store/terminalStore.js')
const s = () => useTerminalStore.getState()
const OPEN = { EURUSD: { symbol: 'EURUSD', bid: 1.16, ask: 1.1602, mid: 1.1601, closed: false } }
const SHUT = { EURUSD: { symbol: 'EURUSD', bid: 1.16, ask: 1.1602, mid: 1.1601, closed: true } }

const r1 = s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1 }, SHUT)
check('closed market: market order rejected with the opening time', !r1.ok && /^Market closed/.test(r1.error) && s().positions.length === 0, r1.error)
const r2 = s().placeOrder({ symbol: 'EURUSD', type: 'limit', side: 'buy', lots: 0.1, price: 1.15 }, SHUT)
check('closed market: pending order rejected', !r2.ok && /^Market closed/.test(r2.error))
const r3 = s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.159 }, OPEN)
check('open market: order accepted', r3.ok && s().positions.length === 1, JSON.stringify(r3))
s().tick({ EURUSD: { ...SHUT.EURUSD, bid: 1.15, ask: 1.1502, mid: 1.1501 } })
check('closed market: a stale price below SL does NOT stop the position out', s().positions.length === 1)
s().tick({ EURUSD: { ...OPEN.EURUSD, bid: 1.15, ask: 1.1502, mid: 1.1501 } })
check('open market: the same price DOES trigger the SL', s().positions.length === 0 && s().history.length === 1 && s().history[0].reason === 'sl')

// ── async catch-up on real candles ──
const NOW = Math.floor(Date.now() / 1000)
const t0 = Math.floor((NOW - 3600) / 60) * 60
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.1590, tp: 1.1620 }, OPEN)
const pid = s().positions[0].id
candleScript = () => Array.from({ length: 60 }, (_, i) => {
  const t = t0 + i * 60
  // minute 20 touches BOTH tp and sl: conservative rule => SL first
  if (i === 20) return { time: t, open: 1.1601, high: 1.1625, low: 1.1585, close: 1.1601, volume: 0 }
  return { time: t, open: 1.1601, high: 1.1603, low: 1.1599, close: 1.1601, volume: 0 }
})
apiCalls = []
await s().catchUp(t0 - 60, NOW - 60)
check('catch-up fetched M1 candles from /api only', apiCalls.length >= 1 && apiCalls.every((u) => u.startsWith('/api/candles?')) && apiCalls[0].includes('tf=M1'))
const h = s().history.find((x) => x.positionId === pid)
check('catch-up: candle touching SL and TP => SL first (documented conservative rule)', !!h && h.reason === 'sl' && h.approx === true, JSON.stringify(h))
check('catch-up: position closed, notice shown', s().positions.length === 0 && s().notices.some((n) => /While you were away/.test(n.text)))

s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.1500 }, OPEN)
candleScript = () => { throw new Error('boom') }
globalThis.fetch = async () => { throw new TypeError('offline') }
const before = JSON.stringify(s().positions)
await s().catchUp(NOW - 7200, NOW - 60)
check('catch-up with no price data: ledger untouched, person told', JSON.stringify(s().positions) === before && s().notices.some((n) => /Could not check/.test(n.text)))

// ── migration actions ──
const old = Math.floor(Date.UTC(2026, 8, 1) / 1000)
useTerminalStore.setState({ positions: [{ id: 'pOld', symbol: 'XAUUSD', side: 'buy', lots: 0.2, entry: 4300, sl: null, tp: null, openTime: old }], orders: [{ id: 'oOld', symbol: 'EURUSD', type: 'limit', side: 'buy', lots: 0.1, price: 1.1, createdAt: old }], history: [{ id: 'hOld', symbol: 'EURUSD', side: 'buy', lots: 0.1, entry: 1.1, exit: 1.11, openTime: old, closeTime: old + 60, pnl: 100, pips: 100, reason: 'manual' }] })
const bal = s().account.balance
s().migrateKeepHistory()
check('migration keep: open trade flat, pending cancelled, history tagged, balance unchanged', s().positions.length === 0 && s().orders.length === 0 && s().account.balance === bal && s().history.filter((x) => x.source === 'simulated').length === s().history.filter((x) => x.closeTime < Math.floor(Date.UTC(2026, 9, 15) / 1000)).length && s().history.some((x) => x.reason === 'migrated' && x.pnl === 0))
useTerminalStore.setState({ positions: [{ id: 'pOld2', symbol: 'XAUUSD', side: 'buy', lots: 0.2, entry: 4300, openTime: old }] })
s().migrateFreshAccount()
check('migration fresh: empty ledger, start balance kept', s().positions.length === 0 && s().history.length === 0 && s().account.balance === s().account.startBalance)

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
