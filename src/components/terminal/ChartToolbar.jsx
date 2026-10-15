import { MousePointer2, Minus, SeparatorVertical, TrendingUp, ArrowUpRight, Square, AlignJustify, Columns2, Type, Ruler, Lock, LockOpen, Trash2, Activity, LayoutGrid } from 'lucide-react'
import { useChartToolsStore } from '../../store/chartToolsStore'
import { COLORS, TOOLS } from '../../lib/terminal/drawings'

const ICONS = { hline: Minus, vline: SeparatorVertical, trend: TrendingUp, ray: ArrowUpRight, rect: Square, fib: AlignJustify, channel: Columns2, text: Type, measure: Ruler }
const btn = (on) => ({ backgroundColor: on ? '#334155' : 'transparent', color: on ? '#fff' : '#9aa4b2' })

// Row of chart tools: indicators · drawing tools · edit the selected drawing · layouts.
export default function ChartToolbar({ symbol, onOpenIndicators, desktop }) {
  const tool = useChartToolsStore((s) => s.tool)
  const setTool = useChartToolsStore((s) => s.setTool)
  const indicatorCount = useChartToolsStore((s) => s.indicators.length)
  const layout = useChartToolsStore((s) => s.layout)
  const setLayout = useChartToolsStore((s) => s.setLayout)
  const drawColor = useChartToolsStore((s) => s.drawColor)
  const setDrawColor = useChartToolsStore((s) => s.setDrawColor)
  const selectedId = useChartToolsStore((s) => s.selectedId)
  const all = useChartToolsStore((s) => s.drawings)
  const list = all[symbol]
  const update = useChartToolsStore((s) => s.updateDrawing)
  const remove = useChartToolsStore((s) => s.removeDrawing)
  const clearAll = useChartToolsStore((s) => s.clearDrawings)
  let sel = null
  let selSym = symbol
  if (selectedId) {
    for (const [sym, arr] of Object.entries(all)) {
      const f = arr.find((d) => d.id === selectedId)
      if (f) { sel = f; selSym = sym; break }
    }
  }
  const count = (list || []).length

  return (
    <div className="no-scrollbar flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-2" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
      <button type="button" onClick={onOpenIndicators} className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold" style={btn(indicatorCount > 0)}>
        <Activity size={13} /> Indicators{indicatorCount > 0 && <span className="rounded bg-sky-600 px-1 text-[9px] text-white">{indicatorCount}</span>}
      </button>
      <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
      <button type="button" title="Select / move (Esc)" aria-label="Select" onClick={() => setTool('cursor')} className="shrink-0 rounded p-1.5" style={btn(tool === 'cursor')}>
        <MousePointer2 size={14} />
      </button>
      {Object.keys(TOOLS).map((id) => {
        const Icon = ICONS[id]
        return (
          <button key={id} type="button" title={TOOLS[id].label} aria-label={TOOLS[id].label} onClick={() => setTool(tool === id ? 'cursor' : id)} className="shrink-0 rounded p-1.5" style={btn(tool === id)}>
            <Icon size={14} />
          </button>
        )
      })}

      <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
      {sel ? (
        <>
          <span className="shrink-0 pr-1 text-[10px] text-slate-400">{TOOLS[sel.type]?.label}</span>
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} disabled={sel.locked} onClick={() => update(selSym, sel.id, { color: c })} className="h-4 w-4 shrink-0 rounded-full border-2 disabled:opacity-40" style={{ backgroundColor: c, borderColor: sel.color === c ? '#fff' : 'transparent' }} />
          ))}
          <button type="button" aria-label="Line width" disabled={sel.locked} onClick={() => update(selSym, sel.id, { width: (sel.width % 4) + 1 })} className="shrink-0 rounded px-1.5 py-1 text-[10px] font-bold text-slate-300 disabled:opacity-40">{sel.width}px</button>
          <button type="button" aria-label={sel.locked ? 'Unlock' : 'Lock'} title={sel.locked ? 'Unlock' : 'Lock'} onClick={() => update(selSym, sel.id, { locked: !sel.locked })} className="shrink-0 rounded p-1.5" style={btn(sel.locked)}>
            {sel.locked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
          <button type="button" aria-label="Delete drawing" title="Delete (Del)" disabled={sel.locked} onClick={() => remove(selSym, sel.id)} className="shrink-0 rounded p-1.5 text-red-400 hover:bg-white/10 disabled:opacity-40">
            <Trash2 size={14} />
          </button>
        </>
      ) : (
        <>
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`New drawings: colour ${c}`} onClick={() => setDrawColor(c)} className="h-4 w-4 shrink-0 rounded-full border-2" style={{ backgroundColor: c, borderColor: drawColor === c ? '#fff' : 'transparent' }} />
          ))}
          {count > 0 && (
            <button type="button" onClick={() => window.confirm(`Delete all ${count} drawings on ${symbol}?`) && clearAll(symbol)} className="shrink-0 rounded px-1.5 py-1 text-[10px] text-slate-400 hover:text-white">
              Clear {count}
            </button>
          )}
        </>
      )}

      {desktop && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-3">
          <LayoutGrid size={12} className="mr-1 text-slate-400" />
          {[1, 2, 4].map((n) => (
            <button key={n} type="button" title={`${n} chart${n > 1 ? 's' : ''}`} onClick={() => setLayout(n)} className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold" style={btn(layout === n)}>{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}
