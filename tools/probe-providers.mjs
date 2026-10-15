#!/usr/bin/env node
// Phase 14 decision-gate probe. Run on YOUR machine (Node 18+):   node tools/probe-providers.mjs
// It checks, with the free keys you have, whether each provider really serves our 6 symbols (+ BTC), whether history
// works, how old the last price is, and what error the free plan gives. Keys come from environment variables only and
// are never printed or written. Output: a table + tools/probe-report.json (safe to send back to me; it has no keys).
//
//   TWELVEDATA_API_KEY=...  FINNHUB_API_KEY=...  OANDA_TOKEN=...  OANDA_ACCOUNT=101-xxx-xxxxxxx-001  [OANDA_ENV=practice|live]
//   Any provider without its key is skipped. Binance needs no key.
import { writeFileSync } from 'node:fs'

const rows = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => Math.floor(Date.now() / 1000)
async function get(url, headers = {}) {
  const t0 = Date.now()
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: r.status, json, text: text.slice(0, 200), ms: Date.now() - t0 }
  } catch (e) { return { status: 0, json: null, text: String(e.cause?.code || e.message).slice(0, 120), ms: Date.now() - t0 } }
}
const add = (provider, item, ok, note, extra = {}) => { rows.push({ provider, item, ok, note, ...extra }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${provider.padEnd(11)} ${item.padEnd(28)} ${note}`) }
const age = (sec) => (sec == null ? '' : ` last price ${Math.max(0, now() - sec)}s old`)

// ── Binance (no key) ─────────────────────────────────────────────────────
async function binance() {
  const base = 'https://data-api.binance.vision'
  const k = await get(`${base}/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=3`)
  add('binance', 'BTCUSDT 1m candles', k.status === 200 && Array.isArray(k.json), k.status === 451 ? 'HTTP 451 = blocked in this region' : `HTTP ${k.status}${k.json?.length ? age(Math.floor(k.json.at(-1)[6] / 1000)) : ' ' + k.text}`, { ms: k.ms })
  const b = await get(`${base}/api/v3/ticker/bookTicker?symbol=BTCUSDT`)
  add('binance', 'BTCUSDT bid / ask', b.status === 200 && !!b.json?.bidPrice, b.json?.bidPrice ? `bid ${b.json.bidPrice} ask ${b.json.askPrice} (real bid/ask)` : `HTTP ${b.status} ${b.text}`, { ms: b.ms })
}

// ── Twelve Data (key) ────────────────────────────────────────────────────
async function twelve(key) {
  // free plan = 8 credits / minute: one call, then wait. ~1.5 minutes in total.
  const syms = [['XAUUSD', 'XAU/USD'], ['EURUSD', 'EUR/USD'], ['GBPUSD', 'GBP/USD'], ['USDJPY', 'USD/JPY'], ['GBPJPY', 'GBP/JPY'], ['NIFTY50 (try 1)', 'NIFTY&exchange=NSE'], ['NIFTY50 (try 2)', 'NSEI'], ['BTCUSD', 'BTC/USD']]
  let used = 0
  for (const [name, s] of syms) {
    if (used && used % 7 === 0) await sleep(61000)
    const r = await get(`https://api.twelvedata.com/time_series?symbol=${s}&interval=15min&outputsize=3&apikey=${key}`)
    used++
    const ok = r.json?.status === 'ok' && r.json.values?.length
    const last = ok ? r.json.values[0].datetime : null
    add('twelvedata', `${name} 15min history`, !!ok, ok ? `latest bar ${last} (${r.json.meta?.exchange || r.json.meta?.type || ''})` : `${r.json?.code || r.status} ${String(r.json?.message || r.text).slice(0, 110)}`, { ms: r.ms })
  }
  await sleep(8000)
  const q = await get(`https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${key}`)
  add('twelvedata', 'XAU/USD quote (bid/ask?)', q.json?.status !== 'error' && q.status === 200, q.json?.close ? `close ${q.json.close}; fields: ${Object.keys(q.json).filter((x) => /bid|ask|is_market_open|timestamp/.test(x)).join(',') || 'no bid/ask'}` : `${q.json?.code} ${String(q.json?.message || q.text).slice(0, 110)}`, { ms: q.ms })
}


