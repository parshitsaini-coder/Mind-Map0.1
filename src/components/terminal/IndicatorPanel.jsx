import { useState } from 'react'
import { Eye, EyeOff, Trash2, Settings2, Plus, X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INDICATOR_DEFS, INDICATOR_TYPES, MAX_INDICATORS, paramSummary } from '../../lib/terminal/indicators'

const PANEL = { backgroundColor: '#1a222c', borderColor: '#334155' }

function ParamEditor({ ind }) {
  const def = INDICATOR_DEFS[ind.type]
  const upd = useTerminalStore((s) => s.updateIndicator)
  return (
    <div className="space-y-2 border-t px-2.5 pb-2.5 pt-2" style={{ borderColor: '#27313d' }}>
      {def.params.map((p) => (
        <label key={p.key} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
          {p.label}
          {p.options ? (
            <select value={ind.params[p.key]} onChange={(e) => upd(ind.id, { params: { [p.key]: e.target.value } })} className="h-8 rounded border bg-[#0f1419] px-2 text-[12px] text-white" style={{ borderColor: '#334155' }}>
              {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type="number" inputMode="decimal" min={p.min} max={p.max} step={p.step}
              value={ind.params[p.key]}
              onChange={(e) => { if (e.target.value !== '') upd(ind.id, { params: { [p.key]: e.target.value } }) }}
              className="h-8 w-20 rounded border bg-[#0f1419] px-2 text-right text-[12px] tabular-nums text-white" style={{ borderColor: '#334155' }}
            />
          )}
        </label>
      ))}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
        {def.lines.filter((l) => l.kind !== 'hist').map((l) => (
          <label key={l.key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <input type="color" value={ind.colors?.[l.key] || l.color} onChange={(e) => upd(ind.id, { colors: { [l.key]: e.target.value } })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
            {l.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// Popover: pick an indicator to add, see / hide / tune / remove the ones already on the chart.
export default function IndicatorPanel({ onClose }) {
  const indicators = useTerminalStore((s) => s.indicators)
  const add = useTerminalStore((s) => s.addIndicator)
  const upd = useTerminalStore((s) => s.updateIndicator)
  const remove = useTerminalStore((s) => s.removeIndicator)
  const clear = useTerminalStore((s) => s.clearIndicators)
  const [open, setOpen] = useState(null)

  return (
    <div className="absolute right-1 top-full z-50 mt-1 max-h-[70vh] w-[min(340px,calc(100vw-8px))] overflow-y-auto rounded-xl border shadow-2xl" style={PANEL} role="dialog" aria-label="Indicators">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b px-3 py-2" style={{ ...PANEL, borderColor: '#27313d' }}>
        <span className="text-[12px] font-extrabold text-slate-100">Indicators <span className="font-semibold text-slate-400">{indicators.length}/{MAX_INDICATORS}</span></span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-300 hover:bg-white/10"><X size={14} /></button>
      </div>

      {indicators.length > 0 && (
        <div className="space-y-1.5 p-2">
          {indicators.map((ind) => {
            const def = INDICATOR_DEFS[ind.type]
            const isOpen = open === ind.id
            return (
              <div key={ind.id} className="rounded-lg border" style={{ borderColor: '#27313d', backgroundColor: '#131a22', opacity: ind.visible ? 1 : 0.55 }}>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ind.colors?.[def.lines[0].key] || def.lines.find((l) => l.kind !== 'hist').color }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-100">{def.name} <span className="font-semibold text-slate-400">{paramSummary(ind.type, ind.params)}</span></span>
                  <button type="button" title={ind.visible ? 'Hide' : 'Show'} onClick={() => upd(ind.id, { visible: !ind.visible })} className="flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-white/10">{ind.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" title="Settings" onClick={() => setOpen(isOpen ? null : ind.id)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10" style={{ color: isOpen ? '#60a5fa' : '#cbd5e1' }}><Settings2 size={14} /></button>
                  <button type="button" title="Remove" onClick={() => remove(ind.id)} className="flex h-8 w-8 items-center justify-center rounded text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                </div>
                {isOpen && <ParamEditor ind={ind} />}
              </div>
            )
          })}
          <button type="button" onClick={clear} className="w-full rounded py-1 text-[11px] font-semibold text-slate-400 hover:bg-white/5">Remove all</button>
        </div>
      )}

      <div className="border-t p-2" style={{ borderColor: '#27313d' }}>
        {['overlay', 'pane'].map((where) => (
          <div key={where} className="mb-1.5">
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{where === 'overlay' ? 'On the price chart' : 'In their own pane'}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {INDICATOR_TYPES.filter((t) => INDICATOR_DEFS[t].where === where).map((t) => (
                <button key={t} type="button" onClick={() => { const id = add(t); if (id) setOpen(id) }} title={INDICATOR_DEFS[t].long}
                  className="flex min-h-9 items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-left text-[12px] font-bold text-slate-200 hover:bg-white/5" style={{ borderColor: '#27313d' }}>
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
