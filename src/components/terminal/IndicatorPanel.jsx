import { Eye, EyeOff, Trash2, Settings2, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INDICATOR_DEFS, INDICATOR_TYPES, MAX_INDICATORS, paramSummary } from '../../lib/terminal/indicators'

const PANEL = { backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }

// Popover: pick an indicator to add, see / hide / tune / remove the ones already on the chart.
export default function IndicatorPanel({ onClose }) {
  const indicators = useTerminalStore((s) => s.indicators)
  const add = useTerminalStore((s) => s.addIndicator)
  const upd = useTerminalStore((s) => s.updateIndicator)
  const st = useTerminalStore.getState
  const remove = useTerminalStore((s) => s.removeIndicator)
  const clear = useTerminalStore((s) => s.clearIndicators)

  return (
    <div className="absolute right-1 top-full z-50 mt-1 max-h-[70vh] w-[min(340px,calc(100vw-8px))] overflow-y-auto rounded-xl border shadow-2xl" style={PANEL} role="dialog" aria-label="Indicators">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-3 py-2" style={{ ...PANEL, borderColor: 'var(--tm-border)' }}>
        <span className="text-[12px] font-extrabold text-slate-100">Indicators <span className="font-semibold text-slate-400">{indicators.length}/{MAX_INDICATORS}</span></span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-300 hover:bg-white/10"><X size={14} /></button>
      </div>

      {indicators.length > 0 && (
        <div className="space-y-1.5 p-2">
          {indicators.map((ind) => {
            const def = INDICATOR_DEFS[ind.type]
                        return (
              <div key={ind.id} className="rounded-lg border" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)', opacity: ind.visible ? 1 : 0.55 }}>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ind.colors?.[def.lines[0].key] || def.lines.find((l) => l.kind !== 'hist').color }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-100">{def.name} <span className="font-semibold text-slate-400">{paramSummary(ind.type, ind.params)}</span></span>
                  <button type="button" title={ind.visible ? 'Hide' : 'Show'} onClick={() => upd(ind.id, { visible: !ind.visible })} className="flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-white/10">{ind.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" title="Up" aria-label="Move up" onClick={() => st().moveIndicator(ind.id, -1)} className="flex h-8 w-6 items-center justify-center rounded text-slate-300 hover:bg-white/10"><ChevronUp size={13} /></button>
                  <button type="button" title="Down" aria-label="Move down" onClick={() => st().moveIndicator(ind.id, 1)} className="flex h-8 w-6 items-center justify-center rounded text-slate-300 hover:bg-white/10"><ChevronDown size={13} /></button>
                  <button type="button" title="Settings" aria-label="Settings" onClick={() => st().setIndDialog(ind.id)} className="flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-white/10"><Settings2 size={14} /></button>
                  <button type="button" title="Remove" onClick={() => remove(ind.id)} className="flex h-8 w-8 items-center justify-center rounded text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
          <button type="button" onClick={clear} className="w-full rounded py-1 text-[11px] font-semibold text-slate-400 hover:bg-white/5">Remove all</button>
        </div>
      )}

      <div className="border-t p-2" style={{ borderColor: 'var(--tm-border)' }}>
        {['overlay', 'pane'].map((where) => (
          <div key={where} className="mb-1.5">
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{where === 'overlay' ? 'On the price chart' : 'In their own pane'}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {INDICATOR_TYPES.filter((t) => INDICATOR_DEFS[t].where === where).map((t) => (
                <button key={t} type="button" onClick={() => { const id = add(t); if (id) st().setIndDialog(id) }} title={INDICATOR_DEFS[t].long}
                  className="flex min-h-9 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left text-[12px] font-bold text-slate-200 hover:bg-white/5" style={{ borderColor: 'var(--tm-border)' }}>
                  <span className="truncate">{INDICATOR_DEFS[t].name}</span><Plus size={13} className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="px-1 pt-1 text-[10px] leading-snug text-slate-500">Saved on this device. VWAP uses tick volume of the simulated feed. Pivots use the previous day (previous week on 1D).</p>
      </div>
    </div>
  )
}
