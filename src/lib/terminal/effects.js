// Phase 12 — the event bus. Anything that happens in the terminal calls emitTerminalEvent() ONCE and the
// bus fans it out to subscribers: sound, haptics, toast (registered by the store) and the chart effect
// (Phase 13 registers its renderer under the name 'chart'). The catalogue (eventCatalog.js) holds the defaults.
import { EVENTS_BY_ID } from './eventCatalog.js'
import { playEvent } from './soundEngine.js'
import { dispatchChartEvent } from './chartFx.js'

const subs = new Map()
export function registerSubscriber(name, fn) {
  subs.set(name, fn)
  return () => { if (subs.get(name) === fn) subs.delete(name) }
}
export const subscriberNames = () => [...subs.keys()]

// evt = 'order.buy.filled' or { id, text?, kind?, action?, data? }. Returns false for an unknown id.
export function emitTerminalEvent(evt) {
  const e = typeof evt === 'string' ? { id: evt } : evt
  const def = e && EVENTS_BY_ID[e.id]
  if (!def) return false
  const full = { ...e, def, text: e.text === undefined ? def.toast : e.text, kind: e.kind || def.kind }
  for (const [name, fn] of subs) {
    try { fn(full) } catch (err) { if (typeof console !== 'undefined' && name !== 'sound') console.warn?.(`[effects] ${name} failed`, err) }
  }
  return true
}

// built-in: sound (+ vibration) — the engine reads the settings at play time
subs.set('sound', (e) => playEvent(e.id))
// built-in: chart effects — every mounted chart listens (chartFx.js onChartEvent) and draws what applies to its symbol
subs.set('chart', (e) => dispatchChartEvent(e))
