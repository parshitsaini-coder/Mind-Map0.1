import { useEffect, useRef, useState } from 'react'
import { useMotion } from './motionHooks'

// A number that flashes green / red for 120 ms when it changes (tabular numerals, no layout shift) and, with `count`,
// rolls from the old value to the new one. `fmt` turns the number into text.
export default function AnimNum({ value, fmt, count = false, testid, className = '', style }) {
  const mo = useMotion()
  const prev = useRef(value)
  const [shown, setShown] = useState(value)
  const [flash, setFlash] = useState('')
  const show = shown
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value || !Number.isFinite(value) || !Number.isFinite(from)) { setShown(value); return undefined }
    if (!mo.off) {
      setFlash(value > from ? 'tm-flash-up' : 'tm-flash-down')
      const t = setTimeout(() => setFlash(''), 140)
      if (!(count && mo.full)) { setShown(value); return () => clearTimeout(t) }
      let raf = 0
      const t0 = performance.now()
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 320)
        setShown(k >= 1 ? value : from + (value - from) * (1 - Math.pow(1 - k, 3)))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => { clearTimeout(t); cancelAnimationFrame(raf); setShown(value) }
    }
    setShown(value)
    return undefined
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span data-testid={testid} className={`${flash} rounded-sm tabular-nums ${className}`} style={style}>{fmt(show)}</span>
}
