import { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Settings2, X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import * as D from '../../lib/terminal/drawings'
import { iconOf } from './drawIcons'

const EMPTY = []
const B = 'flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10'

// Every drawing on this symbol, top layer first: show / hide, lock, rename, re-order, settings, delete.
export default function ObjectTree({ symbol }) {
  const open = useTerminalStore((s) => s.drawTree)
  const list = useTerminalStore((s) => s.drawings[symbol]) || EMPTY
  const sel = useTerminalStore((s) => s.drawSel)
  const [edit, setEdit] = useState(null)
  const st = useTerminalStore.getState
  if (!open) return null
  const rows = D.byZ(list).reverse()
  const allHidden = rows.length > 0 && rows.every((d) => d.hidden)
  const allLocked = rows.length > 0 && rows.every((d) => d.locked)
  return (
    <div className="absolute right-1 top-1 z-30 flex max-h-[70%] w-[min(260px,calc(100%-8px))] flex-col overflow-hidden rounded-xl border shadow-2xl" data-testid="object-tree" style={{ backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }}>
      <div className="flex items-center justify-between border-b px-2 py-1" style={{ borderColor: 'var(--tm-border)' }}>
        <span className="text-[12px] font-extrabold text-slate-100">Objects <span className="font-semibold text-slate-400">{rows.length}</span></span>
        <div className="flex">
          <button type="button" title={allHidden ? 'Show all' : 'Hide all'} aria-label="Hide all" data-testid="tree-hideall" disabled={!rows.length} onClick={() => st().setAllDrawings(symbol, { hidden: !allHidden })} className={`${B} text-slate-300 disabled:opacity-30`}>{allHidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          <button type="button" title={allLocked ? 'Unlock all' : 'Lock all'} aria-label="Lock all" data-testid="tree-lockall" disabled={!rows.length} onClick={() => st().setAllDrawings(symbol, { locked: !allLocked })} className={`${B} text-slate-300 disabled:opacity-30`}>{allLocked ? <Lock size={14} /> : <Unlock size={14} />}</button>
          <button type="button" title="Remove all" aria-label="Remove all" data-testid="tree-removeall" disabled={!rows.length} onClick={() => { if (window.confirm(`Delete all ${rows.length} drawing(s) on ${symbol}?`)) st().clearDrawings(symbol) }} className={`${B} text-red-400 disabled:opacity-30`}><Trash2 size={14} /></button>
          <button type="button" title="Close" aria-label="Close" onClick={() => st().setDrawTree(false)} className={`${B} text-slate-300`}><X size={14} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!rows.length && <p className="p-3 text-[11px] text-slate-400">No drawings on {symbol} yet.</p>}
        {rows.map((d) => {
          const Icon = iconOf(d.type, D.TOOLS[d.type])
          return (
            <div key={d.id} data-testid="tree-row" onClick={() => st().setDrawSel(d.id)} className="flex items-center gap-0.5 border-b px-1 py-0.5" style={{ borderColor: 'var(--tm-border)', backgroundColor: sel === d.id ? 'rgba(37,99,235,0.25)' : 'transparent', opacity: d.hidden ? 0.5 : 1 }}>
              <Icon size={13} className="mx-1 shrink-0" style={{ color: d.color }} />
              {edit?.id === d.id ? (
                <input autoFocus value={edit.v} maxLength={40} onChange={(e) => setEdit({ ...edit, v: e.target.value })} onBlur={() => { st().updateDrawing(symbol, d.id, { name: edit.v.trim() }); setEdit(null) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEdit(null) }} className="h-6 min-w-0 flex-1 rounded border bg-[var(--tm-bg)] px-1 text-[12px] text-white" style={{ borderColor: 'var(--tm-border2)' }} />
              ) : (
                <span onDoubleClick={() => setEdit({ id: d.id, v: d.name })} title="Double-click to rename" className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-200">{d.name || D.TOOLS[d.type].name}</span>
              )}
              <button type="button" title={d.hidden ? 'Show' : 'Hide'} aria-label={d.hidden ? 'Show' : 'Hide'} data-testid="row-eye" onClick={(e) => { e.stopPropagation(); st().updateDrawing(symbol, d.id, { hidden: !d.hidden }) }} className={`${B} text-slate-300`}>{d.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              <button type="button" title={d.locked ? 'Unlock' : 'Lock'} aria-label={d.locked ? 'Unlock' : 'Lock'} data-testid="row-lock" onClick={(e) => { e.stopPropagation(); st().updateDrawing(symbol, d.id, { locked: !d.locked }) }} className={B} style={{ color: d.locked ? '#fbbf24' : '#cbd5e1' }}>{d.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
              <button type="button" title="Up one layer" aria-label="Up" onClick={(e) => { e.stopPropagation(); st().reorderDrawing(symbol, d.id, 'up') }} className={`${B} text-slate-300`}><ChevronUp size={13} /></button>
              <button type="button" title="Down one layer" aria-label="Down" onClick={(e) => { e.stopPropagation(); st().reorderDrawing(symbol, d.id, 'down') }} className={`${B} text-slate-300`}><ChevronDown size={13} /></button>
              <button type="button" title="Settings" aria-label="Settings" onClick={(e) => { e.stopPropagation(); st().setDrawDialog(d.id) }} className={`${B} text-slate-300`}><Settings2 size={13} /></button>
              <button type="button" title="Delete" aria-label="Delete" data-testid="row-del" onClick={(e) => { e.stopPropagation(); st().removeDrawing(symbol, d.id) }} className={`${B} text-red-400`}><Trash2 size={13} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
