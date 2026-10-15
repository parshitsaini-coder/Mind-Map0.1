// Phase 10: store-touching helpers shared by the position pills and the chart (not pure: they read the
// store and the live quotes). The maths they rely on is in lib/terminal/positionOverlay.js.
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { atr as atrOf } from '../../lib/terminal/indicators'
import * as O from '../../lib/terminal/positionOverlay'

const st = () => useTerminalStore.getState()
const fmt = (n, inst) => Number(n).toLocaleString('en-US', { minimumFractionDigits: inst.digits, maximumFractionDigits: inst.digits })

function lastAtr(candles) {
  if (!candles || candles.length < 15) return null
  const arr = atrOf(candles, 14).lines.atr
  const v = arr?.[arr.length - 1]
  return Number.isFinite(v) ? v : null
}

// Default SL and/or TP from Settings → Trading. which: 'sl' | 'tp' | 'both'. Only fills what is missing.
export function applyDefaultStops(id, which, candles) {
  const p = st().positions.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Position not found' }
  const q = getSnapshot()[p.symbol]
  if (!q) return { ok: false, error: 'Waiting for live price…' }
  const inst = INSTRUMENTS[p.symbol]
  const t = st().chartSettings.trading
  const ref = p.side === 'buy' ? q.bid : q.ask // same price the ledger validates against
  const atr = lastAtr(candles)
  const patch = {}
  for (const kind of ['sl', 'tp']) {
    if (which !== 'both' && which !== kind) continue
    if (p[kind] != null) continue
    const r = O.defaultStop(kind, { side: p.side, ref, unit: t[`def${kind === 'sl' ? 'Sl' : 'Tp'}Unit`], value: t[`def${kind === 'sl' ? 'Sl' : 'Tp'}Value`], atr, inst })
    if (r.error) { st().notify(r.error, 'error'); return { ok: false, error: r.error } }
    patch[kind] = r.price
  }
  if (!Object.keys(patch).length) return { ok: false, error: 'Already set' }
  const say = Object.entries(patch).map(([k, v]) => `${k.toUpperCase()} ${fmt(v, inst)}`).join(' · ')
  const r = st().modifyPosition(id, patch, getSnapshot(), { say: `Set ${say}`, getQuotes: getSnapshot })
  if (!r.ok) st().notify(r.error, 'error')
  return r
}

// Commit a stop picked in "place" mode (ghost line + click).
export function commitPlacedStop(id, kind, price) {
  const p = st().positions.find((x) => x.id === id)
  if (!p) return { ok: false, error: 'Position not found' }
  const inst = INSTRUMENTS[p.symbol]
  const v = O.validateDrag({ kind, side: p.side }, price, { inst, quote: getSnapshot()[p.symbol] })
  if (!v.ok) { st().notify(v.reason, 'error'); return { ok: false, error: v.reason } }
  const r = st().modifyPosition(id, { [kind]: price }, getSnapshot(), { say: `${kind.toUpperCase()} set to ${fmt(price, inst)}`, getQuotes: getSnapshot })
  if (!r.ok) st().notify(r.error, 'error')
  return r
}

// Close with the confirm setting honoured. `ask` is the confirm function (window.confirm in the app).
export function closeFromChart(id, ask = (m) => window.confirm(m)) {
  const p = st().positions.find((x) => x.id === id)
  if (!p) return { ok: false }
  if (st().chartSettings.trading.confirmClose && !ask(`Close ${p.side.toUpperCase()} ${p.lots} ${p.symbol}?`)) return { ok: false, cancelled: true }
  return st().closePosition(id, getSnapshot())
}

export function copyTicket(id) {
  try { navigator.clipboard?.writeText(String(id)); st().notify(`Copied ticket ${id}`, 'info') } catch { st().notify('Could not copy', 'error') }
}
