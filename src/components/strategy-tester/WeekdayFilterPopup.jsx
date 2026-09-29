import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Tick } from './motionBits'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'

// [weekday index (JS getDay), label] — Monday-first, the way a trading
// week reads.
const DAYS = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [0, 'Sunday'],
]

// Right-click on the DATE header → choose which weekdays appear as rows.
export default function WeekdayFilterPopup({ x, y, onClose }) {
  const visible = useStrategyTesterStore((s) => s.visibleWeekdays)
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)
  const rootRef = useRef(document.querySelector('[data-ta-theme]') || document.body)
  const st = useStrategyTesterStore.getState

  useLayoutEffect(() => {
    const root = rootRef.current.getBoundingClientRect()
    const W = 192
    const H = popRef.current?.offsetHeight || 320
    const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))
    setPos({ left: left - root.left, top: top - root.top })
  }, [x, y])

  useEffect(() => {
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target)) onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const presetBtn = 'rounded-full px-2 py-0.5 text-[9px] font-semibold'

  return createPortal(
    <motion.div
      ref={popRef}
      data-st-popover
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="ta-glass-popover fixed z-[100] flex w-48 flex-col gap-1.5 rounded-lg border p-2 shadow-xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        transformOrigin: 'top left',
        backgroundColor: 'var(--ta-surface)',
        borderColor: 'var(--ta-slate)',
        color: 'var(--ta-ink)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          Show these days
        </p>
        <button type="button" onClick={onClose} style={{ color: 'var(--ta-slate)' }}>
          <X size={10} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => st().setVisibleWeekdays([0, 1, 2, 3, 4, 5, 6])}
          className={presetBtn}
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
        >
          All days
        </button>
        <button
          type="button"
          onClick={() => st().setVisibleWeekdays([1, 2, 3, 4, 5])}
          className={presetBtn}
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
        >
          Mon–Fri
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {DAYS.map(([idx, name]) => {
          const on = visible.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => st().toggleWeekday(idx)}
              className="st-cb flex items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-black/5"
            >
              <span
                className={`st-box flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border ${on ? 'is-on' : ''}`}
                style={{
                  borderColor: on ? 'var(--ta-accent)' : 'var(--ta-slate)',
                  backgroundColor: on ? 'var(--ta-accent)' : 'transparent',
                }}
              >
                {on && <Tick />}
              </span>
              <span className="text-[10px] font-medium">{name}</span>
            </button>
          )
        })}
      </div>
    </motion.div>,
    rootRef.current
  )
}
