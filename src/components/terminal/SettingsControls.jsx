import { useState } from 'react'
import { withAlpha, alphaOf } from '../../lib/terminal/chartSettings'
import { useCS } from './settingsHelpers'

// Small form controls for the Settings dialog. Each one is bound to a path inside chartSettings
// ('canvas.bg', 'scales.mode', ...) and writes through setChartSettings, so every change is validated
// and shows on the chart immediately (live preview).

const LINE = 'flex items-center justify-between gap-3 py-1.5'
const LABEL = 'min-w-0 text-[12px] font-semibold'
const HINT = 'block text-[10px] font-normal leading-snug'
const fieldCls = 'h-8 rounded border bg-transparent px-2 text-[12px] outline-none focus:border-sky-400'
const bd = { borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }

export function Row({ label, hint, children }) {
  return (
    <div className={LINE}>
      <div className={LABEL} style={{ color: 'var(--tm-text)' }}>
        {label}
        {hint && <span className={HINT} style={{ color: 'var(--tm-muted)' }}>{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function Group({ title, children }) {
  return (
    <section className="border-b py-2 last:border-b-0" style={{ borderColor: 'var(--tm-border)' }}>
      {title && <h3 className="pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--tm-muted)' }}>{title}</h3>}
      {children}
    </section>
  )
}

export function Sw({ path, label, hint, disabled }) {
  const { set, get } = useCS()
  const on = !!get(path)
  return <SwitchRaw label={label} hint={hint} checked={on} disabled={disabled} onChange={(v) => set(path, v)} />
}

export function SwitchRaw({ label, hint, checked, onChange, disabled }) {
  return (
    <Row label={label} hint={hint}>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="flex items-center gap-2 rounded-full px-1 py-1 disabled:opacity-40">
        <span className="w-6 text-right text-[10px] font-bold tabular-nums" style={{ color: checked ? '#38bdf8' : 'var(--tm-muted)' }}>{checked ? 'ON' : 'OFF'}</span>
        <span className="relative h-5 w-9 rounded-full transition-colors" style={{ backgroundColor: checked ? '#2563eb' : 'var(--tm-border2)' }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: checked ? 18 : 2 }} />
        </span>
      </button>
    </Row>
  )
}

export function Sel({ path, label, hint, options }) {
  const { set, get } = useCS()
  return (
    <Row label={label} hint={hint}>
      <select aria-label={label} value={get(path)} onChange={(e) => set(path, e.target.value)} className={fieldCls} style={{ ...bd, backgroundColor: 'var(--tm-panel2)' }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Row>
  )
}

export function Seg({ path, label, hint, options }) {
  const { set, get } = useCS()
  const v = get(path)
  return (
    <Row label={label} hint={hint}>
      <div className="flex overflow-hidden rounded border" role="radiogroup" aria-label={label} style={{ borderColor: 'var(--tm-border2)' }}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={v === o.id} onClick={() => set(path, o.id)} className="h-8 px-2.5 text-[11px] font-semibold" style={{ backgroundColor: v === o.id ? '#2563eb' : 'transparent', color: v === o.id ? '#fff' : 'var(--tm-muted)' }}>{o.label}</button>
        ))}
      </div>
    </Row>
  )
}

// Colour picker + hex box (+ opacity slider when `alpha`). Stores '#rrggbb' or '#rrggbbaa'.
export function Col({ path, label, hint, alpha }) {
  const { set, get } = useCS()
  const val = get(path) || '#000000'
  const [draft, setDraft] = useState(null) // text being typed (null = show the real value)
  const hex = draft ?? val.slice(0, 7)
  const a = alphaOf(val)
  const commit = (h6, al) => set(path, alpha ? withAlpha(h6, al) : h6)
  return (
    <Row label={label} hint={hint}>
      {alpha && <input type="range" aria-label={`${label} opacity`} min={0} max={100} value={Math.round(a * 100)} onChange={(e) => commit(val.slice(0, 7), Number(e.target.value) / 100)} className="w-16 accent-sky-500" title={`Opacity ${Math.round(a * 100)}%`} />}
      <input type="text" aria-label={`${label} hex`} value={hex} maxLength={7} spellCheck={false}
        onChange={(e) => { setDraft(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) commit(e.target.value, a) }}
        onBlur={() => setDraft(null)}
        className={`${fieldCls} w-[76px] font-mono uppercase`} style={bd} />
      <input type="color" aria-label={label} value={val.slice(0, 7)} onChange={(e) => commit(e.target.value, a)} className="h-8 w-9 cursor-pointer rounded border bg-transparent p-0.5" style={{ borderColor: 'var(--tm-border2)' }} />
    </Row>
  )
}

export function Rng({ path, label, hint, min, max, step = 1, unit = '', scale = 1, digits = 0 }) {
  const { set, get } = useCS()
  const v = get(path)
  return (
    <Row label={label} hint={hint}>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={v} onChange={(e) => set(path, Number(e.target.value))} className="w-28 accent-sky-500" />
      <span className="w-14 text-right text-[11px] tabular-nums" style={{ color: 'var(--tm-muted)' }}>{(v * scale).toFixed(digits)}{unit}</span>
    </Row>
  )
}

export function Txt({ path, label, placeholder, maxLength = 40 }) {
  const { set, get } = useCS()
  return (
    <Row label={label}>
      <input type="text" aria-label={label} value={get(path)} maxLength={maxLength} placeholder={placeholder} onChange={(e) => set(path, e.target.value)} className={`${fieldCls} w-40`} style={bd} />
    </Row>
  )
}

