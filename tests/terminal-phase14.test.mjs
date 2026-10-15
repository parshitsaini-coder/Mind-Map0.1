// Phase 14 slice 1 (pure + proxy): symbol routing, vendor adapters (hand-written fixtures), candle math, market hours, feed health,
// guard rails and the serverless proxy core with a fake fetch. Nothing here touches the network.
import * as SM from '../src/lib/terminal/feed/symbolMap.js'
import * as TD from '../src/lib/terminal/feed/adapters/twelveData.js'
import * as FH from '../src/lib/terminal/feed/adapters/finnhub.js'
import * as ER from '../src/lib/terminal/feed/adapters/errors.js'
import * as CM from '../src/lib/terminal/feed/candleMath.js'
import * as MH from '../src/lib/terminal/feed/marketHours.js'
import * as FS from '../src/lib/terminal/feed/feedStatus.js'
import * as SG from '../src/lib/terminal/feed/serverGuard.js'
import { createProxy } from '../api/_lib/core.js'
import * as F from './fixtures/feed-samples.mjs'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const throws = (f) => { try { f(); return null } catch (e) { return e } }

// ── routing ──────────────────────────────────────────────────────────────
check('forex + gold go to Twelve Data, crypto to Finnhub', ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY'].every((s) => SM.SYMBOL_MAP[s].provider === 'twelvedata') && SM.SYMBOL_MAP.BTCUSD.provider === 'finnhub' && SM.SYMBOL_MAP.ETHUSD.provider === 'finnhub')
check('vendor names', SM.SYMBOL_MAP.XAUUSD.vendor === 'XAU/USD' && SM.SYMBOL_MAP.USDJPY.vendor === 'USD/JPY' && SM.SYMBOL_MAP.BTCUSD.vendor === 'BINANCE:BTCUSDT')
check('NIFTY50 is NOT served (no free live source) and nothing unknown is allowed', !SM.isAllowed('NIFTY50') && !SM.isAllowed('FOO') && !SM.isAllowed('__proto__') && !SM.isAllowed('constructor') && !SM.isAllowed(undefined) && !SM.isAllowed(['EURUSD']))
check('env can move crypto to Twelve Data, never forex to a provider without it', SM.routeOf('BTCUSD', { FEED_PROVIDER_CRYPTO: 'twelvedata' }).provider === 'twelvedata' && SM.routeOf('BTCUSD', { FEED_PROVIDER_CRYPTO: 'twelvedata' }).vendor === 'BTC/USD' && SM.routeOf('XAUUSD', { FEED_PROVIDER_METAL: 'finnhub' }).provider === 'twelvedata' && SM.routeOf('FOO') === null)
check('timeframe seconds', SM.TF_SECONDS.M15 === 900 && SM.TF_SECONDS.W1 === 604800 && SM.TF_IDS.length === 8)

// ── Twelve Data ──────────────────────────────────────────────────────────
const u = new URL(TD.candlesUrl('XAU/USD', 'M15', { from: 1791880000, to: 1791885600, limit: 99999 }))
check('TD candles URL: symbol, interval, UTC, ascending, outputsize clamped, UTC start / end', u.searchParams.get('symbol') === 'XAU/USD' && u.searchParams.get('interval') === '15min' && u.searchParams.get('timezone') === 'UTC' && u.searchParams.get('order') === 'asc' && u.searchParams.get('outputsize') === '5000' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(u.searchParams.get('start_date')))
check('TD URL carries no key (it goes in a header)', !TD.candlesUrl('EUR/USD', 'H1', {}).includes('apikey') && TD.authHeaders('K').Authorization === 'apikey K')
check('TD intervals', eq(Object.values(TD.INTERVAL), ['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week']))
const tc = TD.normalizeCandles(F.TD_SERIES)
check('TD candles: 3 bars, ascending, UTC seconds, numbers, volume 0 for forex', tc.length === 3 && tc[0].time === Date.UTC(2026, 9, 13, 9, 0) / 1000 && tc[2].time - tc[1].time === 900 && tc[0].open === 4380.1 && tc[0].volume === 0 && tc.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)))
check('TD daily bars (date only) parse as UTC midnight', TD.parseTime('2026-10-13') === Date.UTC(2026, 9, 13) / 1000 && TD.parseTime('garbage') === null)
check('TD newest-first input is sorted and de-duplicated', (() => { const r = TD.normalizeCandles({ status: 'ok', values: [...F.TD_SERIES.values].reverse().concat([F.TD_SERIES.values[0]]) }); return r.length === 3 && r[0].time < r[2].time })())
check('TD malformed rows are dropped, good rows kept', TD.normalizeCandles({ status: 'ok', values: [{ datetime: 'x', open: '1', high: '1', low: '1', close: '1' }, F.TD_SERIES.values[0], { datetime: '2026-10-13 09:15:00', open: 'abc', high: '1', low: '1', close: '1' }] }).length === 1)
check('TD errors map to typed errors', TD.errorOf(F.TD_ERR_RATE, 200).code === 'rate_limited' && TD.errorOf(F.TD_ERR_DAY, 200).code === 'quota' && TD.errorOf(F.TD_ERR_KEY, 200).code === 'auth' && TD.errorOf(F.TD_ERR_PLAN, 200).code === 'plan' && TD.errorOf({ code: 404, message: 'x' }, 200).code === 'unsupported_symbol' && TD.errorOf({}, 500).code === 'upstream')
check('TD daily-quota error says how long to wait; per-minute is short', TD.errorOf(F.TD_ERR_DAY, 200).retryAfter === 3600 && TD.errorOf(F.TD_ERR_RATE, 200).retryAfter === 30)
check('TD normalizeCandles throws the typed error for an error body and for a bad shape', throws(() => TD.normalizeCandles(F.TD_ERR_RATE))?.code === 'rate_limited' && throws(() => TD.normalizeCandles({ status: 'ok' }))?.code === 'upstream' && throws(() => TD.normalizeCandles(null))?.code === 'upstream' && throws(() => TD.normalizeCandles({}, 503))?.code === 'upstream')
const q1 = TD.normalizeQuotes(F.TD_QUOTE_ONE, ['EUR/USD'])
check('TD single quote -> tick (last, ms timestamp, no bid / ask, market open)', q1['EUR/USD'].last === 1.1662 && q1['EUR/USD'].ts === 1791885600000 && q1['EUR/USD'].bid === null && q1['EUR/USD'].marketOpen === true && q1['EUR/USD'].dayOpen === undefined && q1['EUR/USD'].source === 'twelvedata')
const qm = TD.normalizeQuotes(F.TD_QUOTE_MANY, ['EUR/USD', 'XAU/USD', 'GBP/USD', 'USD/JPY'])
check('TD batch quote: good ones ticks, a failing symbol its own error, a missing one unsupported', qm['XAU/USD'].last === 4382.4 && qm['GBP/USD'].code === 'unsupported_symbol' && qm['USD/JPY'].code === 'unsupported_symbol' && qm['EUR/USD'].last === 1.1662)
check('TD quote whole-response error throws', throws(() => TD.normalizeQuotes(F.TD_ERR_KEY, ['EUR/USD']))?.code === 'auth')
check('TD quote URL lists the vendor symbols', new URL(TD.quoteUrl(['EUR/USD', 'XAU/USD'])).searchParams.get('symbol') === 'EUR/USD,XAU/USD')

