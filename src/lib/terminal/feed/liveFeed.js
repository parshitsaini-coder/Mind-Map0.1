// Browser-side live feed. Talks ONLY to same-origin /api/* (never to the data provider).
// - getCandles(symbol, tf, {to, limit})  history from memory / IndexedDB / the API, higher TFs built from lower ones
// - subscribe(symbol, cb)                ONE polling loop per symbol, pauses when the tab is hidden
// - getStatus() / subscribeStatus(cb)    live | delayed | offline | closed | loading + reason
import { FeedError, FEED_ALLOWED, TF_SECONDS } from './feedTypes.js'
import { mergeCandles, applyTick, fillGaps, dropIdle, aggregate, sourceTf, memGet, memPut, idbLoad, idbSave, bucketOf } from './candleStore.js'
import { connectionState, backoffMs } from './feedStatus.js'
import { isMarketOpen } from '../marketHours.js'
import { quoteFromMid } from './spread.js'

export const POLL_MS = 30000
export const CLOSED_POLL_MS = 5 * 60000
export const PROVIDER_LABEL = 'Twelve Data'

export function createLiveFeed({ fetchImpl, now = () => Date.now(), timers = { set: setTimeout, clear: clearTimeout }, isHidden = () => (typeof document !== 'undefined' && document.hidden), api = '/api' } = {}) {
  const doFetch = (...a) => (fetchImpl || globalThis.fetch)(...a)
  const loops = new Map() // symbol -> { subs:Set, timer, failures, busy }
  const statusSubs = new Set()
  const meta = {} // symbol -> { prevClose, providerOpen, lastUpdate, last }
  const LS = 'mm-last-tick'
  let failures = 0
  let reason = null
  let everLoaded = false
  let provider = PROVIDER_LABEL
  let lastState = null
  let snap = null

  // last known price from the previous visit (shown as "Offline — last known" if the network is down)
  try {
    const o = JSON.parse(localStorage.getItem(LS) || 'null')
    if (o && Number.isFinite(o.last) && Number.isFinite(o.ts) && FEED_ALLOWED.includes(o.symbol)) { meta[o.symbol] = { prevClose: o.prevClose ?? null, providerOpen: null, lastUpdate: o.ts, last: o.last } }
  } catch { /* ignore */ }
  const nowSec = () => Math.floor(now() / 1000)
  const m = (s) => (meta[s] ||= { prevClose: null, providerOpen: null, lastUpdate: null, last: null })

  async function getJson(path, params) {
    const qs = new URLSearchParams(params).toString()
    let res
    try { res = await doFetch(`${api}/${path}?${qs}`, { headers: { accept: 'application/json' } }) } catch { throw new FeedError('OFFLINE') }
    let body = null
    try { body = await res.json() } catch { /* ignore */ }
    if (!res.ok) throw new FeedError(body?.error?.code && body.error.code in { QUOTA: 1, RATE_LIMIT: 1, NO_KEY: 1, SYMBOL_NOT_ALLOWED: 1, BAD_REQUEST: 1 } ? body.error.code : 'UPSTREAM', body?.error?.message)
    if (body?.provider) provider = body.provider
    return body
  }

  const primarySymbol = () => [...loops.keys()][0] || 'XAUUSD'
  function getStatus() {
    const s = primarySymbol()
    const mm = m(s)
    const marketOpen = mm.providerOpen ?? isMarketOpen(nowSec())
    const state = connectionState({ now: nowSec(), lastUpdate: mm.lastUpdate, marketOpen, failures, everLoaded })
    return { state, provider, lastUpdate: mm.lastUpdate, reason: state === 'live' || state === 'closed' ? null : reason, marketOpen, failures }
  }
  function notify() {
    const st = getStatus()
    const sig = `${st.state}|${st.reason}|${st.marketOpen}`
    if (sig === lastState) return
    lastState = sig
    snap = st
    statusSubs.forEach((cb) => cb(st))
  }
  const getStatusSnapshot = () => (snap ||= getStatus())
  const subscribeStatus = (cb) => { statusSubs.add(cb); return () => statusSubs.delete(cb) }

  function tickOf(symbol) {
    const mm = m(symbol)
    if (mm.last == null) return null
    const q = quoteFromMid(symbol, mm.last, mm.lastUpdate ?? nowSec())
    return { ...q, last: mm.last, ts: mm.lastUpdate, source: 'twelvedata', time: nowSec() }
  }

  async function getQuoteSnapshot(symbol) {
    const body = await getJson('quote', { symbol })
    const mm = m(symbol)
    mm.last = body.last
    mm.prevClose = body.prevClose ?? mm.prevClose
    mm.providerOpen = typeof body.isOpen === 'boolean' ? body.isOpen : null
    mm.lastUpdate = Math.min(nowSec(), body.ts || nowSec())
    everLoaded = true
    failures = 0
    reason = null
    try { localStorage.setItem(LS, JSON.stringify({ symbol, last: mm.last, prevClose: mm.prevClose, ts: mm.lastUpdate })) } catch { /* private mode */ }
    return tickOf(symbol)
  }

  function schedule(symbol, delay) {
    const l = loops.get(symbol)
    if (!l) return
    timers.clear(l.timer)
    l.timer = timers.set(() => poll(symbol), delay)
  }
  async function poll(symbol) {
    const l = loops.get(symbol)
    if (!l || l.busy) return
    if (isHidden()) { l.paused = true; return } // resumed by resume()
    l.busy = true
    try {
      const t = await getQuoteSnapshot(symbol)
      if (loops.get(symbol) === l) {
        // fold the live price into stored candles so a later getCandles sees the forming bar
        l.subs.forEach((cb) => cb(t))
      }
      notify()
      const open = getStatus().marketOpen
      schedule(symbol, open ? POLL_MS : CLOSED_POLL_MS)
    } catch (e) {
      failures++
      const quota = e.code === 'QUOTA' || e.code === 'RATE_LIMIT'
      reason = e.code === 'OFFLINE' ? 'No internet connection' : e.code === 'NO_KEY' ? 'Data provider key is not set up on the server' : e.message
      notify()
      schedule(symbol, backoffMs(failures, { quota, base: 3000, cap: 60000 }))
    } finally { l.busy = false }
  }
  const resume = () => { for (const [s, l] of loops) if (l.paused) { l.paused = false; poll(s) } }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', () => { if (!document.hidden) resume() })
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('online', () => { for (const s of loops.keys()) poll(s) })

  function subscribe(symbol, cb) {
    if (!FEED_ALLOWED.includes(symbol)) return () => {}
    let l = loops.get(symbol)
    if (!l) { l = { subs: new Set(), timer: null, busy: false, paused: false }; loops.set(symbol, l); poll(symbol) }
    l.subs.add(cb)
    const t = tickOf(symbol)
    if (t) cb(t)
    return () => {
      l.subs.delete(cb)
      if (!l.subs.size) { timers.clear(l.timer); loops.delete(symbol) }
    }
  }
  // wake up the status badge / "market closed" label on a clock boundary
  const clockIv = typeof setInterval !== 'undefined' ? setInterval(notify, 15000) : null
  if (clockIv?.unref) clockIv.unref()

  // ── candles ──
  const inflightC = new Map()
  async function fetchCandles(symbol, srcTf, limit, to) {
    const body = await getJson('candles', { symbol, tf: srcTf, limit: String(limit), ...(to ? { to: String(to) } : {}) })
    const fresh = Array.isArray(body.candles) ? body.candles : []
    const merged = memPut(symbol, srcTf, fresh)
    idbSave(symbol, srcTf, merged)
    return merged
  }
  // Returns candles oldest first. `to` (UTC sec) = load history OLDER than that; `limit` = how many to return.
  async function getCandles(symbol, tf, { to, limit = 1500, refresh = true } = {}) {
    if (!FEED_ALLOWED.includes(symbol)) throw new FeedError('SYMBOL_NOT_ALLOWED')
    const src = sourceTf(tf)
    const need = tf === 'H4' ? limit * 4 : limit
    let have = memGet(symbol, src)
    if (!have.length) { const fromDb = await idbLoad(symbol, src); if (fromDb.length) have = memPut(symbol, src, fromDb) }
    const key = `${symbol}|${src}|${to || 'live'}|${need}`
    const wantFetch = to ? !have.length || have[0].time > to - TF_SECONDS[src] * need : refresh
    if (wantFetch) {
      if (!inflightC.has(key)) inflightC.set(key, fetchCandles(symbol, src, Math.min(5000, need), to).finally(() => inflightC.delete(key)))
      try { have = await inflightC.get(key) } catch (e) { if (!have.length) throw e } // offline: fall back to what we stored
    }
    let out = to ? have.filter((c) => c.time < to) : have
    // Drop flat (open=high=low=close) bars that sit in closed-market hours — weekend / maintenance
    // placeholders drew a dashed line across the gap and stretched the time axis with blank days.
    out = dropIdle(out, { isOpen: isMarketOpen })
    out = fillGaps(out, TF_SECONDS[src], { isOpen: isMarketOpen })
    if (tf === 'H4') out = aggregate(out, TF_SECONDS.H4)
    // fold the live price into the forming candle
    const mm = m(symbol)
    // (not while the market is closed: that would start a fake flat candle at "now")
    if (!to && mm.last != null && mm.lastUpdate && Math.floor(Date.now() / 1000) - mm.lastUpdate < 600 && isMarketOpen() && (mm.providerOpen ?? true)) out = applyTick(out, mm.last, mm.lastUpdate, TF_SECONDS[tf])
    return out.length > limit ? out.slice(out.length - limit) : out
  }
  const peek = (symbol) => tickOf(symbol)
  const getPrevClose = (symbol) => m(symbol).prevClose
  const searchSymbols = async (q) => (await getJson('symbols', { q: q || '' })).symbols
  return { getCandles, subscribe, getQuoteSnapshot, getStatus, subscribeStatus, searchSymbols, getPrevClose, getStatusSnapshot, peek, _meta: meta, _loops: loops, bucketOf }
}

const feed = createLiveFeed()
export const getCandles = (...a) => feed.getCandles(...a)
export const subscribe = (...a) => feed.subscribe(...a)
export const getQuoteSnapshot = (...a) => feed.getQuoteSnapshot(...a)
export const getStatus = () => feed.getStatus()
export const subscribeStatus = (cb) => feed.subscribeStatus(cb)
export const searchSymbols = (q) => feed.searchSymbols(q)
export const getPrevClose = (s) => feed.getPrevClose(s)
export const getStatusSnapshot = () => feed.getStatusSnapshot()
export const peek = (s) => feed.peek(s)
export default feed
