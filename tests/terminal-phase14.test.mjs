// Phase 14 — live data layer: adapter, API handlers, calendar, status machine, candle store,
// live feed (fake fetch/timers), real-candle catch-up, migration. Plain node (no network, no key).
import fs from 'node:fs'
import './fixtures/legacyInstruments.js'
import * as TD from '../src/lib/terminal/feed/adapters/twelveData.js'
import * as CS from '../src/lib/terminal/feed/candleStore.js'
import * as MH from '../src/lib/terminal/marketHours.js'
import * as FS from '../src/lib/terminal/feed/feedStatus.js'
import { createLiveFeed } from '../src/lib/terminal/feed/liveFeed.js'
import { createCore, createLimiter, DAILY_BUDGET } from '../api/_lib/core.js'
import * as L from '../src/lib/terminal/ledger.js'
import * as M from '../src/lib/terminal/liveMigration.js'
import { quoteFromMid } from '../src/lib/terminal/feed/spread.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const fx = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/twelvedata/${n}.json`, import.meta.url), 'utf8'))
const utc = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 1000

// ── 1. adapter normalisation (hand-made payloads) ──
const cs = TD.normaliseCandles(fx('time_series_1min'))
check('candles: oldest first, duplicates / junk / impossible rows dropped', cs.length === 3 && cs[0].time === utc(2026, 10, 14, 13, 1) && cs[2].time === utc(2026, 10, 14, 13, 3), JSON.stringify(cs.map((c) => c.time)))
check('candles: strings parsed to numbers, missing volume = 0', cs[2].close === 4353 && cs[1].volume === 0 && cs[2].volume === 120)
check('parseDatetime: UTC seconds, date-only ok, junk NaN', TD.parseDatetime('2026-10-14 13:03:00') === utc(2026, 10, 14, 13, 3) && TD.parseDatetime('2026-10-14') === utc(2026, 10, 14) && Number.isNaN(TD.parseDatetime('x')))
check('price payload', TD.normalisePrice(fx('price'), 1000).last === 4353.05)
const q = TD.normaliseQuote(fx('quote'))
check('quote payload: last / prevClose / isOpen / timestamp', q.last === 4353.05 && q.prevClose === 4338.4 && q.isOpen === true && q.ts === 1760449380)
const code = (f) => { try { f(); return null } catch (e) { return e.code } }
check('provider quota error -> QUOTA', code(() => TD.normaliseCandles(fx('error_quota'))) === 'QUOTA')
check('provider bad key -> NO_KEY', code(() => TD.normalisePrice(fx('error_key'))) === 'NO_KEY')
check('garbage price -> UPSTREAM', code(() => TD.normalisePrice({ price: 'abc' })) === 'UPSTREAM')
check('symbol mapping: XAUUSD -> XAU/USD, others unknown', TD.toProviderSymbol('XAUUSD') === 'XAU/USD' && TD.toProviderSymbol('EURUSD') === null)

// adapter fetch wrapper (fake fetch): URL carries the provider symbol / interval / UTC, key only server-side
{
  const seen = []
  const fakeFetch = async (url) => { seen.push(String(url)); return { ok: true, status: 200, json: async () => fx('time_series_1min') } }
  const td = TD.createTwelveData({ key: 'SECRET123', fetchImpl: fakeFetch })
  const out = await td.candles('XAUUSD', 'M5', { limit: 99999 })
  check('adapter: XAU/USD, 5min, outputsize clamped to 5000, timezone UTC', out.length === 3 && /symbol=XAU%2FUSD/.test(seen[0]) && /interval=5min/.test(seen[0]) && /outputsize=5000/.test(seen[0]) && /timezone=UTC/.test(seen[0]))
  let e = null
  try { await TD.createTwelveData({ key: '', fetchImpl: fakeFetch }).quote('XAUUSD') } catch (x) { e = x }
  check('adapter: no key -> NO_KEY, no request made', e?.code === 'NO_KEY' && seen.length === 1)
  e = null
  try { await td.candles('EURUSD', 'M1') } catch (x) { e = x }
  check('adapter: other symbols refused before any request', e?.code === 'BAD_REQUEST' && seen.length === 1)
}