// ── Finnhub ──────────────────────────────────────────────────────────────
const fu = new URL(FH.candlesUrl('BINANCE:BTCUSDT', 'M5', { from: 100.9, to: 200.2 }))
check('FH candles URL', fu.pathname === '/api/v1/crypto/candle' && fu.searchParams.get('symbol') === 'BINANCE:BTCUSDT' && fu.searchParams.get('resolution') === '5' && fu.searchParams.get('from') === '100' && fu.searchParams.get('to') === '200' && !fu.search.includes('token'))
check('FH resolutions; H4 is built from H1', FH.RESOLUTION.H1 === '60' && FH.RESOLUTION.D1 === 'D' && FH.needsAggregate('H4') && !FH.needsAggregate('H1') && FH.authHeaders('K')['X-Finnhub-Token'] === 'K')
const fc = FH.normalizeCandles(F.FH_CANDLES)
check('FH candles: ascending bars with volume', fc.length === 3 && fc[0].open === 66995 && fc[2].close === 67005 && fc[1].volume === 8.1 && fc[1].time - fc[0].time === 60)
check('FH no_data is an empty list, premium / bad key / rate limit are typed errors', FH.normalizeCandles(F.FH_NO_DATA).length === 0 && throws(() => FH.normalizeCandles(F.FH_ERR_PREMIUM, 403))?.code === 'plan' && throws(() => FH.normalizeCandles({ error: 'Invalid API key' }, 401))?.code === 'auth' && throws(() => FH.normalizeCandles({}, 429))?.code === 'rate_limited' && throws(() => FH.normalizeCandles({ s: 'weird' }))?.code === 'upstream')
check('FH tick from the newest 1m bar: last = close, ts = bar end, no bid / ask', (() => { const t = FH.tickFromCandles(fc); return t.last === 67005 && t.ts === (1791885420 + 60) * 1000 && t.bid === null && t.source === 'finnhub' })() && FH.tickFromCandles([]) === null)

