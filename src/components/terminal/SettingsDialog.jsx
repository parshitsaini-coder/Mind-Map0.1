import { useEffect, useRef, useState } from 'react'
import { X, Download, Upload, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { cleanChartSettings, CHART_TYPE_IDS } from '../../lib/terminal/chartSettings'
import SoundsTab from './SoundsTab'
import AnimTab from './AnimTab'
import { SymbolTab, StatusTab, ScalesTab, CanvasTab, TradingTab, AlertsTab, ShortcutsTab } from './SettingsTabs'

// TradingView-style settings dialog. Every change is applied to the chart immediately (live preview);
// Cancel (also Esc / the backdrop / ✕) puts everything back the way it was when the dialog opened; Ok keeps it.
const TABS = [
  ['symbol', 'Symbol', SymbolTab],
  ['status', 'Status line', StatusTab],
  ['scales', 'Scales and lines', ScalesTab],
  ['canvas', 'Canvas', CanvasTab],
  ['trading', 'Trading', TradingTab],
  ['sounds', 'Sounds', SoundsTab],
  ['anim', 'Animations', AnimTab],
  ['alerts', 'Alerts', AlertsTab],
  ['shortcuts', 'Shortcuts', ShortcutsTab],
]
export const SETTINGS_TABS = TABS.map((t) => t[0])

const TEMPLATE_KEY = 'tm-chart-templates'
const readTemplates = () => { try { const v = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'); return Array.isArray(v) ? v.filter((t) => t && typeof t.name === 'string') : [] } catch { return [] } }
const writeTemplates = (list) => { try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list.slice(0, 20))) } catch { /* private mode */ } }