// ── 2. candle store ──
{
  const c = (t, o, h, l, cl) => ({ time: t, open: o, high: h, low: l, close: cl, volume: 1 })
  const a = [c(60, 1, 2, 0.5, 1.5), c(120, 1.5, 2, 1, 1.8)]
  const b = [c(120, 1.5, 2.5, 1, 2), c(180, 2, 3, 2, 2.5), { time: 240, open: NaN, high: 1, low: 1, close: 1 }]
  const m = CS.mergeCandles(a, b)
  check('merge: sorted, de-duplicated (newer wins), invalid dropped', m.length === 3 && m[1].high === 2.5 && m[2].time === 180)
  const t1 = CS.applyTick(m, 2.8, 185, 60)
  check('tick folds into the forming candle', t1.length === 3 && t1[2].close === 2.8 && t1[2].high === 3)
  const t2 = CS.applyTick(m, 2.7, 245, 60)
  check('tick in a new bucket opens a new candle at the previous close', t2.length === 4 && t2[3].open === 2.5 && t2[3].time === 240)
  check('old tick ignored', CS.applyTick(m, 9, 10, 60) === m)
  const gap = CS.fillGaps([c(60, 1, 1, 1, 1), c(240, 2, 2, 2, 2)], 60)
  check('gap fill: 2 flat candles at the previous close', gap.length === 4 && gap[1].close === 1 && gap[1].filled && gap[2].time === 180)
  const long = CS.fillGaps([c(60, 1, 1, 1, 1), c(60 + 60 * 20, 2, 2, 2, 2)], 60)
  check('long gaps (weekend) are left alone', long.length === 2)
  const closed = CS.fillGaps([c(60, 1, 1, 1, 1), c(240, 2, 2, 2, 2)], 60, { isOpen: () => false })
  check('gap fill skips closed-market minutes', closed.length === 2)
  const h1 = []
  for (let i = 0; i < 8; i++) h1.push({ time: 3600 * i, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i, volume: 2 })
  const h4 = CS.aggregate(h1, 14400)
  check('aggregate H1 -> H4 (UTC aligned): O first, H max, L min, C last, volume summed', h4.length === 2 && h4[0].open === 10 && h4[0].high === 15 && h4[0].low === 9 && h4[0].close === 14 && h4[0].volume === 8 && h4[1].time === 14400)
}

// ── 3. market hours (UTC): Sun 22:00 -> Fri 21:00, daily break 21:00-22:00 ──
{
  const fri = (h, m) => utc(2026, 10, 16, h, m) // Fri 2026-10-16
  check('Friday 20:59 open, 21:00 closed', MH.isMarketOpen(fri(20, 59)) && !MH.isMarketOpen(fri(21, 0)))
  check('Saturday closed all day', !MH.isMarketOpen(utc(2026, 10, 17, 0, 0)) && !MH.isMarketOpen(utc(2026, 10, 17, 23, 59)))
  check('Sunday opens 22:00', !MH.isMarketOpen(utc(2026, 10, 18, 21, 59)) && MH.isMarketOpen(utc(2026, 10, 18, 22, 0)))
  check('Mon-Thu daily break 21:00-22:00', MH.isMarketOpen(utc(2026, 10, 12, 20, 59)) && !MH.isMarketOpen(utc(2026, 10, 12, 21, 30)) && MH.isMarketOpen(utc(2026, 10, 12, 22, 0)))
  check('nextOpen from Friday evening = Sunday 22:00', MH.nextOpen(fri(21, 30)) === utc(2026, 10, 18, 22, 0))
  check('nextOpen is null while open; nextClose Friday 21:00', MH.nextOpen(fri(10, 0)) === null && MH.nextClose(fri(10, 0)) === fri(21, 0))
  check('closed message with countdown', MH.marketStatus(utc(2026, 10, 12, 21, 5)).closedMessage === 'Market closed — opens in 55m' && MH.marketStatus(utc(2026, 10, 17, 12, 0)).closedMessage === 'Market closed — opens in 1d 10h', MH.marketStatus(utc(2026, 10, 17, 12, 0)).closedMessage)
  check('fmtDuration', MH.fmtDuration(5 * 3600 + 12 * 60) === '5h 12m' && MH.fmtDuration(30) === '1m')
}