// ── errors ───────────────────────────────────────────────────────────────
check('typed errors carry HTTP status; vendor secrets are scrubbed', ER.feedError('rate_limited', 'x').status === 429 && ER.feedError('unsupported_symbol', 'x').status === 404 && ER.feedError('not_configured', 'x').status === 503 && ER.scrub('bad key SECRET123 here', ['SECRET123', undefined]) === 'bad key *** here')
check('httpOf maps unknown errors to a safe 502 and keeps Retry-After', ER.httpOf(new Error('boom SECRET')).status === 502 && !JSON.stringify(ER.httpOf(new Error('boom SECRET'))).includes('SECRET') && ER.httpOf(ER.feedError('rate_limited', 'x', { retryAfter: 12 })).headers['Retry-After'] === '12')

// ── candle math ──────────────────────────────────────────────────────────
const c = (time, o, h, l, cl, v = 1) => ({ time, open: o, high: h, low: l, close: cl, volume: v })
check('merge: union by time, newer wins, sorted', (() => { const r = CM.mergeCandles([c(60, 1, 2, 0, 1), c(120, 1, 2, 0, 1)], [c(120, 5, 6, 4, 5), c(0, 9, 9, 9, 9)]); return r.length === 3 && r[0].time === 0 && r[2].open === 5 })())
check('aggregate H1 -> H4 (high / low / first open / last close / summed volume)', (() => { const h1 = [0, 3600, 7200, 10800, 14400].map((t, i) => c(t, i + 1, 10 + i, i, i + 2, 10)); const r = CM.aggregate(h1, 14400); return r.length === 2 && r[0].open === 1 && r[0].high === 13 && r[0].low === 0 && r[0].close === 5 && r[0].volume === 40 && r[1].time === 14400 })())
check('aggregate keeps buckets aligned to UTC', CM.aggregate([c(3600 * 5, 1, 1, 1, 1)], 14400)[0].time === 14400)
check('tick into the forming bar updates high / low / close', (() => { const r = CM.tickIntoCandle(c(900, 10, 11, 9, 10), 12, 1000, 900); return !r.isNew && r.candle.high === 12 && r.candle.close === 12 && r.candle.open === 10 && r.candle.low === 9 })())
check('tick in a new bar opens a new bar at the tick price (real gap kept)', (() => { const r = CM.tickIntoCandle(c(900, 10, 11, 9, 10), 25, 1800, 900); return r.isNew && r.candle.time === 1800 && r.candle.open === 25 })())
check('late tick is dropped; garbage is dropped; first tick makes a bar', CM.tickIntoCandle(c(900, 1, 1, 1, 1), 5, 100, 900) === null && CM.tickIntoCandle(null, NaN, 100, 900) === null && CM.tickIntoCandle(null, 5, 100, 900).isNew)
check('tick never mutates its input', (() => { const last = c(900, 10, 11, 9, 10); CM.tickIntoCandle(last, 99, 1000, 900); return last.high === 11 && last.close === 10 })())
const bars = [c(0, 1, 1, 1, 1), c(900, 1, 1, 1, 1), c(3600, 1, 1, 1, 1)]
check('gap ranges: a hole while the market is open', eq(CM.gapRanges(bars, 900), [{ from: 1800, to: 3600 }]))
check('gap ranges: closed hours are not gaps, no gaps in a clean series', CM.gapRanges(bars, 900, () => false).length === 0 && CM.gapRanges([c(0, 1, 1, 1, 1), c(900, 1, 1, 1, 1)], 900).length === 0 && CM.gapRanges([], 900).length === 0)
check('gap ranges: open / closed / open pattern', eq(CM.gapRanges([c(0, 1, 1, 1, 1), c(5400, 1, 1, 1, 1)], 900, (t) => t < 1800 || t >= 3600), [{ from: 900, to: 1800 }, { from: 3600, to: 5400 }]))

