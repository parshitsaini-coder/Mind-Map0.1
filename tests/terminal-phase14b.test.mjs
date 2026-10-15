// Phase 14 slice 2 (pure): browser client, polling hub, spread-over-live-mid. Fake fetch / clock / timers, no network.
import { createLiveClient, FeedClientError } from '../src/lib/terminal/feed/liveClient.js'
import { createLiveHub } from '../src/lib/terminal/feed/liveHub.js'
import { quoteFromMid, setSpreadMode } from '../src/lib/terminal/feed/spread.js'
import { mockClient } from './fixtures/mockFeed.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const tick = (last, ts, extra = {}) => ({ last, bid: null, ask: null, ts, source: 'twelvedata', ...extra })
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

// ── client ──
{
  const urls = []
  const c = createLiveClient({ fetchImpl: async (u) => { urls.push(u); return resp(200, { serverTime: 5, source: 'twelvedata', candles: [{ time: 2, open: 1, high: 1, low: 1, close: 1 }, { time: 1, open: 1, high: 1, low: 1, close: 1 }, { time: 2, open: 1, high: 2, low: 1, close: 2 }, { time: 3, close: NaN }] }) } })
  const r = await c.getCandles('XAUUSD', 'M15', { limit: 5 })
  check('client: same-origin /api/candles URL, no vendor, no key', urls[0].startsWith('/api/candles?') && urls[0].includes('symbol=XAUUSD') && !/apikey|twelvedata\.com|finnhub\.io/i.test(urls[0]))
  check('client: candles sorted, de-duplicated, junk dropped', r.candles.length === 2 && r.candles[0].time === 1 && r.candles[1].close === 2)
  const q = await createLiveClient({ fetchImpl: async (u) => { urls.push(u); return resp(200, { serverTime: 1, quotes: { EURUSD: tick(1.1, 1) } }) } }).getQuotes(['EURUSD', 'XAUUSD'])
  check('client: quotes batched in one call', urls[1].includes('symbols=EURUSD%2CXAUUSD') && q.quotes.EURUSD.last === 1.1)
  const err = await createLiveClient({ fetchImpl: async () => resp(429, { error: { code: 'rate_limited', message: 'slow down', retryAfter: 30 } }) }).getQuotes(['EURUSD']).catch((e) => e)
  check('client: typed server error with retryAfter', err instanceof FeedClientError && err.code === 'rate_limited' && err.retryAfter === 30 && err.status === 429)
  const net = await createLiveClient({ fetchImpl: async () => { throw new TypeError('x') } }).getQuotes(['EURUSD']).catch((e) => e)
  check('client: network failure -> code network', net.code === 'network')
  const bad = await createLiveClient({ fetchImpl: async () => resp(200, null) }).getQuotes(['EURUSD']).catch((e) => e)
  check('client: unreadable body is an error, not a frozen chart', bad.code === 'upstream')
  check('client: unknown timeframe rejected before any request', (await c.getCandles('XAUUSD', 'X9').catch((e) => e)).code === 'bad_request')
}

// ── hub harness ──
function harness(script, { visible = true, perMinute = 8, t0 = Date.UTC(2026, 9, 14, 10, 0, 0) } = {}) {
  let t = t0, vis = visible
  const timers = []
  const client = mockClient(script)
  const hub = createLiveHub({ client, now: () => t, setTimer: (f, ms) => { const x = { f, at: t + ms }; timers.push(x); return x }, clearTimer: (x) => { const i = timers.indexOf(x); if (i >= 0) timers.splice(i, 1) }, isVisible: () => vis, perMinute, rng: () => 0.5 })
  const flush = () => new Promise((r) => setImmediate(r))
  return { hub, client, timers, setVis: (v) => { vis = v }, advance: async (ms) => { t += ms; const due = timers.filter((x) => x.at <= t); for (const x of due) { timers.splice(timers.indexOf(x), 1); x.f() } await flush(); await flush() }, flush, now: () => t }
}

