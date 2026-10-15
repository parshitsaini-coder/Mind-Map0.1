import { useEffect, useRef } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { useAccountMetrics } from './hooks'
import { marginState } from '../../lib/terminal/positionOverlay'
import { marginTransition } from '../../lib/terminal/marginWatch'
import { emitTerminalEvent } from '../../lib/terminal/effects'
import { setMargin } from '../../lib/terminal/fxState'

// Raises `account.margin.warning` ONCE when the margin level drops under the warning threshold (Settings → Trading),
// and re-arms when it is healthy again. Renders nothing. This also closes the Phase 12 gap (the event had no emitter).
export default function MarginWatch() {
  const { metrics } = useAccountMetrics()
  const warn = useTerminalStore((s) => s.chartSettings.trading.marginWarn)
  const stopOut = useTerminalStore((s) => s.settings.stopOutLevel)
  const prev = useRef('none')
  const level = metrics.marginLevel
  useEffect(() => {
    const next = marginState(level, warn, stopOut)
    const { fire } = marginTransition(prev.current, next)
    prev.current = next
    setMargin(next)
    if (fire) emitTerminalEvent({ id: 'account.margin.warning', text: `Margin level is low (${Math.round(level)}%)`, kind: 'error', data: { level, warn } })
  }, [level, warn, stopOut])
  return null
}