// ── market hours ─────────────────────────────────────────────────────────
const U = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi)
check('forex open midweek, closed Saturday', MH.isOpenAt('forex', U(2026, 10, 14, 12)) && !MH.isOpenAt('forex', U(2026, 10, 17, 12)))
check('forex weekly close: Friday 16:59 NY open, 17:00 NY closed (summer time, UTC-4)', MH.isOpenAt('forex', U(2026, 10, 16, 20, 59)) && !MH.isOpenAt('forex', U(2026, 10, 16, 21, 0)))
check('forex weekly open: Sunday 16:59 NY closed, 17:00 NY open', !MH.isOpenAt('forex', U(2026, 10, 18, 20, 59)) && MH.isOpenAt('forex', U(2026, 10, 18, 21, 0)))
check('...and the same minutes shift an hour in winter (UTC-5)', MH.isOpenAt('forex', U(2026, 12, 4, 21, 59)) && !MH.isOpenAt('forex', U(2026, 12, 4, 22, 0)) && !MH.isOpenAt('forex', U(2026, 12, 6, 21, 59)) && MH.isOpenAt('forex', U(2026, 12, 6, 22, 0)))
check('gold has the daily 17:00-18:00 NY break Mon-Thu; forex does not', !MH.isOpenAt('metal', U(2026, 10, 14, 21, 30)) && MH.isOpenAt('metal', U(2026, 10, 14, 22, 0)) && MH.isOpenAt('forex', U(2026, 10, 14, 21, 30)))
check('crypto is always open', MH.isOpenAt('crypto', U(2026, 10, 17, 12)) && MH.marketStatus('BTCUSD', U(2026, 10, 17, 12)).nextChangeMs === null)
check('NIFTY: open 09:15-15:30 IST Mon-Fri only', MH.isOpenAt('india-index', U(2026, 10, 14, 3, 45)) && !MH.isOpenAt('india-index', U(2026, 10, 14, 3, 44)) && MH.isOpenAt('india-index', U(2026, 10, 14, 9, 59)) && !MH.isOpenAt('india-index', U(2026, 10, 14, 10, 0)) && !MH.isOpenAt('india-index', U(2026, 10, 17, 5, 0)))
check('NIFTY: a holiday closes the day (holidays are injected, none bundled)', !MH.isOpenAt('india-index', U(2026, 10, 14, 5, 0), ['2026-10-14']) && MH.isOpenAt('india-index', U(2026, 10, 14, 5, 0), []))
const st = MH.marketStatus('EURUSD', U(2026, 10, 17, 12))
check('next change: Saturday noon -> Sunday 17:00 NY (= 21:00 UTC), minute exact', st.open === false && st.nextChangeMs === U(2026, 10, 18, 21, 0))
check('next change while open: Friday close', MH.marketStatus('EURUSD', U(2026, 10, 14, 12)).nextChangeMs === U(2026, 10, 16, 21, 0))
check('closed message text', MH.closedMessage('EURUSD', U(2026, 10, 18, 15, 48)) === 'Market closed — opens in 5h 12m' && MH.closedMessage('EURUSD', U(2026, 10, 14, 12)) === null && MH.closedMessage('BTCUSD', U(2026, 10, 17, 12)) === null)
check('duration text', MH.fmtDuration(59 * 60000) === '59m' && MH.fmtDuration(125 * 60000) === '2h 5m' && MH.fmtDuration(3000 * 60000) === '2d 2h' && MH.fmtDuration(-5) === '0m')
check('unknown symbols are treated as forex hours; NIFTY50 maps to the Indian calendar', MH.kindOf('FOO') === 'forex' && MH.kindOf('NIFTY50') === 'india-index' && MH.kindOf('XAUUSD') === 'metal')

