// One polling loop for ALL watched symbols (Phase 14). Ref-counted watch(), batched /api/quote, paused while the tab is
// hidden or nobody watches, exponential backoff + jitter on errors (and on quota / rate-limit, honouring retryAfter),
// de-dupes / orders ticks, derives a connection status per symbol. Clock, timers, visibility and client are injected.
import { acceptTick, backoffMs, freshnessOf, pollIntervalMs } from './feedStatus.js'
import { marketStatus } from './marketHours.js'

export function createLiveHub({
  client, now = () => Date.now(), setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (t) => clearTimeout(t),
  isVisible = () => (typeof document === 'undefined' ? true : !document.hidden), perMinute = 8, rng = Math.random, holidays = [],
} = {}) {
  const refs = new Map()        // symbol -> count
  const ticks = {}              // symbol -> accepted Tick
  const listeners = new Set()
  const status = { failures: 0, lastError: null, lastOkMs: null, started: false, nextAt: null }
  let timer = null, inflight = false, stopped = false

  const emit = () => listeners.forEach((l) => l())
  const symbols = () => [...refs.keys()]
  const pollMs = () => pollIntervalMs(symbols().length, perMinute)

  function statusOf(symbol) {
    const t = ticks[symbol]
    const mk = marketStatus(symbol, now(), holidays)
    const state = freshnessOf({ now: now(), lastTickMs: t?.recvMs ?? null, marketOpen: mk.open, started: status.started, pollMs: pollMs(), failures: status.failures })
    return { state, market: mk, lastTickMs: t?.ts ?? null, reason: status.lastError?.message, failures: status.failures }
  }

  function applyQuotes(quotes) {
    let changed = false
    for (const [sym, v] of Object.entries(quotes || {})) {
      if (!refs.has(sym) || !v || v.error) continue
      const prev = ticks[sym]
      if (!acceptTick(prev, v)) { if (prev) { ticks[sym] = { ...prev, recvMs: now() }; changed = true } continue } // fresh poll, same price: still alive
      ticks[sym] = { ...v, recvMs: now() }
      changed = true
    }
    return changed
  }

  function schedule(ms) {
    if (stopped || timer || !refs.size) return
    status.nextAt = now() + ms
    timer = setTimer(() => { timer = null; poll() }, ms)
  }

  async function poll() {
    if (stopped || inflight || !refs.size) return
    if (!isVisible()) return // resumed by resume()
    inflight = true
    status.started = true
    let next = 0
    try {
      const { quotes } = await client.getQuotes(symbols())
      status.failures = 0; status.lastError = null; status.lastOkMs = now()
      applyQuotes(quotes)
      next = pollMs() // after the await: more symbols may have been watched meanwhile
    } catch (e) {
      status.failures++; status.lastError = { code: e.code || 'network', message: e.message || 'Price server unreachable' }
      const backoff = backoffMs(status.failures - 1, { base: 2000, max: 60000, rng })
      next = Math.max(backoff, (e.retryAfter || 0) * 1000, e.code === 'quota' ? 300000 : 0)
    } finally { inflight = false }
    emit()
    schedule(next)
  }

  function resume() { // tab visible again / network back: poll now, do not wait out the timer
    if (stopped || !refs.size) return
    if (timer) { clearTimer(timer); timer = null }
    poll()
  }

  return {
    watch(symbol) {
      refs.set(symbol, (refs.get(symbol) || 0) + 1)
      if (refs.size && !timer && !inflight) { if (refs.get(symbol) === 1) resume() }
      let done = false
      return () => {
        if (done) return
        done = true
        const n = (refs.get(symbol) || 1) - 1
        if (n <= 0) { refs.delete(symbol); delete ticks[symbol]; emit() } else refs.set(symbol, n)
        if (!refs.size && timer) { clearTimer(timer); timer = null }
      }
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
    tickOf: (s) => ticks[s] || null,
    statusOf, pollMs, resume,
    pause() { if (timer) { clearTimer(timer); timer = null } },
    stop() { stopped = true; if (timer) clearTimer(timer); timer = null },
    _state: () => ({ status, refs: new Map(refs), hasTimer: !!timer, inflight }),
  }
}
