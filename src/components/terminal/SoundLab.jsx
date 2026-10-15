import { useEffect, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { EVENTS, CATEGORIES } from '../../lib/terminal/eventCatalog'
import { emitTerminalEvent } from '../../lib/terminal/effects'
import { isLabOpen, setLabOpen, subscribeLab, labAllowed } from '../../lib/terminal/labState'
import { audioStatus, subscribeAudio } from '../../lib/terminal/soundEngine'
import { useTerminalStore } from '../../store/terminalStore'
import { sampleEvent } from './fxSamples'

// Effects playground: one button per catalogue event. Each press goes through the same bus a real event uses,
// so you get the toast, popup, sound, vibration and chart effect exactly as they would happen (with sample numbers).
export default function SoundLab() {
  const open = useSyncExternalStore(subscribeLab, isLabOpen, () => false)
  const status = useSyncExternalStore(subscribeAudio, audioStatus, () => 'idle')
  const cs = useTerminalStore((s) => s.chartSettings)
  useEffect(() => {
    if (labAllowed() && new URLSearchParams(window.location.search).get('lab') === '1') setLabOpen(true)
  }, [])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Effects playground">
      <div className="absolute inset-0 bg-black/60" onClick={() => setLabOpen(false)} />
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border sm:rounded-xl" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border)', color: 'var(--tm-text)' }}>
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--tm-border)' }}>
          <h2 className="text-[14px] font-extrabold">Effects playground <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--tm-muted)' }}>audio: {status} · pack: {cs.sounds.pack}</span></h2>
          <button type="button" onClick={() => setLabOpen(false)} aria-label="Close playground" className="tm-tap rounded p-1.5 hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-3">
          {CATEGORIES.map(([cid, cname]) => (
            <div key={cid} className="pb-3">
              <h3 className="pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--tm-muted)' }}>{cname}</h3>
              <div className="flex flex-wrap gap-2">
                {EVENTS.filter((e) => e.cat === cid).map((e) => (
                  <button key={e.id} type="button" data-event={e.id} onClick={() => emitTerminalEvent(sampleEvent(e.id))}
                    className="tm-tap h-10 rounded border px-3 text-[12px] font-semibold hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)' }}>{e.name}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