// ── feed health ──────────────────────────────────────────────────────────
const f = (o) => FS.freshnessOf({ now: 100000, pollMs: 5000, ...o })
check('freshness: live / delayed / offline by tick age', f({ lastTickMs: 95000 }) === 'live' && f({ lastTickMs: 80000 }) === 'delayed' && f({ lastTickMs: 40000 }) === 'offline')
check('freshness: closed market is "closed", never offline', f({ lastTickMs: 1000, marketOpen: false }) === 'closed' && f({ lastTickMs: null, marketOpen: false }) === 'closed')
check('freshness: no tick yet = connecting, then offline after failures', f({ lastTickMs: null }) === 'connecting' && f({ lastTickMs: null, failures: 3 }) === 'offline' && f({ lastTickMs: null, started: false }) === 'offline')
check('thresholds scale with the poll interval (a 60 s poll is not "offline" after 45 s)', FS.freshnessOf({ now: 100000, lastTickMs: 55000, pollMs: 60000 }) === 'live' && FS.freshnessOf({ now: 100000, lastTickMs: 55000, pollMs: 5000 }) === 'offline' && FS.thresholdsFor(60000).delayedMs === 180000)
check('backoff doubles to the cap and jitters in [half, full]', FS.backoffMs(0, { rng: () => 0 }) === 500 && FS.backoffMs(0, { rng: () => 1 }) === 1000 && FS.backoffMs(3, { rng: () => 1 }) === 8000 && FS.backoffMs(20, { rng: () => 1 }) === 60000 && FS.backoffMs(20, { rng: () => 0 }) === 30000 && FS.backoffMs(-4, { rng: () => 1 }) === 1000)
check('backoff schedule is non-decreasing with a fixed rng', [0, 1, 2, 3, 4, 5, 6, 7, 8].map((a) => FS.backoffMs(a, { rng: () => 0.5 })).every((v, i, a) => i === 0 || v >= a[i - 1]))
check('poll pacing: 5 symbols on the free plan (8 / min) is about once a minute; faster with a paid plan; never below 5 s', FS.pollIntervalMs(5, 8) === 62500 && FS.pollIntervalMs(5, 610) === 5000 && FS.pollIntervalMs(1, 100000) === 5000 && FS.pollIntervalMs(0, 8) === 300000 && FS.pollIntervalMs(50, 8) === 300000)
check('ticks: out of order and exact repeats dropped, newer / changed accepted', !FS.acceptTick({ ts: 10, last: 1 }, { ts: 5, last: 2 }) && !FS.acceptTick({ ts: 10, last: 1 }, { ts: 10, last: 1 }) && FS.acceptTick({ ts: 10, last: 1 }, { ts: 10, last: 2 }) && FS.acceptTick({ ts: 10, last: 1 }, { ts: 11, last: 1 }) && FS.acceptTick(null, { ts: 1, last: 1 }) && !FS.acceptTick(null, { last: NaN }) && !FS.acceptTick(null, null))

