import { useEffect, useMemo, useRef, useState } from 'react'
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
// that `new Date('YYYY-MM-DD')` has in the browser).
const parseISO = (value) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Builds a fixed 6-week (42-cell) grid for the given month so the panel's
// height never jumps between months — each cell also flags whether it
// belongs to the displayed month or is a leading/trailing filler day.
const buildGrid = (viewYear, viewMonth) => {
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = firstOfMonth.getDay() // 0 = Sunday
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date, inMonth: date.getMonth() === viewMonth }
  })
}

// A themed replacement for the native `<input type="date">` — same
// open/close spring animation and card styling as the Stock/Time frame
// dropdowns elsewhere in this form, plus a proper month-grid calendar
// instead of the browser's inconsistent native picker.
export default function DatePicker({ value, onChange, inputCls }) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseISO(value), [value])
  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(() => selected || today)
  const rootRef = useRef(null)

  // Keep the visible month in sync if the value changes from outside
  // (e.g. switching which trade is being edited) while the panel is closed.
  useEffect(() => {
    if (!open) setViewDate(selected || today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const grid = useMemo(() => buildGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])

  const shiftMonth = (delta) => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))

  const displayLabel = selected
    ? `${MONTH_NAMES[selected.getMonth()].slice(0, 3)} ${pad2(selected.getDate())}, ${selected.getFullYear()}`
    : 'Pick a date'

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between text-left`}
        style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
      >
        {displayLabel}
        <Calendar size={12} style={{ color: 'var(--ta-slate)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top left' }}
            className="absolute left-0 top-full z-30 mt-1 w-[210px] rounded-lg border p-2 shadow-lg"
          >
            {/* Month header */}
            <div className="mb-1.5 flex items-center justify-between">
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => shiftMonth(-1)}
                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-ink)' }}
                title="Previous month"
              >
                <ChevronLeft size={12} />
              </motion.button>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${viewDate.getFullYear()}-${viewDate.getMonth()}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="text-[10px] font-semibold"
                  style={{ color: 'var(--ta-ink)' }}
                >
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </motion.span>
              </AnimatePresence>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => shiftMonth(1)}
                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-ink)' }}
                title="Next month"
              >
                <ChevronRight size={12} />
              </motion.button>
            </div>

            {/* Weekday row */}
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={i}
                  className="flex h-5 items-center justify-center text-[8px] font-semibold uppercase"
                  style={{ color: 'var(--ta-slate)' }}
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <motion.div
              key={`${viewDate.getFullYear()}-${viewDate.getMonth()}-grid`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.14 }}
              className="grid grid-cols-7 gap-0.5"
            >
              {grid.map(({ date, inMonth }, idx) => {
                const isSelected = sameDay(date, selected)
                const isToday = sameDay(date, today)
                return (
                  <motion.button
                    key={idx}
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { onChange(toISO(date)); setOpen(false) }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[9.5px] font-medium transition-colors hover:bg-black/5"
                    style={{
                      color: !inMonth ? 'var(--ta-slate)' : isSelected ? '#fffcf2' : 'var(--ta-ink)',
                      opacity: inMonth ? 1 : 0.32,
                      backgroundColor: isSelected ? 'var(--ta-accent)' : 'transparent',
                      boxShadow: isToday && !isSelected ? 'inset 0 0 0 1px var(--ta-accent)' : 'none',
                    }}
                  >
                    {date.getDate()}
                  </motion.button>
                )
              })}
            </motion.div>

            {/* Today shortcut */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => { onChange(toISO(today)); setOpen(false); setViewDate(today) }}
              className="mt-1.5 w-full rounded-md border py-1 text-[9px] font-medium transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
            >
              Today
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
