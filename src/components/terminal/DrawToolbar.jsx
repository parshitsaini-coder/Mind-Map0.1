import { MousePointer2, TrendingUp, MoveUpRight, Minus, GripVertical, Square, Waypoints, Columns2, Type, Ruler, Trash2, Eye, EyeOff, Pin } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { DRAW_ORDER, DRAW_TYPES } from '../../lib/terminal/drawings'

const ICON = { trend: TrendingUp, ray: MoveUpRight, hline: Minus, vline: GripVertical, rect: Square, fib: Waypoints, channel: Columns2, text: Type, measure: Ruler }

// A horizontal strip of drawing tools (scrolls sideways on a phone).
export default function DrawToolbar({ symbol }) {
  const tool = useTerminalStore((s) => s.drawTool)
  const sticky = useTerminalStore((s) => s.drawSticky)
  const hidden = useTerminalStore((s) => s.drawHidden)
  const count = useTerminalStore((s) => (s.drawings[symbol] || []).length)
  const st = useTerminalStore.getState
  const btn = (active) => ({ backgroundColor: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#cbd5e1' })

  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }} role="toolbar" aria-label="Drawing tools">
      <button type="button" title="Select / move (Esc)" aria-pressed={tool === 'cursor'} onClick={() => st().setDrawTool('cursor')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(tool === 'cursor')}><MousePointer2 size={15} /></button>
      <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />
      {DRAW_ORDER.map((t) => {
        const Icon = ICON[t]
        return (
          <button key={t} type="button" title={DRAW_TYPES[t].name} aria-label={DRAW_TYPES[t].name} aria-pressed={tool === t} onClick={() => st().setDrawTool(tool === t ? 'cursor' : t)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(tool === t)}><Icon size={15} /></button>
        )
      })}
      <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />
      <button type="button" title="Keep the tool after each drawing" aria-pressed={sticky} onClick={() => st().setDrawSticky(!sticky)} className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold" style={btn(sticky)}><Pin size={13} /> Keep</button>
      <button type="button" title={hidden ? 'Show drawings' : 'Hide drawings'} aria-pressed={hidden} onClick={() => st().setDrawHidden(!hidden)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(hidden)}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      <button type="button" title="Delete all drawings on this symbol" disabled={!count}
        onClick={() => { if (window.confirm(`Delete all ${count} drawing(s) on ${symbol}?`)) st().clearDrawings(symbol) }}
        className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold text-red-400 disabled:opacity-30"><Trash2 size={13} /> Clear{count ? ` (${count})` : ''}</button>
    </div>
  )
}