// ── 4. stale-detection state machine + backoff ──
{
  const st = (o) => FS.connectionState({ now: 1000, marketOpen: true, failures: 0, everLoaded: true, ...o })
  check('fresh price = live', st({ lastUpdate: 990 }) === 'live')
  check('90 s without update = delayed', st({ lastUpdate: 1000 - 95 }) === 'delayed')
  check('5 min without update = offline', st({ lastUpdate: 1000 - 301 }) === 'offline')
  check('2 failures in a row = delayed even if the price is recent', st({ lastUpdate: 990, failures: 2 }) === 'delayed')
  check('market closed wins over staleness', st({ lastUpdate: 1, marketOpen: false }) === 'closed')
  check('never loaded: loading, then offline after a failure', st({ lastUpdate: null, everLoaded: false }) === 'loading' && st({ lastUpdate: null, everLoaded: false, failures: 1 }) === 'offline')
  check('only live may trigger SL/TP/pending', FS.canTrigger('live') && !['delayed', 'offline', 'closed', 'loading'].some(FS.canTrigger))
  const b = (n, o = {}) => FS.backoffMs(n, { rnd: 0, ...o })
  check('backoff grows exponentially and is capped (rnd=0 -> half the ceiling)', b(0) === 1000 && b(1) === 2000 && b(2) === 4000 && b(10) === 30000 && b(50) === 30000)
  check('backoff jitter stays in [ceil/2, ceil]', FS.backoffMs(3, { rnd: 0.999 }) <= 16000 && FS.backoffMs(3, { rnd: 0 }) === 8000)
  check('quota backoff is minutes, not seconds', FS.backoffMs(0, { quota: true }) >= 120000 && FS.backoffMs(9, { quota: true }) <= 15 * 60000)
}

