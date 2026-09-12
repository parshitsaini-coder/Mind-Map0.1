import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad2 = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Parses a 'YYYY-MM-DD' string as a local date (avoids the UTC-shift bug
// `new Date('YYYY-MM-DD')` has in the browser).
const parseISO = (value) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Fixed 6-week (42-cell) grid so the panel's height never jumps between
// months — each cell flags whether it belongs to the displayed month.
const buildGrid = (viewYear, viewMonth) => {
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date, inMonth: date.getMonth() === viewMonth }
  })
}

// Themed, fast-opening replacement for the native `<input type="date">` —
// matches the app's sage/cream/accent palette, opens with a quick spring
// (no per-cell stagger, so it feels instant) and gives a proper month-grid
// calendar instead of the browser's native picker.
//
// The calendar itself is rendered through a portal straight onto
// `document.body`, positioned with `fixed` coordinates measured from the
// trigger button — not nested `absolute` inside the panel. Every place this
// picker is used (the Node Inspector in particular) sits inside a scrollable
// sidebar full of framer-motion sections, each of which gets its own CSS
// stacking context; a plain nested `absolute` popover can't reliably paint
// above *later* siblings in a setup like that (it only wins within its own
// local context), which is what caused the calendar to render interleaved
// with the Notes/Whiteboard/Linked Nodes/Icon section text beneath it. A
// portal sidesteps all of that — it paints on top of literally everything,
// unconditionally.
export default function DatePicker({ value, onChange, placeholder = 'Pick a date', className = '' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const selected = useMemo(() => parseISO(value), [value])
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(() => selected || today)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!open) setViewDate(selected || today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open])

  // Position the portal against the trigger button every time it opens, and
  // keep it glued there through any ancestor scroll/resize while it's open
  // (the sidebar itself scrolls independently of the window).
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 200
      const margin = 8
      let left = rect.left
      if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - width - margin)
      const openUpward = rect.bottom + 320 > window.innerHeight && rect.top > 320
      setCoords({
        left,
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (buttonRef.current?.contains(e.target)) return
      if (popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const grid = useMemo(() => buildGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])
  const shiftMonth = (delta) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))

  const displayLabel = selected
    ? `${MONTH_NAMES[selected.getMonth()].slice(0, 3)} ${pad2(selected.getDate())}, ${selected.getFullYear()}`
    : placeholder

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-[var(--color-sage)] bg-white/60 px-1.5 py-1 text-left text-[10px] transition-transform duration-100 active:scale-[0.98]"
        style={{ color: selected ? 'var(--color-ink)' : 'var(--color-slate)' }}
      >
        {displayLabel}
        <Calendar size={11} style={{ color: 'var(--color-slate)', flexShrink: 0 }} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -4, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 700, damping: 34, mass: 0.4 }}
              style={{
                backgroundColor: 'var(--color-cream)',
                borderColor: 'var(--color-sage)',
                transformOrigin: coords.bottom !== undefined ? 'bottom left' : 'top left',
                position: 'fixed',
                left: coords.left,
                top: coords.top,
                bottom: coords.bottom,
              }}
              className="z-[200] w-[200px] rounded-lg border p-2 shadow-xl"
            >
              {/* Month header */}
              <div className="mb-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="flex h-5 w-5 items-center justify-center rounded-md transition-transform duration-100 hover:bg-[var(--color-sage)] active:scale-90"
                  style={{ color: 'var(--color-ink)' }}
                  title="Previous month"
                >
                  <ChevronLeft size={12} />
                </button>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${viewDate.getFullYear()}-${viewDate.getMonth()}`}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 3 }}
                    transition={{ duration: 0.1 }}
                    className="text-[10px] font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </motion.span>
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="flex h-5 w-5 items-center justify-center rounded-md transition-transform duration-100 hover:bg-[var(--color-sage)] active:scale-90"
                  style={{ color: 'var(--color-ink)' }}
                  title="Next month"
                >
                  <ChevronRight size={12} />
                </button>
              </div>

              {/* Weekday row */}
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="flex h-5 items-center justify-center text-[8px] font-semibold uppercase"
                    style={{ color: 'var(--color-slate)' }}
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Day grid */}
              <div key={`${viewDate.getFullYear()}-${viewDate.getMonth()}-grid`} className="grid grid-cols-7 gap-0.5">
                {grid.map(({ date, inMonth }, idx) => {
                  const isSelected = sameDay(date, selected)
                  const isToday = sameDay(date, today)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { onChange(toISO(date)); setOpen(false) }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[9.5px] font-medium transition-transform duration-75 hover:scale-110 hover:bg-black/5 active:scale-90"
                      style={{
                        color: !inMonth ? 'var(--color-slate)' : isSelected ? 'var(--color-cream)' : 'var(--color-ink)',
                        opacity: inMonth ? 1 : 0.32,
                        backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
                        boxShadow: isSelected
                          ? '0 2px 6px rgba(245,203,92,0.55)'
                          : isToday
                            ? 'inset 0 0 0 1px var(--color-accent)'
                            : 'none',
                      }}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Footer shortcuts */}
              <div className="mt-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false) }}
                  className="flex-1 rounded-md border py-1 text-[9px] font-medium transition-colors duration-100 hover:bg-[var(--color-sage)]"
                  style={{ borderColor: 'var(--color-sage)', color: 'var(--color-slate)' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => { onChange(toISO(today)); setOpen(false); setViewDate(today) }}
                  className="flex-1 rounded-md border py-1 text-[9px] font-medium transition-colors duration-100"
                  style={{ borderColor: 'var(--color-accent)', color: 'var(--color-ink)' }}
                >
                  Today
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
