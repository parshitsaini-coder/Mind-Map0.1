import { useEffect, useRef, useState } from 'react'
import { countAt, moneyText } from '../../lib/terminal/popupModel'
import { useTerminalStore } from '../../store/terminalStore'
import { useAnimMode } from './useAnimMode'

// Small motion helpers shared by the popup, the chart badges and the account numbers (Phase 13).

// P/L that counts from 0 to `to` and ends EXACTLY on the final value. animate=false shows the final value at once.
export function CountUp({ to, ms = 700, animate = true, format = moneyText }) {
  const [v, setV] = useState(animate ? 0 : to)
  useEffect(() => {
    if (!animate) { setV(to); return undefined }
    let raf = 0
    const t0 = performance.now()
    const step = (now) => {
      const t = (now - t0) / ms
      setV(countAt(to, t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, animate])
  return <span className="tabular-nums" data-final={countAt(to, 1)}>{format(v)}</span>
}

// Characters that roll in one after the other (price digits). Stagger is tiny so the whole thing stays under ~250 ms.
export function RollText({ text, animate = true }) {
  if (!animate) return <span className="tabular-nums">{text}</span>
  return (
    <span className="inline-flex tabular-nums" aria-label={text}>
      {[...String(text)].map((ch, i) => (
        <span key={i} aria-hidden="true" className="inline-block" style={{ animation: `tmSheetIn 220ms ${i * 18}ms cubic-bezier(0.2,0.9,0.3,1) both` }}>{ch === ' ' ? '\u00a0' : ch}</span>
      ))}
    </span>
  )
}

// Wraps a number: a 120 ms green / red flash when it changes (up / down). No layout change, no re-render of the parent.
export function FlashText({ value, className = '', style, children }) {
  const ref = useRef(null)
  const prev = useRef(value)
  const mode = useAnimMode()
  const on = useTerminalStore((s) => s.chartSettings.anim.flash)
  useEffect(() => {
    const el = ref.current
    const old = prev.current
    prev.current = value
    if (!el || mode !== 'full' || !on || !Number.isFinite(value) || !Number.isFinite(old) || value === old) return
    const cls = value > old ? 'tm-flash-up' : 'tm-flash-down'
    el.classList.remove('tm-flash-up', 'tm-flash-down')
    void el.offsetWidth // restart the animation
    el.classList.add(cls)
    const t = setTimeout(() => el.classList.remove(cls), 160)
    return () => clearTimeout(t)
  }, [value, mode, on])
  return <span ref={ref} className={`rounded-sm ${className}`} style={style}>{children}</span>
}