// ── 5. API handlers (fake fetch, no network, no key) ──
const mkRes = () => { const r = { headers: {}, statusCode: 0, body: '', setHeader(k, v) { r.headers[k.toLowerCase()] = v }, end(b) { r.body = b || '' } }; return r }
const call = async (core, fn, url, { origin, host = 'app.test', ip = '1.1.1.1', method = 'GET' } = {}) => {
  const req = { url, method, headers: { host, ...(origin ? { origin } : {}), 'x-forwarded-for': ip }, socket: {} }
  const res = mkRes()
  await core[fn](req, res)
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null, headers: res.headers, raw: res.body }
}
{
  let calls = 0
  let clock = Date.UTC(2026, 9, 14, 13, 5, 0)
  const body = () => fx('time_series_1min')
  const fetchImpl = async (url) => { calls++; return { ok: true, status: 200, json: async () => (String(url).includes('/quote') ? fx('quote') : body()) } }
  const env = { TWELVEDATA_API_KEY: 'TOPSECRETKEY', ALLOWED_ORIGIN: 'https://app.test' }
  const core = createCore({ env, fetchImpl, now: () => clock })
  let r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=M1&limit=3')
  check('candles: 200 with normalised candles + cache header', r.status === 200 && r.json.candles.length === 3 && /s-maxage=20/.test(r.headers['cache-control']), JSON.stringify(r.json).slice(0, 120))
  r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=M1&limit=3')
  check('second identical request is served from the cache (1 upstream call)', calls === 1 && r.status === 200)
  const [a, b] = await Promise.all([call(core, 'quote', '/api/quote?symbol=XAUUSD'), call(core, 'quote', '/api/quote?symbol=XAUUSD', { ip: '2.2.2.2' })])
  check('quote: concurrent requests share one upstream call (single flight)', calls === 2 && a.json.last === 4353.05 && b.json.prevClose === 4338.4)
  r = await call(core, 'candles', '/api/candles?symbol=EURUSD&tf=M1')
  check('symbol allow-list: EURUSD refused (400, SYMBOL_NOT_ALLOWED)', r.status === 400 && r.json.error.code === 'SYMBOL_NOT_ALLOWED' && calls === 2)
  r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=H4')
  check('unknown timeframe refused (H4 is built in the browser)', r.status === 400 && r.json.error.code === 'BAD_REQUEST')
  r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=M1&limit=abc')
  check('bad limit refused', r.status === 400)
  const before = calls
  r = await call(core, 'candles', `/api/candles?symbol=XAUUSD&tf=M5&limit=999999&to=${Math.floor(clock / 1000) - 86400 * 3}`)
  check('old history: limit clamped to 5000, cached for a day', r.status === 200 && /s-maxage=86400/.test(r.headers['cache-control']) && calls === before + 1)
  r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=M1', { origin: 'https://evil.example' })
  check('CORS: foreign origin refused (403)', r.status === 403)
  r = await call(core, 'candles', '/api/candles?symbol=XAUUSD&tf=M1&limit=3', { origin: 'https://app.test' })
  check('CORS: the app origin is allowed and echoed', r.status === 200 && r.headers['access-control-allow-origin'] === 'https://app.test')
  r = await call(core, 'candles', '/api/candles', { method: 'POST' })
  check('only GET', r.status === 405)
  check('the key never appears in any response', ![r.raw, JSON.stringify((await call(core, 'health', '/api/health')).json)].some((t) => t.includes('TOPSECRETKEY')))
  const h = await call(core, 'health', '/api/health')
  check('health: keyConfigured true, provider named, no key', h.json.keyConfigured === true && h.json.provider === 'Twelve Data' && !h.raw.includes('TOPSECRET'))
  const s = await call(core, 'symbols', '/api/symbols?q=gold')
  check('symbols: only XAUUSD, searchable', s.json.symbols.length === 1 && s.json.symbols[0].symbol === 'XAUUSD' && (await call(core, 'symbols', '/api/symbols?q=eur')).json.symbols.length === 0)
}
{
  const core = createCore({ env: {}, fetchImpl: async () => { throw new Error('must not be called') } })
  const r = await call(core, 'quote', '/api/quote')
  check('no key configured -> 503 NO_KEY, nothing fetched', r.status === 503 && r.json.error.code === 'NO_KEY')
}
{
  const lim = createLimiter({ perMin: 3, now: () => 0 })
  check('rate limit: 3 per minute per IP, then Retry-After', lim('a') === 0 && lim('a') === 0 && lim('a') === 0 && lim('a') > 0 && lim('b') === 0)
  const core = createCore({ env: { TWELVEDATA_API_KEY: 'k' }, fetchImpl: async () => ({ ok: true, status: 200, json: async () => fx('quote') }), limiter: createLimiter({ perMin: 2 }) })
  await call(core, 'quote', '/api/quote'); await call(core, 'quote', '/api/quote')
  const r = await call(core, 'quote', '/api/quote')
  check('handler: 429 RATE_LIMIT with Retry-After header', r.status === 429 && r.json.error.code === 'RATE_LIMIT' && Number(r.headers['retry-after']) > 0)
}
{
  // upstream quota error: surfaced as 429 QUOTA, and a stale cached value is served instead when we have one
  let mode = 'ok'
  let clock = 1_000_000_000_000
  const fetchImpl = async () => (mode === 'ok' ? { ok: true, status: 200, json: async () => fx('quote') } : { ok: false, status: 429, json: async () => fx('error_quota') })
  const core = createCore({ env: { TWELVEDATA_API_KEY: 'k' }, fetchImpl, now: () => clock })
  let r = await call(core, 'quote', '/api/quote')
  mode = 'quota'; clock += 60_000
  r = await call(core, 'quote', '/api/quote')
  check('provider quota error with a cached value: stale value served, flagged', r.status === 200 && r.json.stale === true && r.json.last === 4353.05)
  const core2 = createCore({ env: { TWELVEDATA_API_KEY: 'k' }, fetchImpl, now: () => clock })
  r = await call(core2, 'quote', '/api/quote')
  check('provider quota error, nothing cached: 429 QUOTA with a readable reason', r.status === 429 && r.json.error.code === 'QUOTA' && /quota/i.test(r.json.error.message))
}
{
  // daily budget guard: stop calling the provider after DAILY_BUDGET credits
  let calls = 0
  let clock = Date.UTC(2026, 9, 14, 10, 0, 0)
  const core = createCore({ env: { TWELVEDATA_API_KEY: 'k' }, fetchImpl: async () => { calls++; return { ok: true, status: 200, json: async () => fx('time_series_1min') } }, now: () => clock, limiter: createLimiter({ perMin: 1e9 }) })
  let last
  for (let i = 0; i < DAILY_BUDGET + 20; i++) { clock += 61_000; last = await call(core, 'candles', `/api/candles?symbol=XAUUSD&tf=M1&limit=${1 + (i % 4000)}`) }
  check(`daily budget: provider called at most ${DAILY_BUDGET} times a day, then QUOTA`, calls <= DAILY_BUDGET && last.status === 429 && last.json.error.code === 'QUOTA', `calls=${calls} status=${last.status}`)
}

