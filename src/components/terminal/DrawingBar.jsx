import { useRef, useState } from 'react'
import { Lock, Unlock, Trash2, Copy, Eye, EyeOff, Settings2, ChevronsUp, ChevronsDown, PaintBucket, Pencil, ShoppingCart, Spline } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import * as D from '../../lib/terminal/drawings'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { INSTRUMENTS } from '../../lib/terminal/instruments'

const BTN = 'flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10'
const NEXT_LS = { solid: 'dashed', dashed: 'dotted', dotted: 'solid' }

// Order type a Long / Short drawing would be placed as, from where its entry sits against the live price.
export function orderTypeFor(d, quote, inst) {
  if (!quote) return 'market'
  const entry = d.points[0].p
  const tol = inst.pipSize * 0.5
  if (d.type === 'long') return Math.abs(entry - quote.ask) <= tol ? 'market' : entry < quote.ask ? 'limit' : 'stop'
  return Math.abs(entry - quote.bid) <= tol ? 'market' : entry > quote.bid ? 'limit' : 'stop'
}

// The floating toolbar over the selected drawing. Every control edits the drawing immediately.
export default function DrawingBar({ d, symbol, onEditText, getTimeMap }) {
  const st = useTerminalStore.getState
  const [pal, setPal] = useState(false)
  const burst = useRef(0)
  const spec = D.TOOLS[d.type]
  const edit = (patch) => { // a run of quick changes (colour picker drag) is ONE undo step
    const now = Date.now()
    const first = now - burst.current > 1000
    burst.current = now
    st().updateDrawing(symbol, d.id, patch, { hist: first })
  }
  const hasFill = !!spec?.style && 'fill' in spec.style
  const place = () => {
    const inst = INSTRUMENTS[symbol]
    const q = getSnapshot()[symbol]
    const type = orderTypeFor(d, q, inst)
    st().prefillTicket({ type, side: d.type === 'long' ? 'buy' : 'sell', price: d.points[0].p, sl: d.points[2].p, tp: d.points[3].p })
    st().notify(`${d.type === 'long' ? 'Buy' : 'Sell'} ${type === 'market' ? 'market' : type} ticket filled from your drawing — check it and press ${d.type === 'long' ? 'Buy' : 'Sell'}`, 'info')
  }
  const ls = d.style.lineStyle
  return (
    <div className="absolute left-1/2 top-2 z-20 max-w-[96%] -translate-x-1/2" data-testid="draw-bar">
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border px-1 py-1 shadow-xl" style={{ backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }}>
        <button type="button" title="Colour" aria-label="Colour" onClick={() => setPal(!pal)} className={BTN}><span className="h-4 w-4 rounded-full border border-white/60" style={{ backgroundColor: d.color }} /></button>
        <select aria-label="Line width" title="Line width" value={d.width} onChange={(e) => edit({ width: +e.target.value })} className="h-7 shrink-0 rounded border bg-transparent px-1 text-[11px] font-bold text-slate-200" style={{ borderColor: 'var(--tm-border)' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w} className="bg-slate-900">{w}px</option>)}
        </select>
        <button type="button" title={`Line style: ${ls} (click to change)`} aria-label="Line style" onClick={() => edit({ style: { ...d.style, lineStyle: NEXT_LS[ls] } })} className={BTN} style={{ color: ls === 'solid' ? '#cbd5e1' : '#60a5fa' }}><Spline size={14} /></button>
        {hasFill && <button type="button" title="Fill" aria-label="Fill" aria-pressed={d.style.fill} onClick={() => edit({ style: { ...d.style, fill: !d.style.fill } })} className={BTN} style={{ color: d.style.fill ? '#60a5fa' : '#cbd5e1' }}><PaintBucket size={14} /></button>}
        {(d.type === 'text' || d.type === 'callout') && <button type="button" title="Edit text" aria-label="Edit text" onClick={onEditText} className={`${BTN} text-slate-200`}><Pencil size={14} /></button>}
        {spec?.position && <button type="button" title="Place this order — fills the order ticket with entry, stop and target" aria-label="Place this order" onClick={place} className="flex h-7 shrink-0 items-center gap-1 rounded bg-blue-600 px-2 text-[11px] font-bold text-white hover:bg-blue-500"><ShoppingCart size={13} /> Place order</button>}
        <div className="mx-0.5 h-5 w-px shrink-0 bg-white/15" />
        <button type="button" title="Bring to front" aria-label="Bring to front" onClick={() => st().reorderDrawing(symbol, d.id, 'front')} className={`${BTN} text-slate-200`}><ChevronsUp size={14} /></button>
        <button type="button" title="Send to back" aria-label="Send to back" onClick={() => st().reorderDrawing(symbol, d.id, 'back')} className={`${BTN} text-slate-200`}><ChevronsDown size={14} /></button>
        <button type="button" title="Clone (Ctrl+D)" aria-label="Clone" onClick={() => st().duplicateDrawing(symbol, d.id, getTimeMap())} className={`${BTN} text-slate-200`}><Copy size={14} /></button>
        <button type="button" title={d.locked ? 'Unlock' : 'Lock (cannot be moved)'} aria-label={d.locked ? 'Unlock' : 'Lock'} onClick={() => edit({ locked: !d.locked })} className={BTN} style={{ color: d.locked ? '#fbbf24' : '#cbd5e1' }}>{d.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
        <button type="button" title="Hide (bring back from the object tree)" aria-label="Hide" onClick={() => { edit({ hidden: true }); st().setDrawSel(null) }} className={`${BTN} text-slate-200`}>{d.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        <button type="button" title="Settings…" aria-label="Settings" onClick={() => st().setDrawDialog(d.id)} className={`${BTN} text-slate-200`}><Settings2 size={14} /></button>
        <button type="button" title="Delete (Del)" aria-label="Delete" onClick={() => st().removeDrawing(symbol, d.id)} className={`${BTN} text-red-400 hover:bg-red-500/20`}><Trash2 size={14} /></button>
      </div>
      {pal && (
        <div className="mt-1 flex items-center gap-1 rounded-lg border p-1.5 shadow-xl" style={{ backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }}>
          {D.DRAW_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => { edit({ color: c }); setPal(false) }} className="h-6 w-6 shrink-0 rounded-full border-2" style={{ backgroundColor: c, borderColor: d.color === c ? '#fff' : 'transparent' }} />
          ))}
          <input type="color" aria-label="Custom colour" value={d.color} onChange={(e) => edit({ color: e.target.value })} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        </div>
      )}
    </div>
  )
}
