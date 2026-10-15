import { createFrameGuard } from '../../lib/terminal/frameGuard'
import { setDegraded } from '../../lib/terminal/fxState'
import { useTerminalStore } from '../../store/terminalStore'

// One adaptive guard for the whole terminal: if effect frames stay slower than 24 ms for a second, motion drops to
// "reduced" for this session and the person is told once. Settings → Animations has a button to try full motion again.
export const fxGuard = createFrameGuard({
  limitMs: 24, windowMs: 1000,
  onDegrade: () => {
    setDegraded(true)
    useTerminalStore.getState().notify('Animations reduced to keep the chart smooth', 'info')
  },
})
export const retryFullMotion = () => { fxGuard.reset(); setDegraded(false) }
