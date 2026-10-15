import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { effectiveMode, prefersReduced } from '../../lib/terminal/animSettings'
import { getFx, subscribeFx } from '../../lib/terminal/fxState'

// 'full' | 'reduced' | 'off' — settings + the OS reduce-motion switch + the adaptive guard, live.
export function useAnimMode() {
  const anim = useTerminalStore((s) => s.chartSettings.anim)
  const degraded = useSyncExternalStore(subscribeFx, () => getFx().degraded, () => false)
  const [sys, setSys] = useState(prefersReduced)
  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    if (!mq) return undefined
    const on = () => setSys(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return effectiveMode(anim, { systemReduced: sys, degraded })
}
