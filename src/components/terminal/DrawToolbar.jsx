import { useEffect, useRef, useState } from 'react'
import { MousePointer2, Trash2, Eye, EyeOff, Pin, Star, Magnet, ListTree } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import * as D from '../../lib/terminal/drawings'
import { iconOf } from './drawIcons'

const NEXT_MAGNET = { off: 'weak', weak: 'strong', strong: 'off' }
const GROUP_ICON = { Lines: 'trend', Fibonacci: 'fib', Shapes: 'rect', Annotation: 'text', 'Trading tools': 'long', Measure: 'prange' }

// Grouped drawing tools: one button per category (opens a flyout), starred tools pinned in the strip.
export default function DrawToolbar({ symbol }) {
  const tool = useTerminalStore((s) => s.drawTool)
  const sticky = useTerminalStore((s) => s.drawSticky)
  const hidden = useTerminalStore((s) => s.drawHidden)
  const magnet = useTerminalStore((s) => s.drawMagnet)
  const favs = useTerminalStore((s) => s.drawFavs)
  const tree = useTerminalStore((s) => s.drawTree)
  const count = useTerminalStore((s) => (s.drawings[symbol] || []).length)
  const st = useTerminalStore.getState
  const [fly, setFly] = useState(null) // { cat, x, y }
  const [last, setLast] = useState({}) // category -> last tool used
  const box = useRef(null)
  const btn = (active) => ({ backgroundColor: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#cbd5e1' })

  useEffect(() => {
    if (!fly) return undefined
    const off = (e) => { if (!e.target.closest?.('[data-flyout]')) setFly(null) }
    const esc = (e) => { if (e.key === 'Escape') setFly(null) }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc) }
  }, [fly])

  const pick = (t, cat) => { setLast((l) => ({ ...l, [cat]: t })); st().setDrawTool(tool === t ? 'cursor' : t); setFly(null) }
  const ToolBtn = ({ t, cat }) => {
    const Icon = iconOf(t, D.TOOLS[t])
    return <button type="button" title={D.TOOLS[t].name} aria-label={D.TOOLS[t].name} aria-pressed={tool === t} onClick={() => pick(t, cat)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(tool === t)}><Icon size={15} /></button>
  }
  const cats = D.CATEGORIES.filter((c) => D.DRAW_ORDER.some((t) => D.TOOLS[t].category === c && !D.TOOLS[t].hidden))

  return (
    <div ref={box} className="no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b px-2" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }} role="toolbar" aria-label="Drawing tools">
      <button type="button" title="Select / move (Esc)" aria-label="Select" aria-pressed={tool === 'cursor'} onClick={() => st().setDrawTool('cursor')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(tool === 'cursor')}><MousePointer2 size={15} /></button>
      <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />
      {cats.map((c) => {
        const shown = last[c] || GROUP_ICON[c]
        const Icon = iconOf(shown, D.TOOLS[shown])
        const inCat = D.DRAW_ORDER.filter((t) => D.TOOLS[t].category === c)
        const active = inCat.includes(tool)
        return (
          <button key={c} type="button" data-testid={`grp-${c}`} title={`${c} ▾`} aria-label={c} aria-expanded={fly?.cat === c} data-flyout
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFly(fly?.cat === c ? null : { cat: c, x: r.left, y: r.bottom + 2 }) }}
            className="flex h-8 shrink-0 items-center gap-0.5 rounded pl-2 pr-1" style={btn(active)}><Icon size={15} /><span className="text-[9px] opacity-70">▾</span></button>
        )
      })}
      {favs.length > 0 && <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />}
      {favs.filter((t) => D.TOOLS[t]).map((t) => <ToolBtn key={t} t={t} cat={D.TOOLS[t].category} />)}
      <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />
      <button type="button" data-testid="magnet-btn" title={`Magnet: ${magnet} — snaps points to open / high / low / close (click to change)`} aria-label={`Magnet ${magnet}`} onClick={() => st().setDrawMagnet(NEXT_MAGNET[magnet])} className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold" style={btn(magnet !== 'off')}><Magnet size={13} />{magnet === 'off' ? '' : magnet}</button>
      <button type="button" title="Keep the tool after each drawing" aria-pressed={sticky} onClick={() => st().setDrawSticky(!sticky)} className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold" style={btn(sticky)}><Pin size={13} /> Keep</button>
      <button type="button" title={hidden ? 'Show drawings' : 'Hide drawings'} aria-pressed={hidden} onClick={() => st().setDrawHidden(!hidden)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(hidden)}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      <button type="button" data-testid="tree-btn" title="Object tree" aria-label="Object tree" aria-pressed={tree} onClick={() => st().setDrawTree(!tree)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={btn(tree)}><ListTree size={15} /></button>
      <button type="button" title="Delete all drawings on this symbol" disabled={!count}
        onClick={() => { if (window.confirm(`Delete all ${count} drawing(s) on ${symbol}?`)) st().clearDrawings(symbol) }}
        className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold text-red-400 disabled:opacity-30"><Trash2 size={13} /> Clear{count ? ` (${count})` : ''}</button>
      {fly && (
        <div data-flyout role="menu" className="fixed z-[120] w-52 overflow-hidden rounded-lg border py-1 shadow-2xl" style={{ left: Math.min(fly.x, window.innerWidth - 216), top: fly.y, backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }}>
          {D.DRAW_ORDER.filter((t) => D.TOOLS[t].category === fly.cat).map((t) => {
            const Icon = iconOf(t, D.TOOLS[t])
            const fav = favs.includes(t)
            return (
              <div key={t} className="flex items-center hover:bg-white/10">
                <button type="button" role="menuitem" data-testid={`tool-${t}`} onClick={() => pick(t, fly.cat)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-slate-200"><Icon size={14} /> <span className="truncate">{D.TOOLS[t].name}</span></button>
                <button type="button" aria-label={fav ? `Unpin ${D.TOOLS[t].name}` : `Pin ${D.TOOLS[t].name}`} onClick={() => st().toggleDrawFav(t)} className="px-2.5 py-2" style={{ color: fav ? '#fbbf24' : '#64748b' }}><Star size={13} fill={fav ? 'currentColor' : 'none'} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