// ── Twelve Data WebSocket trial (free plan: 1 connection, 8 trial symbols). Needs Node 22+ (global WebSocket). ~15 seconds.
async function twelveWs(key) {
  if (typeof WebSocket === 'undefined') return add('twelvedata-ws', 'websocket trial', false, 'skipped: needs Node 22+ (no global WebSocket here)')
  const want = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'BTC/USD']
  await new Promise((resolve) => {
    const ticks = {}, t0 = Date.now()
    let ok = [], fails = [], timer, hb
    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`)
    const done = (note) => { clearTimeout(timer); clearInterval(hb); try { ws.close() } catch { /* ignore */ }
      add('twelvedata-ws', 'subscribe accepted', ok.length > 0, `ok: ${ok.join(',') || 'none'}; refused: ${fails.map((f) => f.symbol || f).join(',') || 'none'}${note ? ' (' + note + ')' : ''}`)
      for (const s of want) if (ok.includes(s)) add('twelvedata-ws', `${s} ticks in 12 s`, (ticks[s]?.n || 0) > 0, `${ticks[s]?.n || 0} ticks${ticks[s]?.bid ? ', bid/ask present' : ', no bid/ask'}${ticks[s]?.ts ? age(ticks[s].ts) : ''}`)
      resolve() }
    ws.onopen = () => { ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: want.join(',') } })); hb = setInterval(() => ws.send(JSON.stringify({ action: 'heartbeat' })), 10000) }
    ws.onmessage = (m) => { let d; try { d = JSON.parse(m.data) } catch { return }
      if (d.event === 'subscribe-status') { ok = (d.success || []).map((x) => x.symbol); fails = d.fails || [] }
      if (d.event === 'price') { const x = (ticks[d.symbol] ||= { n: 0 }); x.n++; x.ts = d.timestamp; if (d.bid != null) x.bid = d.bid } }
    ws.onerror = () => done('connection error')
    timer = setTimeout(() => done(''), 12000)
  })
}

// ── Finnhub (key) ────────────────────────────────────────────────────────
async function finnhub(key) {
  const h = { 'X-Finnhub-Token': key }
  for (const [name, s] of [['XAUUSD', 'OANDA:XAU_USD'], ['EURUSD', 'OANDA:EUR_USD'], ['USDJPY', 'OANDA:USD_JPY'], ['GBPJPY', 'OANDA:GBP_JPY'], ['BTC', 'BINANCE:BTCUSDT']]) {
    const isCrypto = s.startsWith('BINANCE')
    const r = await get(`https://finnhub.io/api/v1/${isCrypto ? 'crypto' : 'forex'}/candle?symbol=${s}&resolution=15&from=${now() - 6 * 3600}&to=${now()}`, h)
    const ok = r.json?.s === 'ok'
    add('finnhub', `${name} 15m candles`, ok, ok ? `${r.json.t.length} bars${age(r.json.t.at(-1))}` : `HTTP ${r.status} ${String(r.json?.error || r.json?.s || r.text).slice(0, 100)}`, { ms: r.ms })
    await sleep(1200)
  }
}

// ── OANDA v20 (token + account) ──────────────────────────────────────────
async function oanda(token, account, env) {
  const host = env === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com'
  const h = { Authorization: `Bearer ${token}` }
  const ins = await get(`https://${host}/v3/accounts/${account}/instruments`, h)
  const list = ins.json?.instruments
  add('oanda', `instruments (${env})`, !!list, list ? `${list.length} instruments; indices: ${list.filter((i) => i.type === 'CFD' && /IN50|NAS|SPX|US30|DE30|UK100|JP225/.test(i.name)).map((i) => i.name).join(',') || 'none'}` : `HTTP ${ins.status} ${ins.text}`, { ms: ins.ms })
  if (!list) return
  const names = new Set(list.map((i) => i.name))
  add('oanda', 'India 50 (IN50_USD)', names.has('IN50_USD'), names.has('IN50_USD') ? 'available on this account' : 'NOT offered to this account')
  for (const n of ['XAU_USD', 'EUR_USD', 'GBP_USD', 'USD_JPY', 'GBP_JPY', 'IN50_USD'].filter((x) => names.has(x))) {
    const p = await get(`https://${host}/v3/accounts/${account}/pricing?instruments=${n}`, h)
    const px = p.json?.prices?.[0]
    add('oanda', `${n} bid / ask`, !!px, px ? `bid ${px.bids?.[0]?.price} ask ${px.asks?.[0]?.price} tradeable=${px.tradeable}` : `HTTP ${p.status} ${p.text}`, { ms: p.ms })
    const c = await get(`https://${host}/v3/instruments/${n}/candles?granularity=M15&count=3&price=M`, h)
    add('oanda', `${n} M15 candles`, !!c.json?.candles?.length, c.json?.candles?.length ? `${c.json.candles.length} bars, last ${c.json.candles.at(-1).time.slice(0, 19)}` : `HTTP ${c.status} ${c.text}`, { ms: c.ms })
  }
}

const env = process.env
console.log('Probing… (keys are read from environment variables and never printed)\n')
await binance()
if (env.TWELVEDATA_API_KEY) { await twelve(env.TWELVEDATA_API_KEY); await twelveWs(env.TWELVEDATA_API_KEY) } else console.log('SKIP twelvedata (no TWELVEDATA_API_KEY)')
if (env.FINNHUB_API_KEY) await finnhub(env.FINNHUB_API_KEY); else console.log('SKIP finnhub (no FINNHUB_API_KEY)')
if (env.OANDA_TOKEN && env.OANDA_ACCOUNT) await oanda(env.OANDA_TOKEN, env.OANDA_ACCOUNT, env.OANDA_ENV === 'live' ? 'live' : 'practice'); else console.log('SKIP oanda (need OANDA_TOKEN and OANDA_ACCOUNT)')
writeFileSync(new URL('./probe-report.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), node: process.version, rows }, null, 2))
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} checks OK. Report: tools/probe-report.json (contains no keys).`)