// ── 6. live feed in the browser (fake fetch + fake timers) ──
{
  const timers = { q: [], set(fn, ms) { const t = { fn, ms }; timers.q.push(t); return t }, clear(t) { timers.q = timers.q.filter((x) => x !== t) } }
  let now = utc(2026, 10, 14, 13, 4) * 1000 // Wednesday, market open
  let mode = 'ok'
  const log = []
  const fetchImpl = async (url) => {
    log.push(String(url))
    if (mode === 'offline') throw new TypeError('network')
    if (mode === 'quota') return { ok: false, status: 429, json: async () => ({ error: { code: 'QUOTA', message: 'Data provider quota reached — try again later' } }) }
    const u = String(url)
    if (u.includes('/api/quote')) return { ok: true, status: 200, json: async () => ({ symbol: 'XAUUSD', provider: 'Twelve Data', last: 4353.5, prevClose: 4338.4, isOpen: null, ts: Math.floor(now / 1000) - 5 }) }
    if (u.includes('/api/candles')) return { ok: true, status: 200, json: async () => ({ provider: 'Twelve Data', candles: TD.normaliseCandles(fx('time_series_1min')) }) }
    return { ok: false, status: 404, json: async () => ({}) }
  }
  let hidden = false
  const feed = createLiveFeed({ fetchImpl, now: () => now, timers, isHidden: () => hidden })
  const ticks = []
  const off = feed.subscribe('XAUUSD', (t) => ticks.push(t))
  await new Promise((r) => setTimeout(r, 20))
  check('subscribe: first poll delivers a tick with bid < ask around the live mid', ticks.length === 1 && ticks[0].bid < ticks[0].ask && Math.abs((ticks[0].bid + ticks[0].ask) / 2 - 4353.5) < 0.01 && ticks[0].source === 'twelvedata', JSON.stringify(ticks[0]))
  check('status is live, provider named, prevClose known', feed.getStatus().state === 'live' && feed.getStatus().provider === 'Twelve Data' && feed.getPrevClose('XAUUSD') === 4338.4)
  check('a poll is scheduled (30 s while the market is open)', timers.q.length === 1 && timers.q[0].ms === 30000)
  feed.subscribe('XAUUSD', () => {})
  await new Promise((r) => setTimeout(r, 10))
  check('ONE polling loop per symbol no matter how many subscribers', log.filter((u) => u.includes('/api/quote')).length === 1)
  check('the browser only talks to same-origin /api/*', log.every((u) => u.startsWith('/api/')))
  // failures -> delayed -> offline, with backoff
  mode = 'offline'
  await timers.q[0].fn(); await new Promise((r) => setTimeout(r, 5))
  check('one failure: still live, reason recorded after 2', feed.getStatus().state === 'live')
  await timers.q[0].fn(); await new Promise((r) => setTimeout(r, 5))
  const s2 = feed.getStatus()
  check('two failures: delayed, with a human reason', s2.state === 'delayed' && /internet/i.test(s2.reason), JSON.stringify(s2))
  check('retry delay after failures is backoff (<= 60 s), not 30 s steady', timers.q[0].ms <= 60000 && timers.q[0].ms !== 30000)
  now += 6 * 60 * 1000
  check('after 5+ min with no price: offline', feed.getStatus().state === 'offline')
  mode = 'quota'
  await timers.q[0].fn(); await new Promise((r) => setTimeout(r, 5))
  check('quota error: much longer backoff and the reason is shown', timers.q[0].ms >= 60000 && /quota/i.test(feed.getStatus().reason || ''), `${timers.q[0].ms} ${feed.getStatus().reason}`)
  mode = 'ok'
  await timers.q[0].fn(); await new Promise((r) => setTimeout(r, 5))
  check('recovers to live and the failure counter resets', feed.getStatus().state === 'live' && feed.getStatus().failures === 0)
  // hidden tab pauses polling
  hidden = true
  const n0 = log.length
  await timers.q[0].fn()
  check('hidden tab: no request is made', log.length === n0)
  hidden = false
  // weekend
  now = utc(2026, 10, 17, 12, 0) * 1000
  await timers.q[0]?.fn?.(); await new Promise((r) => setTimeout(r, 5))
  check('Saturday: state is closed (not offline) and polling slows to 5 min', feed.getStatus().state === 'closed' && timers.q[0].ms === 300000, `${feed.getStatus().state} ${timers.q[0]?.ms}`)
  off()
  // candles
  now = utc(2026, 10, 14, 13, 4) * 1000
  const got = await feed.getCandles('XAUUSD', 'M1', { limit: 10 })
  check('getCandles merges the live price into the forming candle', got.length >= 3 && got[got.length - 1].close === 4353.5, JSON.stringify(got[got.length - 1]))
  const none = await feed.getCandles('XAUUSD', 'H4', { limit: 5 })
  check('H4 is built from H1 (aligned to UTC 4h)', none.every((c) => c.time % 14400 === 0))
  mode = 'offline'
  const again = await feed.getCandles('XAUUSD', 'M1', { limit: 10 })
  check('offline: history still comes from memory (last known)', again.length >= 3)
  let err = null
  try { await feed.getCandles('EURUSD', 'M1') } catch (e) { err = e }
  check('other symbols refused in the browser too', err?.code === 'SYMBOL_NOT_ALLOWED')
}