// ── guard rails ──────────────────────────────────────────────────────────
const NOW = 1791885600
const pc = (q) => SG.parseCandlesQuery(q, NOW)
check('candles query: defaults', eq(pc({ symbol: 'EURUSD', tf: 'M15' }), { symbol: 'EURUSD', tf: 'M15', from: null, to: NOW, limit: 500 }))
check('candles query: limit clamped 1..5000, to clamped to now+60, range clamped to 10 years', pc({ symbol: 'EURUSD', tf: 'M1', limit: '99999' }).limit === 5000 && pc({ symbol: 'EURUSD', tf: 'M1', limit: '-5' }).limit === 1 && pc({ symbol: 'EURUSD', tf: 'M1', to: String(NOW + 99999) }).to === NOW + 60 && pc({ symbol: 'EURUSD', tf: 'D1', from: '1', to: String(NOW) }).from === NOW - 3650 * 86400)
check('candles query: rejects unknown symbol / timeframe / junk numbers / inverted range', throws(() => pc({ symbol: 'FOO', tf: 'M1' }))?.code === 'unsupported_symbol' && throws(() => pc({ symbol: 'EURUSD', tf: 'M2' }))?.code === 'bad_request' && throws(() => pc({ symbol: 'EURUSD', tf: 'M1', limit: 'abc' }))?.code === 'bad_request' && throws(() => pc({ symbol: 'EURUSD', tf: 'M1', from: String(NOW), to: String(NOW - 5) }))?.code === 'bad_request' && throws(() => pc({ symbol: 'NIFTY50', tf: 'M1' }))?.code === 'unsupported_symbol')
check('candles query: injection-ish values are just rejected', throws(() => pc({ symbol: 'EURUSD&apikey=x', tf: 'M1' })) !== null && throws(() => pc({ symbol: ['EURUSD', 'FOO'], tf: 'M1' })) === null && throws(() => pc({ symbol: '../../etc', tf: 'M1' })) !== null)
check('quote query: list, dedupe, max 8, allow-list', eq(SG.parseQuoteQuery({ symbols: 'EURUSD, XAUUSD,EURUSD' }), ['EURUSD', 'XAUUSD']) && throws(() => SG.parseQuoteQuery({}))?.code === 'bad_request' && throws(() => SG.parseQuoteQuery({ symbols: 'EURUSD,FOO' }))?.code === 'unsupported_symbol' && throws(() => SG.parseQuoteQuery({ symbols: 'EURUSD,XAUUSD,GBPUSD,USDJPY,GBPJPY,BTCUSD,ETHUSD,EURUSD2,X' }))?.code === 'bad_request')
const rl = SG.createRateLimiter({ limit: 3, windowMs: 1000 })
check('rate limiter: 3 per window per key, then Retry-After, then free again', rl.take('a', 0).ok && rl.take('a', 1).ok && rl.take('a', 2).ok && !rl.take('a', 3).ok && rl.take('b', 3).ok && rl.take('a', 3).retryAfter >= 1 && rl.take('a', 1002).ok)
check('rate limiter memory stays bounded', (() => { const r = SG.createRateLimiter({ limit: 1, windowMs: 10, maxKeys: 50 }); for (let i = 0; i < 500; i++) r.take('k' + i, i * 20); return r.size <= 60 })())
const cb = SG.createCreditBudget({ perMinute: 8, perDay: 800 })
check('credit budget: per-minute cap then reset next minute', cb.spend(5, 0).ok && !cb.spend(5, 1000).ok && cb.spend(5, 1000).code === 'rate_limited' && cb.spend(5, 60000).ok && cb.usage(60000).minute === 5)
check('credit budget: daily cap says quota with a long wait', (() => { const b = SG.createCreditBudget({ perMinute: 1000, perDay: 10 }); b.spend(10, 0); const r = b.spend(1, 5000); return !r.ok && r.code === 'quota' && r.retryAfter > 80000 })())
check('cache policy: quotes short, finished history immutable, forming bar a few seconds, errors / unknown never', SG.cachePolicy({ kind: 'quote' }) === 'public, s-maxage=5, stale-while-revalidate=15' && /immutable/.test(SG.cachePolicy({ kind: 'candles', tfSec: 900, toSec: 0, nowSec: 99999 })) && /s-maxage=10,/.test(SG.cachePolicy({ kind: 'candles', tfSec: 900, toSec: 100, nowSec: 101 })) && /s-maxage=2,/.test(SG.cachePolicy({ kind: 'candles', tfSec: 5, toSec: 100, nowSec: 101 })) && SG.cachePolicy({ kind: 'x' }) === 'no-store')
check('CORS: no Origin = fine, listed origin gets headers, others refused', SG.corsHeaders(undefined, 'https://a.com').ok && SG.corsHeaders('https://a.com', 'https://a.com, https://b.com').headers['Access-Control-Allow-Origin'] === 'https://a.com' && !SG.corsHeaders('https://evil.com', 'https://a.com').ok && !SG.corsHeaders('https://a.com', '').ok)
check('client ip from forwarded header', SG.clientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }) === '1.2.3.4' && SG.clientIp({}) === 'unknown')

// ── the proxy, with a fake fetch ─────────────────────────────────────────
const KEYS = { TWELVEDATA_API_KEY: 'TD-SECRET-KEY', FINNHUB_API_KEY: 'FH-SECRET-KEY' }
const mkRes = () => { const r = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { r.headers[k] = v }, end(b) { r.body = b ? JSON.parse(b) : null } }; return r }
const mkReq = (query, o = {}) => ({ method: 'GET', headers: { 'x-forwarded-for': '9.9.9.9', ...(o.headers || {}) }, query, ...o })
let calls = []
const fakeFetch = (routes) => async (url, init) => { calls.push({ url: String(url), headers: init.headers }); for (const [k, v] of Object.entries(routes)) if (String(url).includes(k)) { const x = typeof v === 'function' ? v(url) : v; return { status: x.status || 200, json: async () => { if (x.bad) throw new Error('not json'); return x.body } } } return { status: 500, json: async () => ({}) } }
let t = NOW * 1000
const proxy = (routes, env = KEYS) => createProxy({ env, fetchImpl: fakeFetch(routes), now: () => t })
const run = async (p, name, query, o) => { const res = mkRes(); await p.handle(name, mkReq(query, o), res); return res }

