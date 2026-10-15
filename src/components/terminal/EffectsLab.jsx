import { useState } from 'react'
import { X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { EVENTS, CATEGORIES } from '../../lib/terminal/eventCatalog'
import { emitTerminalEvent } from '../../lib/terminal/effects'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { unlockAudio } from '../../lib/terminal/soundEngine'

// Dev playground: a button for every catalogue event, including the reserved ones. Opened with ?lab=1
// in a dev build, or by tapping the version line in Settings → Alerts five times.
export default function EffectsLab() {
  const open = useTerminalStore((s) => s.labOpen)
  const setOpen = useTerminalStore.getState().setLabOpen
  const [log, setLog] = useState([])
  if (!open) return null
  const sample = (id) => {
    const symbol = useTerminalStore.getState().symbol
    const q = getSnapshot()?.[symbol]
    const mid = q ? (q.bid + q.ask) / 2 : 1
    const sell = /sell|loss|sl\./.test(id)
    const pnl = /loss|sl\.|stopout/.test(id) ? -45 : /flat/.test(id) ? 0 : 90
    return { symbol, side: sell ? 'sell' : 'buy', lots: 0.1, price: mid, sl: mid * 0.995, tp: mid * 1.01, pnl, orderType: /triggered/.test(id) ? 'stop' : 'limit', slipPips: 0.4, distPips: 25, what: 'SL', from: mid * 0.99, to: mid * 0.995, marginLevel: 42, reason: 'Stop loss must be below the current price' }
  }
  const fire = (id) => { unlockAudio(); emitTerminalEvent({ id, data: sample(id) }); setLog((l) => [id, ...l].slice(0, 6)) }
  const burst = () => { unlockAudio(); ['order.buy.filled', 'position.tp.hit', 'account.stopout', 'order.modified'].forEach(fire) }
  return (
    <div data-testid="effects-lab" role="dialog" aria-label="Effects playground" className="absolute right-2 top-12 z-[60] max-h-[75%] w-[min(22rem,calc(100%-1rem))] overflow-y-auto rounded-lg border p-2 shadow-2xl"
      style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-[12px] font-bold">Effects playground</h2>
        <button type="button" aria-label="Close playground" onClick={() => setOpen(false)} className="tm-tap rounded p-1"><X size={14} /></button>
      </div>
      <button type="button" data-testid="lab-burst" onClick={burst} className="mb-2 h-8 w-full rounded border text-[11px] font-semibold" style={{ borderColor: 'var(--tm-border2)' }}>Burst: 4 events at once (one sound plays)</button>
      {CATEGORIES.map((c) => (
        <div key={c.id} className="pb-2">
          <div className="pb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--tm-muted)' }}>{c.label}</div>
          <div className="flex flex-wrap gap-1">
            {EVENTS.filter((e) => e.category === c.id).map((e) => (
              <button key={e.id} type="button" data-testid={`lab-${e.id}`} onClick={() => fire(e.id)} className="h-7 rounded border px-2 text-[10px] font-semibold" style={{ borderColor: 'var(--tm-border2)', opacity: e.live ? 1 : 0.7 }} title={e.live ? e.id : `${e.id} (reserved)`}>{e.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div data-testid="lab-log" className="text-[10px]" style={{ color: 'var(--tm-muted)' }}>{log.length ? `Last: ${log.join(' · ')}` : 'Nothing fired yet'}</div>
    </div>
  )
}