{ // one batched poll for several symbols, ref-counting
  const h = harness([{ quotes: { EURUSD: tick(1.1, 1), XAUUSD: tick(4300, 1) } }])
  const u1 = h.hub.watch('EURUSD'), u2 = h.hub.watch('XAUUSD'), u3 = h.hub.watch('EURUSD')
  await h.flush(); await h.flush()
  check('hub: first watch starts polling, batched call', h.client.calls.length >= 1 && h.client.calls[0].includes('EURUSD'))
  check('hub: tick stored per symbol', h.hub.tickOf('EURUSD')?.last === 1.1 && h.hub.tickOf('XAUUSD')?.last === 4300)
  u1(); check('hub: still watched while another holder remains', h.hub.tickOf('EURUSD') !== null)
  u3(); check('hub: last unwatch drops the tick', h.hub.tickOf('EURUSD') === null)
  u2(); check('hub: nobody watching -> timer cleared', h.timers.length === 0)
}
{ // pacing: free plan, 5 symbols -> about a minute between polls
  const h = harness([{ quotes: {} }])
  ;['EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'XAUUSD'].forEach((s) => h.hub.watch(s))
  await h.flush(); await h.flush()
  const ms = h.hub.pollMs()
  check('hub: poll interval respects the credit budget (5 symbols, 8/min)', ms >= 55000 && ms <= 70000, String(ms))
  check('hub: next poll scheduled at that interval', h.timers.length === 1 && Math.abs(h.timers[0].at - (h.now() + ms)) < 5)
}
{ // hidden tab pauses, visible resumes at once
  const h = harness([{ quotes: { EURUSD: tick(1.1, 1) } }])
  h.hub.watch('EURUSD'); await h.flush(); await h.flush()
  const n = h.client.calls.length
  h.setVis(false); await h.advance(120000)
  check('hub: no request while the tab is hidden', h.client.calls.length === n)
  h.setVis(true); h.hub.resume(); await h.flush(); await h.flush()
  check('hub: resume() polls immediately', h.client.calls.length === n + 1)
}
{ // errors: backoff, status offline, recovery
  const e = new FeedClientError('network', 'down')
  const h = harness([e, e, { quotes: { EURUSD: tick(1.1, 1) } }])
  h.hub.watch('EURUSD'); await h.flush(); await h.flush()
  const s1 = h.hub.statusOf('EURUSD')
  check('hub: failure counted, reason exposed, no frozen "live"', s1.failures === 1 && s1.reason === 'down' && s1.state === 'offline', JSON.stringify(s1))
  check('hub: retry scheduled with backoff (>= 1 s)', h.timers.length === 1 && h.timers[0].at - h.now() >= 1000)
  await h.advance(70000); await h.advance(70000)
  check('hub: recovers after errors', h.hub.statusOf('EURUSD').failures === 0 && h.hub.tickOf('EURUSD')?.last === 1.1)
}
{ // quota / retryAfter are honoured
  const h = harness([new FeedClientError('quota', 'daily limit', { retryAfter: 0 })])
  h.hub.watch('EURUSD'); await h.flush(); await h.flush()
  check('hub: daily quota error backs off >= 5 min', h.timers[0].at - h.now() >= 300000)
  const h2 = harness([new FeedClientError('rate_limited', 'slow', { retryAfter: 90 })])
  h2.hub.watch('EURUSD'); await h2.flush(); await h2.flush()
  check('hub: retryAfter honoured', h2.timers[0].at - h2.now() >= 90000)
}
{ // stale ticks / older tick dropped / identical repeat keeps it alive
  const h = harness([{ quotes: { EURUSD: tick(1.1, 2000) } }, { quotes: { EURUSD: tick(1.0, 1000) } }, { quotes: { EURUSD: tick(1.1, 2000) } }])
  h.hub.watch('EURUSD'); await h.flush(); await h.flush()
  await h.advance(61000)
  check('hub: older tick is dropped', h.hub.tickOf('EURUSD').last === 1.1)
  await h.advance(61000)
  check('hub: unchanged price from a fresh poll is still LIVE (alive, not stale)', h.hub.statusOf('EURUSD').state === 'live')
}
{ // closed market overrides, crypto 24/7
  const sat = Date.UTC(2026, 9, 17, 12, 0, 0)
  const h = harness([{ quotes: { XAUUSD: tick(4300, 1), BTCUSD: tick(60000, 1) } }], { t0: sat })
  h.hub.watch('XAUUSD'); h.hub.watch('BTCUSD'); await h.flush(); await h.flush()
  check('hub: gold on Saturday = closed', h.hub.statusOf('XAUUSD').state === 'closed')
  check('hub: crypto on Saturday = live', h.hub.statusOf('BTCUSD').state === 'live')
}
{ // per-symbol error entries in a good batch do not poison the others
  const h = harness([{ quotes: { EURUSD: tick(1.1, 1), BTCUSD: { error: { code: 'plan', message: 'no' } } } }])
  h.hub.watch('EURUSD'); h.hub.watch('BTCUSD'); await h.flush(); await h.flush()
  check('hub: one symbol failing does not hide the others', h.hub.tickOf('EURUSD')?.last === 1.1 && h.hub.tickOf('BTCUSD') === null)
}

// ── spread over live mid ──
{
  setSpreadMode('fixed')
  const q = quoteFromMid('EURUSD', 1.1, 1000)
  check('spread: bid < mid < ask, symmetric', q.bid < 1.1 && q.ask > 1.1 && Math.abs((q.ask - 1.1) - (1.1 - q.bid)) < 1e-4)
  const r = quoteFromMid('EURUSD', 1.1, 1000, { bid: 1.0999, ask: 1.1001 })
  check('spread: real bid / ask win and are flagged', r.bid === 1.0999 && r.ask === 1.1001 && r.real === true)
  check('spread: crossed real bid / ask rejected -> simulated', quoteFromMid('EURUSD', 1.1, 1000, { bid: 1.2, ask: 1.0 }).real !== true)
  setSpreadMode('variable')
  check('spread: variable mode deterministic per 10 s bucket', quoteFromMid('EURUSD', 1.1, 1003).ask === quoteFromMid('EURUSD', 1.1, 1007).ask)
  setSpreadMode('fixed')
}

// ── quote time: the received time, not a stale provider bar timestamp ──
{
  const { buildQuote } = await import('../src/lib/terminal/quoteHub.js')
  const recv = Date.UTC(2026, 9, 14, 0, 30, 0)
  const q = buildQuote('XAUUSD', { last: 4160, bid: null, ask: null, ts: Date.UTC(2026, 9, 13, 0, 0, 0), recvMs: recv, source: 'twelvedata' }, { state: 'live' })
  check('quote time = received time even when the provider timestamp is a day old', q.time === recv / 1000 && q.providerTs < recv && Number.isFinite(q.bid) && q.bid < q.ask)
  const c = buildQuote('XAUUSD', { last: 4160, ts: 1000000, recvMs: recv, source: 'twelvedata' }, { state: 'closed' })
  check('closed market keeps the provider time and is flagged closed', c.time === 1000 && c.closed === true)
  check('no tick -> no quote', buildQuote('XAUUSD', null, { state: 'live' }) === null)
}

// ── migration of old simulated demo accounts ──
{
  const M = await import('../src/lib/terminal/migrateLegacy.js')
  const since = M.LIVE_SINCE, old = since - 86400, fresh = since + 3600
  const led = { account: { balance: 10250, startBalance: 10000, leverage: 100 }, nextId: 9,
    positions: [{ id: 'p1', symbol: 'XAUUSD', side: 'buy', lots: 0.5, entry: 4300, sl: 4290, tp: null, openTime: old, tf: 'M15' }, { id: 'p2', symbol: 'EURUSD', side: 'sell', lots: 1, entry: 1.1, openTime: fresh }],
    orders: [{ id: 'o1', symbol: 'GBPUSD', createdAt: old }, { id: 'o2', symbol: 'GBPUSD', createdAt: fresh }],
    history: [{ id: 'h1', pnl: 250, closeTime: old, openTime: old - 60 }, { id: 'h2', pnl: -10, closeTime: fresh, openTime: fresh - 60 }] }
  check('migration: detects legacy records', M.needsMigration(led) && M.legacyCounts(led).positions === 1 && M.legacyCounts(led).orders === 1 && M.legacyCounts(led).history === 1)
  const r = M.keepHistory(led, since + 7200)
  check('migration: legacy position closed FLAT at entry, P/L 0, balance untouched', r.ledger.account.balance === 10250 && r.ledger.positions.length === 1 && r.ledger.positions[0].id === 'p2' && r.ledger.history[0].exit === 4300 && r.ledger.history[0].pnl === 0 && r.ledger.history[0].reason === 'migrated')
  check('migration: legacy pending cancelled, live one kept', r.ledger.orders.length === 1 && r.ledger.orders[0].id === 'o2')
  check('migration: legacy history tagged simulated, live history untouched', r.ledger.history.filter((h) => h.source === 'simulated').length === 2 && r.ledger.history.find((h) => h.id === 'h2').source === undefined)
  check('migration: ids stay unique', new Set(r.ledger.history.map((h) => h.id)).size === r.ledger.history.length && r.ledger.nextId === 10)
  check('migration: idempotent (second run finds nothing, changes nothing)', !M.needsMigration(r.ledger) && JSON.stringify(M.keepHistory(r.ledger, since + 9000).ledger) === JSON.stringify(r.ledger))
  const f = M.freshAccount(led, since + 10)
  check('migration: fresh account keeps start balance + leverage, empty', f.account.balance === 10000 && f.account.leverage === 100 && !f.positions.length && !f.history.length)
  check('migration: simulated trades hidden by default, shown on request', M.liveHistory(r.ledger.history).length === 1 && M.liveHistory(r.ledger.history, true).length === 3)
  check('migration: brand-new account needs nothing', !M.needsMigration({ positions: [], orders: [], history: [] }))
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