function TemplateMenu({ onClose }) {
  const [list, setList] = useState(readTemplates)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const st = useTerminalStore.getState
  const save = () => {
    const n = name.trim().slice(0, 30)
    if (!n) return
    const next = [...list.filter((t) => t.name !== n), { name: n, cs: st().chartSettings, chartType: st().chartType }]
    writeTemplates(next); setList(next); setName(''); setNote(`Saved “${n}”`)
  }
  const apply = (t) => { st().replaceChartSettings(t.cs); st().setChartType(t.chartType); setNote(`Applied “${t.name}”`) }
  const del = (n) => { const next = list.filter((t) => t.name !== n); writeTemplates(next); setList(next) }
  return (
    <div className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border p-2 shadow-xl" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border2)' }} role="menu" aria-label="Templates">
      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Template name" aria-label="Template name" maxLength={30} className="h-8 min-w-0 flex-1 rounded border bg-transparent px-2 text-[12px] outline-none focus:border-sky-400" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }} />
        <button type="button" onClick={save} disabled={!name.trim()} className="flex h-8 items-center gap-1 rounded bg-blue-600 px-2 text-[11px] font-semibold text-white disabled:opacity-40"><Save size={12} /> Save</button>
      </div>
      <div className="mt-1 max-h-40 overflow-y-auto">
        {list.length === 0 && <div className="px-1 py-2 text-[11px]" style={{ color: 'var(--tm-muted)' }}>No templates yet. Save the current look with a name.</div>}
        {list.map((t) => (
          <div key={t.name} className="flex items-center gap-1 py-0.5">
            <button type="button" onClick={() => apply(t)} className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-[12px] hover:bg-white/10" style={{ color: 'var(--tm-text)' }}>{t.name}</button>
            <button type="button" onClick={() => del(t.name)} aria-label={`Delete template ${t.name}`} className="rounded p-1.5 hover:bg-white/10" style={{ color: 'var(--tm-muted)' }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      {note && <div className="px-1 pt-1 text-[10px] text-sky-400" role="status">{note}</div>}
      <button type="button" onClick={onClose} className="mt-1 w-full rounded px-2 py-1 text-right text-[11px]" style={{ color: 'var(--tm-muted)' }}>Close</button>
    </div>
  )
}

export default function SettingsDialog({ initialTab = 'symbol', onClose }) {
  const [tab, setTab] = useState(SETTINGS_TABS.includes(initialTab) ? initialTab : 'symbol')
  const [tplOpen, setTplOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const rootRef = useRef(null)
  const fileRef = useRef(null)
  const [snap] = useState(() => {
    const s = useTerminalStore.getState()
    return { cs: s.chartSettings, chartType: s.chartType, settings: s.settings, commission: s.account.commission || 0 }
  })

  const cancel = () => {
    const s = useTerminalStore.getState()
    s.replaceChartSettings(snap.cs)
    s.setChartType(snap.chartType)
    s.setSettings(snap.settings)
    if ((s.account.commission || 0) !== snap.commission) s.setCommission(snap.commission)
    onClose()
  }
  const cancelRef = useRef(cancel)
  cancelRef.current = cancel

  useEffect(() => {
    rootRef.current?.focus()
    const onCancel = () => cancelRef.current()
    window.addEventListener('tm-settings-cancel', onCancel)
    return () => window.removeEventListener('tm-settings-cancel', onCancel)
  }, [])

  // keep Tab inside the dialog
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancel(); return }
    if (e.key !== 'Tab') return
    const f = rootRef.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')
    if (!f || !f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault() }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault() }
  }

  const reset = () => {
    if (!window.confirm('Reset every chart setting to its default?')) return
    useTerminalStore.getState().resetChartSettings()
    useTerminalStore.getState().setChartType('candles')
    setMsg('Reset to defaults')
  }
  const exportJson = () => {
    const s = useTerminalStore.getState()
    const blob = new Blob([JSON.stringify({ kind: 'terminal-chart-settings', chartType: s.chartType, chartSettings: s.chartSettings }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'terminal-chart-settings.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const importJson = async (file) => {
    try {
      const data = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || !data.chartSettings) throw new Error('bad file')
      const s = useTerminalStore.getState()
      s.replaceChartSettings(cleanChartSettings(data.chartSettings))
      if (CHART_TYPE_IDS.includes(data.chartType)) s.setChartType(data.chartType)
      setMsg('Imported')
    } catch { setMsg('That file is not a chart-settings export') }
  }

  const Body = TABS.find((t) => t[0] === tab)[2]
  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Terminal settings">
      <div className="absolute inset-0 bg-black/60" onClick={cancel} />
      <div ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown} className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden outline-none sm:h-[min(640px,92vh)] sm:rounded-xl sm:border"
        style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border)', color: 'var(--tm-text)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--tm-border)' }}>
          <h2 className="text-[14px] font-extrabold">Settings</h2>
          <button type="button" onClick={cancel} aria-label="Close settings (cancel)" className="tm-tap rounded p-1.5 hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5 sm:w-44 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r sm:px-2 sm:py-2" style={{ borderColor: 'var(--tm-border)' }} role="tablist" aria-label="Settings sections">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="tm-tap h-9 shrink-0 whitespace-nowrap rounded px-3 text-left text-[12px] font-semibold"
                style={{ backgroundColor: tab === id ? 'var(--tm-active)' : 'transparent', color: tab === id ? 'var(--tm-text)' : 'var(--tm-muted)' }}>{label}</button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" role="tabpanel"><Body /></div>
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: 'var(--tm-border)' }}>
          <div className="relative">
            <button type="button" onClick={() => setTplOpen((v) => !v)} aria-expanded={tplOpen} className="h-8 rounded border px-2.5 text-[11px] font-semibold" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>Template ▾</button>
            {tplOpen && <TemplateMenu onClose={() => setTplOpen(false)} />}
          </div>
          <button type="button" onClick={reset} title="Reset all chart settings" aria-label="Reset all chart settings" className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-muted)' }}><RotateCcw size={13} /></button>
          <button type="button" onClick={exportJson} title="Export settings" aria-label="Export settings" className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-muted)' }}><Download size={13} /></button>
          <button type="button" onClick={() => fileRef.current?.click()} title="Import settings" aria-label="Import settings" className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-muted)' }}><Upload size={13} /></button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-sky-400" role="status">{msg}</span>
          <button type="button" onClick={cancel} className="h-8 rounded border px-3 text-[12px] font-semibold" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>Cancel</button>
          <button type="button" onClick={onClose} className="h-8 rounded bg-blue-600 px-4 text-[12px] font-bold text-white">Ok</button>
        </div>
      </div>
    </div>
  )
}
