import { useEffect, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { motionFlags } from '../../lib/terminal/motionPolicy'

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)

// Current motion flags (settings + system reduce-motion + adaptive downgrade); re-renders when any change.
export function useMotion() {
  const anim = useTerminalStore((s) => s.chartSettings.anim)
  const adaptive = useTerminalStore((s) => s.adaptive)
  const [prefersReduced, setPR] = useState(() => !!mq()?.matches)
  useEffect(() => {
    const m = mq()
    if (!m) return undefined
    const on = () => setPR(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return motionFlags(anim, { prefersReduced, adaptive })
}

// rAF count-up from `from` to `to`; the last frame is EXACTLY `to`. ms = 0 jumps straight there.
export function useCountUp(to, ms, { from = 0, ease = (t) => 1 - Math.pow(1 - t, 3) } = {}) {
  const [v, setV] = useState(ms > 0 ? from : to)
  useEffect(() => {
    if (!(ms > 0) || !Number.isFinite(to)) { setV(to); return undefined }
    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / ms)
      setV(t >= 1 ? to : from + (to - from) * ease(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, from]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
