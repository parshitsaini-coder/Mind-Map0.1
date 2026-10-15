import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INDICATOR_DEFS } from '../../lib/terminal/indicators'
import { TIMEFRAMES } from '../../lib/terminal/instruments'

const BORDER = { borderColor: 'var(--tm-border2)' }
const IN = 'h-8 rounded border bg-[var(--tm-bg)] px-2 text-[12px] text-white'
const Row = ({ label, children }) => <label className="flex items-center justify-between gap-3 py-1.5 text-[12px] text-slate-300"><span>{label}</span><span className="flex items-center gap-2">{children}</span></label>

function Body({ id }) {
  const st = useTerminalStore.getState
  const ind = useTerminalStore((s) => s.indicators.find((i) => i.id === id))
  const orig = useRef(null)
  const [tab, setTab] = useState('inputs')
  useEffect(() => { orig.current = JSON.parse(JSON.stringify(st().indicators.find((i) => i.id === id) || null)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ind) return null
  const def = INDICATOR_DEFS[ind.type]
  const upd = (patch) => st().updateIndicator(id, patch)
  const close = () => st().setIndDialog(null)
  const cancel = () => { if (orig.current) st().replaceIndicator(orig.current); close() }
  const tfs = TIMEFRAMES.map((t) => t.id)
  const tabs = [['inputs', 'Inputs'], ['style', 'Style'], ['vis', 'Visibility']]
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-label={`${def.name} settings`} data-testid="ind-dialog" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}>
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-[420px] sm:rounded-2xl" style={{ backgroundColor: 'var(--tm-panel2)', ...BORDER }}>
        <div className="flex items-center justify-between border-b px-3 py-2" style={BORDER}>
          <span className="text-[13px] font-extrabold text-slate-100">{def.long}</span>
          <button type="button" aria-label="Close" onClick={cancel} className="rounded p-1 text-slate-300 hover:bg-white/10"><X size={15} /></button>
        </div>
        <div className="flex border-b px-2" style={BORDER}>
          {tabs.map(([k, n]) => <button key={k} type="button" data-testid={`itab-${k}`} onClick={() => setTab(k)} className="border-b-2 px-3 py-2 text-[12px] font-bold" style={{ borderColor: tab === k ? '#3b82f6' : 'transparent', color: tab === k ? '#fff' : '#94a3b8' }}>{n}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {tab === 'inputs' && (def.params.length === 0 ? <p className="py-2 text-[12px] text-slate-400">This indicator has no inputs.</p> : def.params.map((p) => (
            <Row key={p.key} label={p.label}>
              {p.options
                ? <select data-testid={`ip-${p.key}`} value={ind.params[p.key]} onChange={(e) => upd({ params: { [p.key]: e.target.value } })} className={IN} style={BORDER}>{p.options.map((o) => <option key={o}>{o}</option>)}</select>
                : <input data-testid={`ip-${p.key}`} type="number" inputMode="decimal" min={p.min} max={p.max} step={p.step} value={ind.params[p.key]} onChange={(e) => e.target.value !== '' && upd({ params: { [p.key]: e.target.value } })} className={`${IN} w-24 text-right`} style={BORDER} />}
            </Row>
          )))}
          {tab === 'style' && (
            <>
              {def.lines.map((ln) => {
                const ls = ind.styles?.[ln.key] || { width: ln.width || 1, lineStyle: ln.dash ? 'dashed' : 'solid', hidden: false }
                return (
                  <div key={ln.key} className="border-b py-2" style={{ borderColor: 'var(--tm-border)' }}>
                    <div className="flex items-center justify-between text-[12px] font-bold text-slate-200">
                      <span>{ln.label}</span>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><input type="checkbox" data-testid={`is-show-${ln.key}`} checked={!ls.hidden} onChange={(e) => upd({ styles: { [ln.key]: { hidden: !e.target.checked } } })} className="h-4 w-4 accent-blue-500" /> Visible</label>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {ln.kind !== 'hist' && <input type="color" aria-label={`${ln.label} colour`} data-testid={`is-color-${ln.key}`} value={ind.colors?.[ln.key] || ln.color} onChange={(e) => upd({ colors: { [ln.key]: e.target.value } })} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />}
                      {ln.kind !== 'hist' && <select aria-label={`${ln.label} width`} data-testid={`is-width-${ln.key}`} value={ls.width} onChange={(e) => upd({ styles: { [ln.key]: { width: +e.target.value } } })} className={IN} style={BORDER}>{[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}px</option>)}</select>}
                      {ln.kind !== 'hist' && <select aria-label={`${ln.label} style`} data-testid={`is-ls-${ln.key}`} value={ls.lineStyle} onChange={(e) => upd({ styles: { [ln.key]: { lineStyle: e.target.value } } })} className={IN} style={BORDER}>{['solid', 'dashed', 'dotted'].map((x) => <option key={x}>{x}</option>)}</select>}
                      {ln.kind === 'hist' && <span className="text-[11px] text-slate-400">Colours follow the bar / momentum direction.</span>}
                    </div>
                  </div>
                )
              })}
              {def.where === 'pane' && (
                <>
                  <Row label="Pane height"><select data-testid="is-panesize" value={ind.paneSize} onChange={(e) => upd({ paneSize: +e.target.value })} className={IN} style={BORDER}><option value={0.5}>Small</option><option value={1}>Normal</option><option value={2}>Large</option></select></Row>
                  <Row label="Collapse pane"><input type="checkbox" data-testid="is-collapsed" checked={ind.collapsed} onChange={(e) => upd({ collapsed: e.target.checked })} className="h-4 w-4 accent-blue-500" /></Row>
                </>
              )}
            </>
          )}
          {tab === 'vis' && (
            <>
              <p className="pb-1 text-[11px] text-slate-400">Show on timeframes from … to …</p>
              <Row label="From"><select data-testid="iv-min" value={ind.visibility.tfMin} onChange={(e) => upd({ visibility: { tfMin: e.target.value, ...(tfs.indexOf(e.target.value) > tfs.indexOf(ind.visibility.tfMax) ? { tfMax: e.target.value } : {}) } })} className={IN} style={BORDER}>{tfs.map((t) => <option key={t}>{t}</option>)}</select></Row>
              <Row label="To"><select data-testid="iv-max" value={ind.visibility.tfMax} onChange={(e) => upd({ visibility: { tfMax: e.target.value, ...(tfs.indexOf(e.target.value) < tfs.indexOf(ind.visibility.tfMin) ? { tfMin: e.target.value } : {}) } })} className={IN} style={BORDER}>{tfs.map((t) => <option key={t}>{t}</option>)}</select></Row>
              <Row label="Visible"><input type="checkbox" data-testid="iv-visible" checked={ind.visible} onChange={(e) => upd({ visible: e.target.checked })} className="h-4 w-4 accent-blue-500" /></Row>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-3 py-2" style={BORDER}>
          <button type="button" data-testid="idlg-cancel" onClick={cancel} className="rounded border px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/5" style={BORDER}>Cancel</button>
          <button type="button" data-testid="idlg-ok" onClick={close} className="rounded bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-500">Ok</button>
        </div>
      </div>
    </div>
  )
}

export default function IndicatorDialog() {
  const id = useTerminalStore((s) => s.indDialog)
  const exists = useTerminalStore((s) => !!id && s.indicators.some((i) => i.id === id))
  if (!exists || typeof document === 'undefined') return null
  return createPortal(<Body key={id} id={id} />, document.querySelector('.tm-root') || document.body)
}