let p = proxy({ 'api.twelvedata.com/time_series': { body: F.TD_SERIES } })
let r = await run(p, 'candles', { symbol: 'XAUUSD', tf: 'M15', limit: '2' })
check('proxy candles: 200, newest 2 bars, source, server time, short edge cache', r.statusCode === 200 && r.body.candles.length === 2 && r.body.candles[1].close === 4381.2 && r.body.source === 'twelvedata' && r.body.serverTime === t && /s-maxage/.test(r.headers['Cache-Control']), JSON.stringify(r.body).slice(0, 150))
check('proxy sends the key only in the Authorization header, never in the URL', calls.at(-1).headers.Authorization === 'apikey TD-SECRET-KEY' && !calls.at(-1).url.includes('TD-SECRET-KEY'))
check('proxy response never contains a secret', !JSON.stringify(r).includes('SECRET'))
check('proxy sets nosniff + JSON content type', r.headers['X-Content-Type-Options'] === 'nosniff' && /application\/json/.test(r.headers['Content-Type']))
r = await run(proxy({ 'api.twelvedata.com': { body: F.TD_ERR_KEY } }), 'candles', { symbol: 'EURUSD', tf: 'M1' })
check('provider auth failure -> 502 auth, no-store, key not leaked', r.statusCode === 502 && r.body.error.code === 'auth' && r.headers['Cache-Control'] === 'no-store' && !JSON.stringify(r).includes('SECRET'))
r = await run(proxy({ 'api.twelvedata.com': { body: F.TD_ERR_RATE } }), 'candles', { symbol: 'EURUSD', tf: 'M1' })
check('provider rate limit -> 429 with Retry-After', r.statusCode === 429 && r.body.error.code === 'rate_limited' && r.headers['Retry-After'] === '30')
r = await run(proxy({}, {}), 'candles', { symbol: 'EURUSD', tf: 'M1' })
check('no key configured -> 503 not_configured (no upstream call)', r.statusCode === 503 && r.body.error.code === 'not_configured')
r = await run(proxy({ 'twelvedata': { bad: true } }), 'candles', { symbol: 'EURUSD', tf: 'M1' })
check('non-JSON upstream body -> 502, not a crash', r.statusCode === 502)
r = await run(proxy({}), 'candles', { symbol: 'EURUSD', tf: 'M1' })
check('unreachable / failing upstream -> 502 upstream', r.statusCode === 502 && r.body.error.code === 'upstream')
r = await run(proxy({}), 'candles', { symbol: 'FOO', tf: 'M1' })
check('unknown symbol -> 404 before any upstream call', r.statusCode === 404 && r.body.error.code === 'unsupported_symbol')
calls = []
r = await run(proxy({}), 'candles', { symbol: 'NIFTY50', tf: 'M1' })
check('NIFTY50 -> 404, nothing sent upstream', r.statusCode === 404 && calls.length === 0)

p = proxy({ 'finnhub.io/api/v1/crypto/candle': (u) => ({ body: F.FH_CANDLES }) })
r = await run(p, 'candles', { symbol: 'BTCUSD', tf: 'M1', limit: '10' })
check('proxy crypto candles from Finnhub (header auth, no key in URL)', r.statusCode === 200 && r.body.source === 'finnhub' && r.body.candles.length === 3 && calls.at(-1).headers['X-Finnhub-Token'] === 'FH-SECRET-KEY' && !calls.at(-1).url.includes('FH-SECRET-KEY'))
r = await run(p, 'candles', { symbol: 'BTCUSD', tf: 'H4', limit: '5' })
check('proxy H4 crypto: asks Finnhub for H1 and aggregates to 4h buckets', /resolution=60/.test(calls.at(-1).url) && r.statusCode === 200 && r.body.candles.every((c) => c.time % 14400 === 0))
r = await run(proxy({ 'crypto/candle': { body: F.FH_ERR_PREMIUM, status: 403 } }), 'candles', { symbol: 'ETHUSD', tf: 'M5' })
check('Finnhub premium-only -> 502 plan error', r.statusCode === 502 && r.body.error.code === 'plan')

