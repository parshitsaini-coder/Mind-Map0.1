import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Play, Square } from 'lucide-react'
import { useCS } from './settingsHelpers'
import { Group, Row, Sw, Rng } from './SettingsControls'
import { CATEGORIES, EVENTS, evKey } from '../../lib/terminal/eventCatalog'
import { SOUNDS, SOUND_BY_ID, PACKS } from '../../lib/terminal/soundDefs'
import { defaultSounds, soundPlan } from '../../lib/terminal/soundSettings'
import { previewSound, audioStatus, subscribeAudio, unlockAudio } from '../../lib/terminal/soundEngine'

// Settings → Sounds (Phase 12). Every control writes through chartSettings.sounds.* (validated, live, Cancel reverts).
const fieldCls = 'h-9 rounded border bg-transparent px-2 text-[12px] outline-none focus:border-sky-400'
const bd = { borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }

const PlayBtn = ({ label, onClick }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className="tm-tap flex h-9 w-9 shrink-0 items-center justify-center rounded border hover:bg-white/10" style={bd}>
    <Play size={13} />
  </button>
)

function EventRow({ e }) {
  const { cs, set } = useCS()
  const k = evKey(e.id)
  const ev = cs.sounds.ev[k]
  const base = `sounds.ev.${k}`
  const soundId = ev.sound === 'default' ? e.sound : ev.sound
  return (
    <div className="flex flex-wrap items-center gap-2 border-t py-1.5 first:border-t-0" style={{ borderColor: 'var(--tm-border)', opacity: ev.on ? 1 : 0.6 }}>
      <button type="button" role="switch" aria-checked={ev.on} aria-label={`${e.name} sound`} onClick={() => set(`${base}.on`, !ev.on)} className="tm-tap flex h-9 w-14 shrink-0 items-center gap-1.5 rounded px-1">
        <span className="relative h-4 w-8 rounded-full transition-colors" style={{ backgroundColor: ev.on ? '#2563eb' : 'var(--tm-border2)' }}>
          <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: ev.on ? 18 : 2 }} />
        </span>
        <span className="text-[9px] font-bold" style={{ color: ev.on ? '#38bdf8' : 'var(--tm-muted)' }}>{ev.on ? 'ON' : 'OFF'}</span>
      </button>
      <div className="min-w-[110px] flex-1 text-[12px] font-semibold">{e.name}</div>
      <select aria-label={`${e.name} sound choice`} value={ev.sound} onChange={(x) => set(`${base}.sound`, x.target.value)} className={`${fieldCls} w-40 sm:w-44`} style={{ ...bd, backgroundColor: 'var(--tm-panel2)' }}>
        <option value="default">Default ({SOUND_BY_ID[e.sound].name})</option>
        {SOUNDS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input type="range" aria-label={`${e.name} volume`} min={0} max={1} step={0.05} value={ev.vol} onChange={(x) => set(`${base}.vol`, Number(x.target.value))} className="w-20 accent-sky-500" />
      <PlayBtn label={`Preview ${e.name}`} onClick={() => previewSound(soundId, cs.sounds.volume * ev.vol, cs.sounds.pack)} />
    </div>
  )
}

function TestAll() {
  const { cs } = useCS()
  const [running, setRunning] = useState(false)
  const timers = useRef([])
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; setRunning(false) }
  useEffect(() => stop, [])
  const start = () => {
    unlockAudio()
    const plans = EVENTS.map((e) => soundPlan(cs, e.id, false)).filter(Boolean)
    if (!plans.length) return
    setRunning(true)
    plans.forEach((p, i) => timers.current.push(setTimeout(() => {
      previewSound(p.soundId, p.volume, p.pack.id)
      if (i === plans.length - 1) timers.current.push(setTimeout(() => setRunning(false), 900))
    }, i * 850)))
  }
  return (
    <button type="button" onClick={running ? stop : start} className="tm-tap flex h-9 items-center gap-1.5 rounded border px-3 text-[12px] font-semibold hover:bg-white/10" style={bd}>
      {running ? <><Square size={12} /> Stop</> : <><Play size={12} /> Test all</>}
    </button>
  )
}

export default function SoundsTab() {
  const { cs, set } = useCS()
  const status = useSyncExternalStore(subscribeAudio, audioStatus, () => 'idle')
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  return (
    <>
      <Group title="Sound">
        <Sw path="sounds.master" label="Sound on" hint={status === 'unsupported' ? 'This browser cannot play sounds.' : 'Plays a different sound for each trading event.'} />
        <Rng path="sounds.volume" label="Master volume" min={0} max={1} step={0.05} scale={100} unit="%" />
        <Sw path="sounds.bgMute" label="Mute when tab is in background" />
        <Sw path="sounds.vibrate" label="Vibration" hint={canVibrate ? 'Short vibration patterns on fills, SL / TP and stop-outs (phones).' : 'Not supported by this browser or device.'} disabled={!canVibrate} />
      </Group>
      <Group title="Sound pack">
        <div className="flex flex-wrap gap-2 py-1.5" role="radiogroup" aria-label="Sound pack">
          {PACKS.map((p) => {
            const on = cs.sounds.pack === p.id
            return (
              <div key={p.id} className="flex items-stretch overflow-hidden rounded border" style={{ borderColor: on ? '#2563eb' : 'var(--tm-border2)' }}>
                <button type="button" role="radio" aria-checked={on} onClick={() => set('sounds.pack', p.id)} className="tm-tap px-3 text-left" style={{ backgroundColor: on ? '#2563eb' : 'transparent', color: on ? '#fff' : 'var(--tm-text)' }}>
                  <span className="block text-[12px] font-bold">{p.name}</span>
                  <span className="block text-[10px]" style={{ color: on ? '#dbeafe' : 'var(--tm-muted)' }}>{p.hint}</span>
                </button>
                <button type="button" aria-label={`Preview ${p.name} pack`} title="Preview" onClick={() => previewSound('buy', cs.sounds.volume, p.id)} className="tm-tap flex w-10 items-center justify-center border-l hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}><Play size={13} /></button>
              </div>
            )
          })}
        </div>
      </Group>
      {CATEGORIES.map(([cid, cname]) => {
        const list = EVENTS.filter((e) => e.cat === cid)
        return list.length ? <Group key={cid} title={cname}>{list.map((e) => <EventRow key={e.id} e={e} />)}</Group> : null
      })}
      <Group title="Tools">
        <Row label="Try the sounds" hint="Plays every enabled event in turn.">
          <TestAll />
          <button type="button" onClick={() => set('sounds', defaultSounds())} className="tm-tap h-9 rounded border px-3 text-[12px] font-semibold hover:bg-white/10" style={bd}>Reset sounds</button>
        </Row>
      </Group>
    </>
  )
}
