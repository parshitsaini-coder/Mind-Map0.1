import { memo, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { MAX_COMMISSION } from '../../lib/terminal/ledger'
import { wakeLockSupported, SHORTCUTS } from './phase8Hooks'

const BORDER = '#27313d'

function Switch({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-100">{label}</div>
        {hint && <div className="text-[10px] leading-snug text-slate-400">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className="flex shrink-0 items-center gap-2 rounded-full px-1 py-1 disabled:opacity-40">
        <span className="text-[10px] font-bold tabular-nums" style={{ color: checked ? '#7dd3fc' : '#94a3b8' }}>{checked ? 'ON' : 'OFF'}</span>
        <span className="relative h-5 w-9 rounded-full transition-colors" style={{ backgroundColor: checked ? '#2563eb' : '#334155' }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: checked ? 18 : 2 }} />
        </span>
      </button>
    </div>
  )
}

// Commits on blur / Enter; shows why a value was refused instead of silently ignoring it.
function NumberField({ label, hint, value, onCommit, step = 'any', suffix }) {
  const [text, setText] = useState(String(value))
  const [err, setErr] = useState('')
  const commit = () => {
    const r = onCommit(text.trim())
    if (r && r.ok === false) { setErr(r.error); return }
    setErr('')
  }
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <label className="min-w-0 text-[12px] font-semibold text-slate-100">
          {label}
          {hint && <span className="block text-[10px] font-normal leading-snug text-slate-400">{hint}</span>}
        </label>
        <span className="flex shrink-0 items-center gap-1">
          <input type="number" inputMode="decimal" step={step} value={text} aria-invalid={!!err}
            onChange={(e) => { setText(e.target.value); setErr('') }} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
            className="h-9 w-24 rounded border bg-transparent px-2 text-right text-[13px] tabular-nums text-white outline-none focus:border-sky-400"
            style={{ borderColor: err ? '#f87171' : BORDER }} />
          {suffix && <span className="w-8 text-[10px] text-slate-400">{suffix}</span>}
        </span>
      </div>
      {err && <div role="alert" className="mt-1 text-right text-[10px] text-red-300">{err}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="border-t px-4 py-2" style={{ borderColor: BORDER }}>
      <h3 className="pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  )
}

function SettingsPanel({ onClose, showShortcuts = true }) {
  const settings = useTerminalStore((s) => s.settings)
  const commission = useTerminalStore((s) => s.account.commission || 0)
  const set = useTerminalStore.getState().setSettings
  const closeRef = useRef(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  const setLots = (txt) => {
    const v = Number(txt)
    if (!Number.isFinite(v) || v < 0.01 || v > 100) return { ok: false, error: 'Default lots must be between 0.01 and 100' }
    set({ lots: Math.round(v * 100) / 100 })
    return { ok: true }
  }
  const setStopOut = (txt) => {
    const v = Number(txt)
    if (txt === '' || !Number.isFinite(v) || v < 0 || v > 100) return { ok: false, error: 'Stop-out level must be between 0 and 100 %' }
    set({ stopOutLevel: v })
    return { ok: true }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Terminal settings">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border sm:rounded-xl" style={{ backgroundColor: '#131a22', borderColor: BORDER, color: '#e5e7eb', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-[14px] font-extrabold">Terminal settings</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close settings" className="tm-tap rounded p-1.5 hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="Trading">
            <Switch label="One-click trading" hint="BUY / SELL fill immediately, without a confirmation step." checked={settings.oneClick} onChange={(v) => set({ oneClick: v })} />
            <NumberField key={`lots-${settings.lots}`} label="Default lots" hint="Starting lot size of the order ticket." value={settings.lots} step="0.01" onCommit={setLots} suffix="lots" />
            <NumberField key={`so-${settings.stopOutLevel}`} label="Stop-out level" hint="When margin level falls below this, the worst position is closed." value={settings.stopOutLevel} step="1" onCommit={setStopOut} suffix="%" />
          </Section>

          <Section title="Execution costs (simulated)">
            <div className="py-2">
              <div className="text-[12px] font-semibold text-slate-100">Spread</div>
              <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Spread mode">
                {[['fixed', 'Fixed'], ['variable', 'Variable']].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={settings.spreadMode === id} onClick={() => set({ spreadMode: id })}
                    className="tm-tap h-9 flex-1 rounded text-[12px] font-semibold" style={{ backgroundColor: settings.spreadMode === id ? '#2563eb' : '#1e2733', color: settings.spreadMode === id ? '#fff' : '#9aa4b2' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-slate-400">
                {settings.spreadMode === 'variable' ? 'Spread widens now and then (about 2× at times, 3–6× in rare spikes), like around news.' : 'Every symbol always trades at its normal spread.'}
              </div>
            </div>
            <Switch label="Slippage" hint="Market orders fill up to 0.5 pip worse than the screen price — never better." checked={settings.slippage} onChange={(v) => set({ slippage: v })} />
            <NumberField key={`co-${commission}`} label="Commission" hint="Charged per lot when a position is closed (round turn). 0 = none." value={commission} step="0.5" onCommit={(t) => useTerminalStore.getState().setCommission(t === '' ? NaN : t)} suffix="$/lot" />
            <div className="pb-1 text-[10px] text-slate-500">Applies to new fills only; max {MAX_COMMISSION} $/lot. Demo — prices and fills are simulated and will differ from a real broker.</div>
          </Section>

          <Section title="Alerts & screen">
            <Switch label="Sounds" hint="A short beep on fills, SL / TP hits and stop-outs." checked={settings.sound} onChange={(v) => set({ sound: v })} />
            <Switch label="Keep screen on" hint={wakeLockSupported() ? 'Stops the phone from sleeping while the terminal is open (this device only).' : 'Not supported by this browser.'}
              checked={settings.wakeLock && wakeLockSupported()} disabled={!wakeLockSupported()} onChange={(v) => set({ wakeLock: v })} />
          </Section>

          {showShortcuts && (
            <Section title="Keyboard shortcuts">
              <dl className="py-1">
                {SHORTCUTS.map(([k, d]) => (
                  <div key={k} className="flex gap-3 py-1 text-[11px]">
                    <dt className="w-16 shrink-0 font-mono font-bold text-sky-300">{k}</dt>
                    <dd className="text-slate-300">{d}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
export default memo(SettingsPanel)
