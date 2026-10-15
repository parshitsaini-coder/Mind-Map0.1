// Chart-side modify helpers shared by the drag handler, the +SL/+TP place mode and the quick bracket:
// ONE modify call, a toast that says what changed (with Undo), and an undo stack for Ctrl+Z.
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { createUndo } from '../../lib/terminal/chartOrders'

export const modifyUndo = createUndo()
let seq = 0 // unique entry ids even when two changes land in the same millisecond

const NAME = { sl: 'SL', tp: 'TP', price: 'Order price', limitPrice: 'Limit price' }
const fmt = (symbol, n) => (n == null ? 'none' : Number(n).toLocaleString('en-US', { minimumFractionDigits: INSTRUMENTS[symbol].digits, maximumFractionDigits: INSTRUMENTS[symbol].digits }))

// target: 'position' | 'order'.  patch: e.g. { sl: 1.0840 } or { sl, tp } (a bracket).
export function commitPatch(target, id, patch) {
  const s = useTerminalStore.getState()
  const item = (target === 'position' ? s.positions : s.orders).find((x) => x.id === id)
  if (!item) return { ok: false, error: 'Not found' }
  const prev = {}
  for (const k of Object.keys(patch)) prev[k] = item[k] ?? null
  const r = target === 'position' ? s.modifyPosition(id, patch, getSnapshot()) : s.modifyOrder(id, patch, getSnapshot())
  if (!r.ok) { s.notify(r.error || 'Could not change that', 'error'); return r }
  const keys = Object.keys(patch)
  const text = keys.length === 1
    ? `${NAME[keys[0]]} ${prev[keys[0]] == null ? 'set at' : 'moved to'} ${fmt(item.symbol, patch[keys[0]])}`
    : `${keys.map((k) => NAME[k]).join(' + ')} set`
  const entry = { id: `${target}:${id}:${++seq}`, target, itemId: id, prev, text }
  modifyUndo.push(entry)
  s.notify(text, 'info', { label: 'Undo', run: () => undoEntry(entry) })
  return r
}

function undoEntry(e) {
  modifyUndo.drop(e.id)
  const s = useTerminalStore.getState()
  const r = e.target === 'position' ? s.modifyPosition(e.itemId, e.prev, getSnapshot()) : s.modifyOrder(e.itemId, e.prev, getSnapshot())
  s.notify(r.ok ? `Undone: ${e.text}` : `Cannot undo: ${r.error}`, r.ok ? 'info' : 'error')
  return r.ok
}

// Ctrl+Z — the most recent chart modification (skips entries whose position / order is gone).
export function undoLast() {
  const s = useTerminalStore.getState()
  for (;;) {
    const e = modifyUndo.pop()
    if (!e) return false
    const live = (e.target === 'position' ? s.positions : s.orders).some((x) => x.id === e.itemId)
    if (live) return undoEntry(e)
  }
}

// Ctrl+Z / Ctrl+Y for everything on the chart: whichever of "last drawing edit" and "last SL/TP
// change" happened more recently is undone first. Redo only covers drawings.
export function undoAny() {
  const s = useTerminalStore.getState()
  const d = s.drawHist.past[s.drawHist.past.length - 1]
  const m = modifyUndo.peek()
  if (d && (!m || d.at >= m.at)) return s.undoDraw()
  if (m) return undoLast()
  return false
}
export function redoAny() {
  return useTerminalStore.getState().redoDraw()
}
