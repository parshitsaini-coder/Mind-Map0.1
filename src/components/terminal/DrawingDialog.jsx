import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2, Plus } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import * as D from '../../lib/terminal/drawings'
import { TZ } from './chartConst'

const BORDER = { borderColor: 'var(--tm-border2)' }
const IN = 'h-8 rounded border bg-[var(--tm-bg)] px-2 text-[12px] text-white'
const TAB_NAME = { style: 'Style', text: 'Text', levels: 'Levels', coords: 'Coordinates', vis: 'Visibility' }
const STAT_TOOLS = ['trend', 'ray', 'extline', 'arrow', 'prange', 'drange', 'dprange']
const LABEL_TOOLS = ['hline', 'hray', 'fib', 'fibext', 'long', 'short']
const ARROW_TOOLS = ['trend', 'arrow', 'hray', 'extline', 'ray']

const Row = ({ label, children }) => (
  <label className="flex items-center justify-between gap-3 py-1.5 text-[12px] text-slate-300"><span>{label}</span><span className="flex items-center gap-2">{children}</span></label>
)
const Check = ({ label, value, onChange, testid }) => (
  <Row label={label}><input type="checkbox" data-testid={testid} checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-500" /></Row>
)

function CoordRow({ d, idx, inst, onSet }) {
  const f = D.editableFields(d, idx)
  const q = d.points[idx]
  const [price, setPrice] = useState(String(q.p))
  const [time, setTime] = useState(D.fmtDT(q.t, TZ))
  const [bad, setBad] = useState({ p: false, t: false })
  useEffect(() => { setPrice(Number(q.p.toFixed(inst.digits)).toString()); setTime(D.fmtDT(q.t, TZ)) }, [q.p, q.t, inst.digits])
  const commitP = () => { const v = parseFloat(price); const ok = Number.isFinite(v) && v > 0; setBad((b) => ({ ...b, p: !ok })); if (ok) onSet(idx, { p: v }) }
  const commitT = () => { const v = D.parseDT(time, TZ); setBad((b) => ({ ...b, t: v == null })); if (v != null) onSet(idx, { t: v }) }
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 text-[12px] text-slate-300">
      <span className="w-20 shrink-0 font-semibold">{D.pointName(d, idx)}</span>
      <input aria-label={`${D.pointName(d, idx)} price`} inputMode="decimal" disabled={!f.p} value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commitP} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${IN} w-28 disabled:opacity-40`} style={{ borderColor: bad.p ? '#ef4444' : BORDER.borderColor }} />
      <input aria-label={`${D.pointName(d, idx)} time`} disabled={!f.t} value={time} onChange={(e) => setTime(e.target.value)} onBlur={commitT} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${IN} w-40 disabled:opacity-40`} style={{ borderColor: bad.t ? '#ef4444' : BORDER.borderColor }} placeholder="YYYY-MM-DD HH:MM" />
    </div>
  )
}