// ── 7. catch-up with REAL candles: gaps, both-hit candles, partial coverage ──
{
  const led = (pos) => ({ account: { balance: 10000, startBalance: 10000, currency: 'USD', leverage: 100, createdAt: 0 }, positions: pos, orders: [], history: [], transactions: [], nextId: 10 })
  const buy = (o = {}) => ({ id: 'p1', symbol: 'XAUUSD', side: 'buy', lots: 1, entry: 4350, sl: 4340, tp: 4360, trail: null, beAfter: null, partialTp: null, leverage: 100, openTime: 0, source: 'live', ...o })
  const c = (t, o, h, l, cl) => ({ time: t, open: o, high: h, low: l, close: cl })
  const run = (ledger, candles, start = 4350) => L.catchUp(ledger, { candles: { XAUUSD: candles }, startMids: { XAUUSD: start }, quoteOf: quoteFromMid })
  let r = run(led([buy()]), [c(60, 4350, 4352, 4349, 4351), c(120, 4351, 4353, 4350, 4352)])
  check('quiet candles: nothing happens', r.events.length === 0 && r.ledger.positions.length === 1)
  r = run(led([buy()]), [c(60, 4350, 4362, 4349, 4361)])
  check('TP touched: closed at the TP level (bid rule), reason tp', r.ledger.history[0].reason === 'tp' && r.ledger.history[0].exit === 4360 && !r.ledger.history[0].bothHit)
  r = run(led([buy()]), [c(60, 4350, 4362, 4338, 4350)])
  const t = r.ledger.history[0]
  check('ONE candle touches both SL and TP: SL first, flagged bothHit', t.reason === 'sl' && t.pnl < 0 && t.bothHit === true && r.events[0].trade.bothHit === true, JSON.stringify(t))
  r = run(led([buy()]), [c(60, 4330, 4332, 4328, 4331)], 4350)
  check('gap open below SL: filled at the GAPPED price, not at the SL level', r.ledger.history[0].reason === 'sl' && r.ledger.history[0].exit < 4335, JSON.stringify(r.ledger.history[0]))
  const sell = { ...buy({ id: 'p2', side: 'sell', entry: 4350, sl: 4360, tp: 4340 }) }
  r = run(led([sell]), [c(60, 4350, 4362, 4338, 4350)])
  check('sell: both SL and TP touched -> SL first as well (ask rule)', r.ledger.history[0].reason === 'sl' && r.ledger.history[0].bothHit === true)
  const ledO = { ...led([]), orders: [{ id: 'o1', symbol: 'XAUUSD', type: 'limit', side: 'buy', lots: 1, price: 4345, limitPrice: null, sl: 4335, tp: 4365, expiresAt: null, oco: null, triggered: false, createdAt: 0, source: 'live' }] }
  r = run(ledO, [c(60, 4350, 4351, 4344, 4346), c(120, 4346, 4366, 4345, 4365)])
  check('pending limit fills in the candle that touches it, then its TP in a later candle', r.events.some((e) => e.type === 'fill') && r.ledger.history[0]?.reason === 'tp')
  check('every replayed event is marked approx', r.events.every((e) => e.approx === true))
  r = run(led([buy()]), [])
  check('partial coverage / no candles: ledger untouched', r.events.length === 0 && r.ledger.positions.length === 1)
  const week = []
  for (let i = 0; i < 2016; i++) week.push(c(300 * i, 4350, 4351, 4349, 4350))
  week[1500] = c(300 * 1500, 4350, 4351, 4338, 4339)
  r = run(led([buy()]), week)
  check('7-day absence on 5-min candles: SL found at the right candle', r.ledger.history[0]?.reason === 'sl' && r.ledger.history[0].closeTime >= 300 * 1500 && r.ledger.history[0].closeTime < 300 * 1501 + 60)
}

