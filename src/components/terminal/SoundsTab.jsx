import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { CATEGORIES, EVENTS } from '../../lib/terminal/eventCatalog'
import { SOUNDS, SOUND_IDS, PACKS, PACK_IDS } from '../../lib/terminal/soundDesign'
import { DEFAULT_CHART_SETTINGS } from '../../lib/terminal/chartSettings'
import { previewSound, previewEvent, testAll, audioSupported, unlockAudio } from '../../lib/terminal/soundEngine'
import { Group, Row, Sw, SwitchRaw, Sel, Rng } from './SettingsControls'

const btn = 'tm-tap inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold'
const bd = { borderColor: 'var(--tm-border2)', color: 'var(--tm-text)', backgroundColor: 'var(--tm-panel2)' }

const patchEvent = (id, p) => useTerminalStore.getState().setChartSettings({ sounds: { events: { [id]: p } } })
const vibrateOk = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function EventRow({ def, cfg }) {
  const ev = cfg.events[def.id]
  const eff = ev.sound === 'default' ? def.sound : ev.sound
  return (
    <div data-testid={`snd-row-${def.id}`} className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0" style={{ borderColor: 'var(--tm-border)' }}>
      <button type="button" role="switch" aria-checked={ev.on} aria-label={`${def.label} sound`} data-testid={`snd-on-${def.id}`} onClick={() => patchEvent(def.id, { on: !ev.on })}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ backgroundColor: ev.on ? '#2563eb' : 'var(--tm-border2)' }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: ev.on ? 18 : 2 }} />
      </button>
      <span className="min-w-[8rem] flex-1 text-[12px] font-semibold" style={{ color: ev.on ? 'var(--tm-text)' : 'var(--tm-muted)' }}>{def.label}</span>
      <select aria-label={`${def.label} sound choice`} data-testid={`snd-pick-${def.id}`} value={ev.sound} onChange={(e) => patchEvent(def.id, { sound: e.target.value })}
        className="h-8 w-36 rounded border bg-transparent px-1.5 text-[11px] outline-none focus:border-sky-400" style={bd}>
        <option value="default">Default ({SOUNDS[def.sound].label})</option>
        {SOUND_IDS.filter((s) => s !== def.sound).map((s) => <option key={s} value={s}>{SOUNDS[s].label}</option>)}
      </select>
      <input type="range" min={0} max={100} step={5} value={ev.volume} aria-label={`${def.label} volume`} data-testid={`snd-vol-${def.id}`}
        onChange={(e) => patchEvent(def.id, { volume: Number(e.target.value) })} className="w-20 accent-sky-500" />
      <button type="button" aria-label={`Preview ${def.label}`} data-testid={`snd-play-${def.id}`} title={SOUNDS[eff].label} onClick={() => { unlockAudio(); previewEvent(def.id) }} className={`${btn} w-8 justify-center px-0`} style={bd}><Play size={12} /></button>
    </div>
  )
}

export default function SoundsTab() {
  const master = useTerminalStore((s) => s.settings.sound)
  const setSettings = useTerminalStore.getState().setSettings
  const cfg = useTerminalStore((s) => s.chartSettings.sounds)
  const [note, setNote] = useState('')
  const supported = audioSupported()
  const live = EVENTS.filter((e) => e.live)

  const packDemo = () => {
    unlockAudio()
    ;['buy', 'chime', 'descend', 'alarm'].forEach((s, i) => setTimeout(() => previewSound(s, { volume: 1, pack: cfg.pack }), i * 700))
  }
  return (
    <>
      <Group title="Sound">
        <SwitchRaw label="Sounds" hint={supported ? 'Master switch. Everything below only matters while this is on.' : 'This browser has no Web Audio — sounds are unavailable.'} checked={master} disabled={!supported} onChange={(v) => setSettings({ sound: v })} />
        <Rng path="sounds.volume" label="Master volume" min={0} max={100} step={5} unit="%" hint="0 is silent." />
        <Sw path="sounds.muteBackground" label="Mute when the tab is in the background" />
        <SwitchRaw label="Vibration" hint={vibrateOk() ? 'Short patterns per event class (phones).' : 'Not supported by this browser or device.'} checked={cfg.vibrate && vibrateOk()} disabled={!vibrateOk()}
          onChange={(v) => useTerminalStore.getState().setChartSettings({ sounds: { vibrate: v } })} />
        <Row label="Sound pack">
          <select aria-label="Sound pack" data-testid="snd-pack" value={cfg.pack} onChange={(e) => useTerminalStore.getState().setChartSettings({ sounds: { pack: e.target.value } })}
            className="h-8 w-28 min-w-0 rounded border bg-transparent px-2 text-[12px] outline-none focus:border-sky-400 sm:w-40" style={bd}>
            {PACK_IDS.map((id) => <option key={id} value={id}>{PACKS[id].label.replace(/ \(.*\)/, '')}</option>)}
          </select>
          <button type="button" data-testid="snd-pack-demo" onClick={packDemo} className={btn} style={bd}><Play size={12} /> Preview</button>
        </Row>
        <p className="pb-1 text-[10px]" style={{ color: 'var(--tm-muted)' }}>{PACKS[cfg.pack].only ? 'Only stop loss, take profit and stop-out make a sound.' : 'Classic is crisp, Soft is rounded and quieter, Arcade is square-wave.'}</p>
        <div className="flex flex-wrap gap-2 py-2">
          <button type="button" data-testid="snd-test-all" onClick={() => { unlockAudio(); const s = testAll(); setNote(s ? `Playing ${live.length} sounds…` : 'Audio is not available right now.') }} className={btn} style={bd}><Play size={12} /> Test all</button>
          <button type="button" data-testid="snd-reset" onClick={() => { setSettings({ sound: true }); useTerminalStore.getState().replaceChartSettings({ ...useTerminalStore.getState().chartSettings, sounds: DEFAULT_CHART_SETTINGS.sounds }); setNote('Sounds reset to defaults.') }} className={btn} style={bd}><RotateCcw size={12} /> Reset sounds</button>
          {note && <span role="status" className="self-center text-[11px]" style={{ color: 'var(--tm-muted)' }}>{note}</span>}
        </div>
      </Group>
      {CATEGORIES.map((c) => {
        const rows = live.filter((e) => e.category === c.id)
        if (!rows.length) return null
        return (
          <Group key={c.id} title={c.label}>
            {rows.map((d) => <EventRow key={d.id} def={d} cfg={cfg} />)}
          </Group>
        )
      })}
      <p className="px-1 py-2 text-[10px]" style={{ color: 'var(--tm-muted)' }}>Price alerts, connection and click sounds are reserved for later phases and appear here once they exist. Custom sound files per event are not available yet.</p>
    </>
  )
}