function Body({ id, symbol, timeMapRef }) {
  const st = useTerminalStore.getState
  const d = useTerminalStore((s) => (s.drawings[symbol] || []).find((x) => x.id === id))
  const templates = useTerminalStore((s) => (d ? s.drawTemplates[d.type] : null)) || []
  const defaults = useTerminalStore((s) => (d ? s.drawDefaults[d.type] : null))
  const orig = useRef(null)
  const [tab, setTab] = useState('style')
  const [tplMenu, setTplMenu] = useState(false)
  const inst = INSTRUMENTS[symbol]
  useEffect(() => {
    const cur = (st().drawings[symbol] || []).find((x) => x.id === id)
    orig.current = cur ? JSON.parse(JSON.stringify(cur)) : null
    st().pushDrawHist() // the whole dialog is ONE undo step
  }, [id, symbol]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null
  const spec = D.TOOLS[d.type]
  const tabs = spec.tabs.length ? spec.tabs : ['style']
  const cur = tabs.includes(tab) ? tab : tabs[0]
  const apply = (patch) => st().updateDrawing(symbol, id, patch, { hist: false })
  const setStyle = (k, v) => apply({ style: { ...d.style, [k]: v } })
  const setText = (k, v) => apply({ textStyle: { ...d.textStyle, [k]: v } })
  const close = () => st().setDrawDialog(null)
  const cancel = () => { if (orig.current) st().replaceDrawing(symbol, orig.current); st().dropDrawHist(); close() }
  const hasFill = !!spec.style && 'fill' in spec.style
  const setLevel = (i, patch) => apply({ levels: d.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const vis = d.visibility
  const tfs = TIMEFRAMES.map((t) => t.id)
  const setVis = (k, v) => {
    let { tfMin, tfMax } = { ...vis, [k]: v }
    if (tfs.indexOf(tfMin) > tfs.indexOf(tfMax)) { if (k === 'tfMin') tfMax = tfMin; else tfMin = tfMax }
    apply({ visibility: { tfMin, tfMax } })
  }
  const saveTpl = () => { const n = window.prompt('Template name'); if (n && st().saveDrawTemplate(d.type, n, d)) st().notify(`Template “${n.trim()}” saved`, 'info') }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-label={`${spec.name} settings`} data-testid="draw-dialog" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}>
      <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-[460px] sm:rounded-2xl" style={{ backgroundColor: 'var(--tm-panel2)', ...BORDER }}>
        <div className="flex items-center justify-between border-b px-3 py-2" style={BORDER}>
          <span className="text-[13px] font-extrabold text-slate-100">{spec.name}</span>
          <button type="button" aria-label="Close" onClick={cancel} className="rounded p-1 text-slate-300 hover:bg-white/10"><X size={15} /></button>
        </div>
        <div className="no-scrollbar flex overflow-x-auto border-b px-2" style={BORDER}>
          {tabs.map((t) => <button key={t} type="button" data-testid={`tab-${t}`} onClick={() => setTab(t)} className="shrink-0 border-b-2 px-3 py-2 text-[12px] font-bold" style={{ borderColor: cur === t ? '#3b82f6' : 'transparent', color: cur === t ? '#fff' : '#94a3b8' }}>{TAB_NAME[t]}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {cur === 'style' && (
            <>
              <Row label="Name"><input value={d.name} maxLength={40} onChange={(e) => apply({ name: e.target.value })} className={`${IN} w-40`} style={BORDER} placeholder={spec.name} /></Row>
              <Row label="Colour"><input type="color" data-testid="in-color" value={d.color} onChange={(e) => apply({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></Row>
              <Row label="Line width"><select data-testid="in-width" value={d.width} onChange={(e) => apply({ width: +e.target.value })} className={IN} style={BORDER}>{[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>{w}px</option>)}</select></Row>
              <Row label="Line style"><select data-testid="in-linestyle" value={d.style.lineStyle} onChange={(e) => setStyle('lineStyle', e.target.value)} className={IN} style={BORDER}>{D.LINE_STYLES.map((s) => <option key={s}>{s}</option>)}</select></Row>
              <Row label={`Opacity ${Math.round(d.style.opacity * 100)}%`}><input type="range" data-testid="in-opacity" min={10} max={100} value={Math.round(d.style.opacity * 100)} onChange={(e) => setStyle('opacity', +e.target.value / 100)} className="w-32" /></Row>
              {hasFill && (
                <>
                  <Check label="Fill" testid="in-fill" value={d.style.fill} onChange={(v) => setStyle('fill', v)} />
                  <Row label="Fill colour"><input type="color" data-testid="in-fillcolor" value={d.style.fillColor || d.color} onChange={(e) => setStyle('fillColor', e.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></Row>
                  <Row label={`Fill opacity ${Math.round(d.style.fillOpacity * 100)}%`}><input type="range" data-testid="in-fillopacity" min={2} max={100} value={Math.round(d.style.fillOpacity * 100)} onChange={(e) => setStyle('fillOpacity', +e.target.value / 100)} className="w-32" /></Row>
                </>
              )}
              {['trend', 'arrow', 'extline'].includes(d.type) && (
                <>
                  <Check label="Extend left" testid="in-extl" value={d.style.extendLeft} onChange={(v) => setStyle('extendLeft', v)} />
                  <Check label="Extend right" testid="in-extr" value={d.style.extendRight} onChange={(v) => setStyle('extendRight', v)} />
                </>
              )}
              {ARROW_TOOLS.includes(d.type) && (
                <>
                  {d.type !== 'hray' && <Row label="Start end"><select data-testid="in-arrowstart" value={d.style.arrowStart} onChange={(e) => setStyle('arrowStart', e.target.value)} className={IN} style={BORDER}>{D.ARROW_ENDS.map((s) => <option key={s}>{s}</option>)}</select></Row>}
                  <Row label="End"><select data-testid="in-arrowend" value={d.style.arrowEnd} onChange={(e) => setStyle('arrowEnd', e.target.value)} className={IN} style={BORDER}>{D.ARROW_ENDS.map((s) => <option key={s}>{s}</option>)}</select></Row>
                </>
              )}
              {STAT_TOOLS.includes(d.type) && <Check label="Show statistics" testid="in-stats" value={d.style.stats} onChange={(v) => setStyle('stats', v)} />}
              {LABEL_TOOLS.includes(d.type) && <Check label="Show labels" testid="in-labels" value={d.style.labels} onChange={(v) => setStyle('labels', v)} />}
              {d.type === 'arrowmark' && <Row label="Direction"><select data-testid="in-dir" value={d.dir} onChange={(e) => apply({ dir: e.target.value })} className={IN} style={BORDER}><option value="up">Up</option><option value="down">Down</option></select></Row>}
              {(d.type === 'fib' || d.type === 'fibext') && (
                <>
                  {d.type === 'fib' && <Check label="Extend lines right" testid="in-extend" value={d.extend} onChange={(v) => apply({ extend: v })} />}
                  {d.type === 'fib' && <Check label="Reverse" testid="in-reverse" value={d.style.fibReverse} onChange={(v) => setStyle('fibReverse', v)} />}
                  <Check label="Show level values" testid="in-fiblevels" value={d.style.fibLevels} onChange={(v) => setStyle('fibLevels', v)} />
                  <Check label="Show percent" testid="in-fibpercent" value={d.style.fibPercent} onChange={(v) => setStyle('fibPercent', v)} />
                  <Check label="Show prices" testid="in-fibprices" value={d.style.fibPrices} onChange={(v) => setStyle('fibPrices', v)} />
                  <Check label="Trend line" testid="in-fibtrend" value={d.style.fibTrend} onChange={(v) => setStyle('fibTrend', v)} />
                  <Check label="Background bands" testid="in-fibbg" value={d.style.fibBg} onChange={(v) => setStyle('fibBg', v)} />
                </>
              )}
              {spec.position && <p className="pt-2 text-[11px] text-slate-400">Money figures use your order-ticket lot size ({useTerminalStore.getState().settings.lots}) and the engine’s own P/L maths.</p>}
            </>
          )}
          {cur === 'text' && (
            <>
              <Row label="Text"><textarea data-testid="in-text" value={d.text || ''} maxLength={200} rows={2} onChange={(e) => apply({ text: e.target.value })} className={`${IN} h-16 w-56 py-1`} style={BORDER} /></Row>
              <Row label="Size"><input type="number" data-testid="in-size" min={8} max={40} value={d.textStyle.size} onChange={(e) => e.target.value !== '' && setText('size', Math.min(40, Math.max(8, +e.target.value)))} className={`${IN} w-20`} style={BORDER} /></Row>
              <Check label="Bold" testid="in-bold" value={d.textStyle.bold} onChange={(v) => setText('bold', v)} />
              <Check label="Italic" testid="in-italic" value={d.textStyle.italic} onChange={(v) => setText('italic', v)} />
              <Row label="Text colour"><input type="color" data-testid="in-textcolor" value={d.textStyle.color || d.color} onChange={(e) => setText('color', e.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></Row>
              <Row label="Align"><select data-testid="in-align" value={d.textStyle.align} onChange={(e) => setText('align', e.target.value)} className={IN} style={BORDER}>{['left', 'center', 'right'].map((s) => <option key={s}>{s}</option>)}</select></Row>
              <Check label="Background" testid="in-bg" value={d.textStyle.bg} onChange={(v) => setText('bg', v)} />
              <Check label="Border" testid="in-border" value={d.textStyle.border} onChange={(v) => setText('border', v)} />
            </>
          )}
          {cur === 'levels' && d.levels && (
            <>
              {d.levels.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5 py-1 text-[12px]">
                  <input type="checkbox" aria-label={`Level ${l.v} on`} data-testid={`lv-on-${i}`} checked={l.on} onChange={(e) => setLevel(i, { on: e.target.checked })} className="h-4 w-4 accent-blue-500" />
                  <input type="number" step="0.001" aria-label="Level value" data-testid={`lv-v-${i}`} value={l.v} onChange={(e) => e.target.value !== '' && Number.isFinite(+e.target.value) && setLevel(i, { v: +e.target.value })} className={`${IN} w-20`} style={BORDER} />
                  <input type="color" aria-label="Level colour" data-testid={`lv-c-${i}`} value={l.color || d.color} onChange={(e) => setLevel(i, { color: e.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                  <select aria-label="Level line style" data-testid={`lv-s-${i}`} value={l.style} onChange={(e) => setLevel(i, { style: e.target.value })} className={`${IN} px-1`} style={BORDER}>{D.LINE_STYLES.map((s) => <option key={s}>{s}</option>)}</select>
                  <button type="button" aria-label="Remove level" onClick={() => d.levels.length > 1 && apply({ levels: d.levels.filter((_, j) => j !== i) })} className="ml-auto rounded p-1 text-red-400 hover:bg-red-500/20"><Trash2 size={13} /></button>
                </div>
              ))}
              <button type="button" data-testid="lv-add" onClick={() => d.levels.length < 24 && apply({ levels: [...d.levels, { v: 1.272, on: true, color: '', style: 'solid' }] })} className="mt-1 flex items-center gap-1 rounded border px-2 py-1 text-[12px] font-semibold text-slate-200 hover:bg-white/5" style={BORDER}><Plus size={13} /> Add level</button>
              <button type="button" onClick={() => apply({ levels: D.defaultFibLevels(spec.levels === 'ext') })} className="ml-2 rounded px-2 py-1 text-[12px] text-slate-400 hover:bg-white/5">Reset levels</button>
            </>
          )}
          {cur === 'coords' && d.points.map((_, i) => <CoordRow key={i} d={d} idx={i} inst={inst} onSet={(idx, v) => apply(D.setAnchor(d, idx, v, inst))} />)}
          {cur === 'vis' && (
            <>
              <p className="pb-1 text-[11px] text-slate-400">Show this drawing on timeframes from … to …</p>
              <Row label="From"><select data-testid="in-tfmin" value={vis.tfMin} onChange={(e) => setVis('tfMin', e.target.value)} className={IN} style={BORDER}>{tfs.map((t) => <option key={t}>{t}</option>)}</select></Row>
              <Row label="To"><select data-testid="in-tfmax" value={vis.tfMax} onChange={(e) => setVis('tfMax', e.target.value)} className={IN} style={BORDER}>{tfs.map((t) => <option key={t}>{t}</option>)}</select></Row>
              <Check label="Hidden" testid="in-hidden" value={d.hidden} onChange={(v) => apply({ hidden: v })} />
              <Check label="Locked" testid="in-locked" value={d.locked} onChange={(v) => apply({ locked: v })} />
            </>
          )}
        </div>
        <div className="relative flex items-center gap-2 border-t px-3 py-2" style={BORDER}>
          <button type="button" data-testid="tpl-btn" onClick={() => setTplMenu(!tplMenu)} className="rounded border px-2 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/5" style={BORDER}>Template ▾</button>
          {tplMenu && (
            <div className="absolute bottom-12 left-3 z-10 w-56 overflow-hidden rounded-lg border py-1 text-[12px] shadow-2xl" style={{ backgroundColor: 'var(--tm-panel2)', ...BORDER }} data-testid="tpl-menu">
              <button type="button" className="block w-full px-3 py-1.5 text-left text-slate-200 hover:bg-white/10" onClick={() => { setTplMenu(false); saveTpl() }}>Save as…</button>
              <button type="button" className="block w-full px-3 py-1.5 text-left text-slate-200 hover:bg-white/10" data-testid="tpl-default" onClick={() => { st().setDrawDefault(d.type, d); setTplMenu(false); st().notify(`Next ${spec.name.toLowerCase()} will use this style`, 'info') }}>Set as default for new {spec.name.toLowerCase()}s</button>
              {defaults && <button type="button" className="block w-full px-3 py-1.5 text-left text-slate-400 hover:bg-white/10" onClick={() => { st().clearDrawDefault(d.type); setTplMenu(false) }}>Reset default</button>}
              {templates.length > 0 && <div className="border-t px-3 py-1 text-[10px] font-bold uppercase text-slate-500" style={BORDER}>Apply template</div>}
              {templates.map((t) => (
                <div key={t.name} className="flex items-center hover:bg-white/10">
                  <button type="button" className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-slate-200" onClick={() => { st().replaceDrawing(symbol, D.applyStyle(d, t)); setTplMenu(false) }}>{t.name}</button>
                  <button type="button" aria-label={`Delete template ${t.name}`} className="px-2 text-red-400" onClick={() => st().deleteDrawTemplate(d.type, t.name)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" data-testid="dlg-cancel" onClick={cancel} className="rounded border px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-white/5" style={BORDER}>Cancel</button>
            <button type="button" data-testid="dlg-ok" onClick={close} className="rounded bg-blue-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-blue-500">Ok</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// One dialog for the whole terminal (rendered by the active chart's layer).
export default function DrawingDialog({ symbol, timeMapRef }) {
  const id = useTerminalStore((s) => s.drawDialog)
  const exists = useTerminalStore((s) => !!id && (s.drawings[symbol] || []).some((d) => d.id === id))
  if (!exists || typeof document === 'undefined') return null
  return createPortal(<Body key={id} id={id} symbol={symbol} timeMapRef={timeMapRef} />, document.querySelector('.tm-root') || document.body)
}