p = proxy({ 'api.twelvedata.com/quote': { body: F.TD_QUOTE_MANY }, 'crypto/candle': { body: F.FH_CANDLES } })
calls = []
r = await run(p, 'quote', { symbols: 'EURUSD,XAUUSD,GBPUSD,BTCUSD' })
check('proxy quote: ONE batched Twelve Data call + one Finnhub call; good symbols ticks, bad one an error', calls.filter((c) => c.url.includes('twelvedata')).length === 1 && calls.filter((c) => c.url.includes('finnhub')).length === 1 && r.statusCode === 200 && r.body.quotes.EURUSD.last === 1.1662 && r.body.quotes.XAUUSD.last === 4382.4 && r.body.quotes.GBPUSD.error.code === 'unsupported_symbol' && r.body.quotes.BTCUSD.last === 67005)
check('proxy quote: short edge cache', /s-maxage=5/.test(r.headers['Cache-Control']))
r = await run(proxy({ 'api.twelvedata.com/quote': { body: F.TD_ERR_KEY } }), 'quote', { symbols: 'EURUSD' })
check('proxy quote: every symbol failing answers with the real error status', r.statusCode === 502 && r.body.error.code === 'auth')

p = proxy({ 'api.twelvedata.com': { body: F.TD_SERIES } }, { ...KEYS, TWELVEDATA_CREDITS_PER_MIN: '2' })
await run(p, 'candles', { symbol: 'EURUSD', tf: 'M1' }); await run(p, 'candles', { symbol: 'EURUSD', tf: 'M5' })
calls = []
r = await run(p, 'candles', { symbol: 'EURUSD', tf: 'M15' })
check('our own credit budget stops a 3rd call in the minute before the vendor does (429, no upstream call)', r.statusCode === 429 && r.body.error.code === 'rate_limited' && calls.length === 0)
t += 61000
r = await run(p, 'candles', { symbol: 'EURUSD', tf: 'M15' })
check('...and the budget refills next minute', r.statusCode === 200)

p = proxy({ 'api.twelvedata.com': { body: F.TD_SERIES } }, { ...KEYS, RATE_LIMIT_PER_MIN: '3' })
const codes = []
for (let i = 0; i < 5; i++) codes.push((await run(p, 'symbols', {})).statusCode)
check('per-IP rate limit: 4th request in a minute is 429 with Retry-After; another IP is fine', eq(codes, [200, 200, 200, 429, 429]) && (await run(p, 'symbols', {}, { headers: { 'x-forwarded-for': '8.8.8.8' } })).statusCode === 200)
r = await run(proxy({}, { ...KEYS, ALLOWED_ORIGIN: 'https://app.example.com' }), 'symbols', {}, { headers: { origin: 'https://evil.example.com' } })
check('CORS: a foreign origin gets 403', r.statusCode === 403)
r = await run(proxy({}, { ...KEYS, ALLOWED_ORIGIN: 'https://app.example.com' }), 'symbols', {}, { headers: { origin: 'https://app.example.com' } })
check('CORS: the app origin is echoed back', r.statusCode === 200 && r.headers['Access-Control-Allow-Origin'] === 'https://app.example.com')
r = await run(proxy({}), 'symbols', {}, { method: 'POST' })
check('POST is refused with 405 + Allow', r.statusCode === 405 && r.headers.Allow === 'GET, OPTIONS')
r = await run(proxy({}), 'symbols', {}, { method: 'OPTIONS', headers: { origin: 'https://x.com' } })
check('preflight from a non-allowed origin is refused', r.statusCode === 403)
r = await run(proxy({}), 'symbols', { q: 'gold' })
check('symbols: static, searchable, cached a day, NIFTY50 absent', r.statusCode === 200 && r.body.symbols.length === 1 && r.body.symbols[0].symbol === 'XAUUSD' && /s-maxage=86400/.test(r.headers['Cache-Control']) && !(await run(proxy({}), 'symbols', {})).body.symbols.some((s) => s.symbol === 'NIFTY50'))
r = await run(proxy({}), 'health', {})
check('health: which providers are configured (booleans only), usage, never the keys', r.statusCode === 200 && r.body.providers.twelvedata === true && r.body.providers.finnhub === true && !JSON.stringify(r.body).includes('SECRET') && r.headers['Cache-Control'] === 'no-store')
r = await run(proxy({}, {}), 'health', {})
check('health without keys says so', r.body.providers.twelvedata === false && r.body.providers.finnhub === false)

check('TD quote URL asks for interval=1min (else the timestamp is the DAILY bar)', new URL(TD.quoteUrl(['EUR/USD', 'XAU/USD'])).searchParams.get('interval') === '1min')
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
