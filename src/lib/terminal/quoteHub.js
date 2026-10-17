// Shared live-quote store for the trading UI. Subscribes to the feed once per symbol
// (ref-counted) and publishes a new snapshot at most every 100 ms (~10 UI updates/sec).
import { subscribe } from './feed/liveFeed.js'

let feedSubscribe = subscribe // tests swap in a deterministic test-only feed
export const setFeedSubscribe = (fn) => { feedSubscribe = fn || subscribe }
const quotes = {}
const refs = new Map()
const listeners = new Set()
let snapshot = {}
let timer = null

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  snapshot = { ...quotes }
  listeners.forEach((l) => l())
}
const schedule = () => { if (!timer) timer = setTimeout(flush, 100) }

export function watch(symbol) {
  let r = refs.get(symbol)
  if (!r) {
    r = { count: 0, unsub: null }
    refs.set(symbol, r)
    r.unsub = feedSubscribe(symbol, (q) => {
      const first = !quotes[symbol]
      quotes[symbol] = q
      if (first) flush()
      else schedule()
    })
  }
  r.count++
  let done = false
  return () => {
    if (done) return
    done = true
    r.count--
    if (r.count === 0) {
      r.unsub()
      refs.delete(symbol)
      delete quotes[symbol]
      schedule()
    }
  }
}

export const subscribeHub = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const getSnapshot = () => snapshot