// ── 8. migration of old simulated accounts ──
{
  const old = {
    account: { balance: 10250, startBalance: 10000, currency: 'USD', leverage: 100, createdAt: 0 },
    positions: [{ id: 'p1', symbol: 'EURUSD', side: 'buy', lots: 0.5, entry: 1.1, sl: null, tp: null, openTime: 5, leverage: 100 }, { id: 'p9', symbol: 'XAUUSD', side: 'sell', lots: 1, entry: 4350, openTime: 6, leverage: 100, source: 'live' }],
    orders: [{ id: 'o2', symbol: 'XAUUSD', type: 'limit', side: 'buy', lots: 1, price: 4000, createdAt: 3 }],
    history: [{ id: 'h1', symbol: 'GBPUSD', side: 'buy', pnl: 25, closeTime: 9 }, { id: 'h2', symbol: 'XAUUSD', side: 'buy', pnl: -5, closeTime: 10, source: 'live' }],
    transactions: [{ id: 'x1' }], nextId: 12,
  }
  check('needsMigration: old items without source:"live" trigger it', M.needsMigration(old) && M.migrationCounts(old).positions === 1 && M.migrationCounts(old).orders === 1 && M.migrationCounts(old).trades === 1)
  check('needsMigration: empty / all-live accounts do not', !M.needsMigration({ positions: [], orders: [], history: [] }) && !M.needsMigration({ positions: [{ source: 'live' }], orders: [], history: [{ source: 'live' }] }))
  const k = M.migrateKeep(old, 1000)
  check('keep: old open trade closed FLAT at entry (pnl 0), tagged simulated', k.history[0].pnl === 0 && k.history[0].exit === 1.1 && k.history[0].source === 'simulated' && k.history[0].reason === 'migration')
  check('keep: old orders cancelled, live items untouched, old history tagged', k.orders.length === 0 && k.positions.length === 1 && k.positions[0].id === 'p9' && k.history.find((h) => h.id === 'h1').source === 'simulated' && k.history.find((h) => h.id === 'h2').source === 'live')
  check('keep: balance never touched (not even returned), ids keep counting', !('account' in k) && k.nextId === 13)
  check('keep is idempotent', !M.needsMigration({ ...old, ...k }))
  const f = M.migrateFresh(old)
  check('fresh: starting balance, everything cleared, ids keep counting', f.account.balance === 10000 && !f.positions.length && !f.orders.length && !f.history.length && !f.transactions.length && f.nextId === 12)
  const kept = { ...old, ...k }
  check('live stats exclude simulated trades by default, include on request', M.liveOnly(kept.history, false).length === 1 && M.liveOnly(kept.history, true).length === 3 && M.simulatedCount(kept.history) === 2)
}

// ── 9. rules: no simulator left in src ──
{
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]))
  const srcFiles = walk('src').filter((f) => /\.(js|jsx)$/.test(f))
  check('src/ has no simulatedFeed file and nothing imports it', !fs.existsSync('src/lib/terminal/feed/simulatedFeed.js') && !srcFiles.some((f) => /simulatedFeed|mockFeed/.test(fs.readFileSync(f, 'utf8'))))
  const ui = srcFiles.filter((f) => f.includes('components/terminal') && !f.includes('MigrationDialog')).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  check('UI never says "simulated prices" / "24/7"', !/simulated prices|simulated 24\/7|24\/7/i.test(ui))
  const sw = fs.readFileSync('public/sw.js', 'utf8')
  check('service worker never caches /api/*', /startsWith\('\/api\/'\)\) return/.test(sw))
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
