import { useSyncExternalStore } from 'react'
import { VolumeX } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { subscribeChip, getChip, unlockAudio } from '../../lib/terminal/soundEngine'

// Shown only when a sound was due but the browser still holds the audio context suspended
// (no tap/key yet). One tap unlocks it for the rest of the session.
export default function SoundChip() {
  const need = useSyncExternalStore(subscribeChip, getChip, () => false)
  const master = useTerminalStore((s) => s.settings.sound)
  if (!need || !master) return null
  return (
    <button type="button" data-testid="sound-chip" onClick={() => unlockAudio()}
      className="tm-tap absolute bottom-12 left-1/2 z-[40] flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-lg"
      style={{ backgroundColor: 'var(--tm-panel)', borderColor: '#38bdf8', color: 'var(--tm-text)' }}>
      <VolumeX size={13} className="text-sky-400" /> Tap to enable sound
    </button>
  )
}
