import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import {
  FIELD_HEADER_COLORS,
  CARD_GRID_COLS,
  resolveCardFields,
  daysInMonth,
  dateKey,
  isValueFilled,
  WEEKDAY_SHORT,
  WEEKDAY_COLORS,
} from '../../utils/strategyTesterFields'
import FieldCell from './FieldCell'
import CardAdjustPopup from './CardAdjustPopup'

// Card alternative to StrategyTesterTable — same data, same store actions and
// the very same editable FieldCell widgets, laid out as one card per day
// instead of one wide row. Each card groups the day's fields under their
// strategy, so a strategy with many columns (e.g. 3 setups x 6 fields) reads
// top-to-bottom instead of needing horizontal scrolling. Respects the weekday
// filter and hidden strategies just like the list view.
//
// Animation is opacity-only (no transform left behind) so the fixed-position
// popups opened from inside a cell keep the viewport as their containing block.
export default function StrategyTesterCards() {
  const strategies = useStrategyTesterStore((s) => s.strategies)
  const entries = useStrategyTesterStore((s) => s.entries)
  const year = useStrategyTesterStore((s) => s.year)
  const month = useStrategyTesterStore((s) => s.month)
  const visibleWeekdays = useStrategyTesterStore((s) => s.visibleWeekdays) || [0, 1, 2, 3, 4, 5, 6]
  const cardCols = useStrategyTesterStore((s) => s.cardCols) || 0
  const [hideEmpty, setHideEmpty] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const visibleStrategies = useMemo(
    () => strategies.filter((st) => !st.hidden && st.fields.length > 0),
    [strategies]
  )

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const days = useMemo(() => {
    const numDays = daysInMonth(year, month)
    return Array.from({ length: numDays }, (_, i) => i + 1)
      .filter((d) => visibleWeekdays.includes(new Date(year, month, d).getDay()))
      .map((day) => {
        const dk = dateKey(year, month, day)
        const filled = visibleStrategies.some((st) =>
          st.fields.some((f) => isValueFilled(f.type, entries?.[st.id]?.[dk]?.[f.id]))
        )
        return { day, dk, wd: new Date(year, month, day).getDay(), filled }
      })
  }, [year, month, visibleWeekdays, visibleStrategies, entries])

  const shown = hideEmpty ? days.filter((d) => d.filled) : days
  const filledCount = days.filter((d) => d.filled).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
          {filledCount} of {days.length} days filled
        </span>
        <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAdjustOpen(true)}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
          title="Move and resize the fields inside each card"
        >
          <SlidersHorizontal size={10} />
          Adjust card
        </button>
        <button
          type="button"
          onClick={() => setHideEmpty((v) => !v)}
          aria-pressed={hideEmpty}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: hideEmpty ? 'var(--ta-accent)' : 'var(--ta-bg)',
            color: hideEmpty ? '#fffcf2' : 'var(--ta-ink)',
          }}
        >
          {hideEmpty ? <EyeOff size={10} /> : <Eye size={10} />}
          {hideEmpty ? 'Showing filled days' : 'Hide empty days'}
        </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {visibleStrategies.length === 0 ? (
          <p className="p-6 text-center text-[11px]" style={{ color: 'var(--ta-slate)' }}>
            No strategy with fields yet — switch to List and click a strategy's + to add a field.
          </p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-[11px]" style={{ color: 'var(--ta-slate)' }}>
            No filled days this month.
          </p>
        ) : (
          <div
            key={`${year}-${month}-${hideEmpty}`}
            className={`grid gap-2 pb-2 ${cardCols ? '' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}
            style={cardCols ? { gridTemplateColumns: `repeat(${cardCols}, minmax(0, 1fr))` } : undefined}
          >
            {shown.map(({ day, dk, wd, filled }, i) => {
              const isToday = isCurrentMonth && today.getDate() === day
              const rowLabel = `${day} ${WEEKDAY_SHORT[wd]}`
              return (
                <motion.div
                  key={dk}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.22, delay: Math.min(i, 10) * 0.02 }}
                  className="flex flex-col gap-1.5 rounded-xl border p-2"
                  style={{
                    backgroundColor: 'var(--ta-surface)',
                    borderColor: isToday ? 'var(--ta-accent)' : 'var(--ta-slate)',
                    boxShadow: isToday ? '0 0 0 1px var(--ta-accent)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-extrabold leading-none" style={{ color: 'var(--ta-ink)' }}>
                      {day}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
                      style={{ backgroundColor: `color-mix(in srgb, ${WEEKDAY_COLORS[wd]} 20%, transparent)`, color: WEEKDAY_COLORS[wd] }}
                    >
                      {WEEKDAY_SHORT[wd]}
                    </span>
                    {isToday && (
                      <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}>
                        Today
                      </span>
                    )}
                    <span className="ml-auto text-[8px] font-semibold" style={{ color: filled ? '#16a34a' : 'var(--ta-slate)', opacity: filled ? 1 : 0.6 }}>
                      {filled ? '● filled' : '○ empty'}
                    </span>
                  </div>

                  {visibleStrategies.map((st) => (
                    <div key={st.id} className="rounded-lg border p-1.5" style={{ borderColor: 'var(--tad-border)' }}>
                      <div className="mb-1 truncate text-[10px] font-bold" style={{ color: 'var(--ta-ink)' }}>
                        {st.name}
                      </div>
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${CARD_GRID_COLS}, minmax(0, 1fr))` }}>
                        {resolveCardFields(st).map(({ field: f, w, h }) => {
                          const [c1] = FIELD_HEADER_COLORS[f.type] || ['#64748b']
                          return (
                            <div
                              key={f.id}
                              className="flex min-h-[38px] flex-col items-stretch rounded-md border px-1 pb-0.5 pt-0.5"
                              style={{ borderColor: 'var(--tad-border)', gridColumn: `span ${w}`, height: h || undefined }}
                            >
                              <span className="truncate text-center text-[7.5px] font-bold uppercase tracking-wide" style={{ color: c1 }}>
                                {f.label}
                              </span>
                              <div className="flex min-h-[22px] flex-1 items-center justify-center">
                                <FieldCell
                                  strategyId={st.id}
                                  field={f}
                                  dk={dk}
                                  rowLabel={rowLabel}
                                  value={entries?.[st.id]?.[dk]?.[f.id]}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <AnimatePresence>
        {adjustOpen && <CardAdjustPopup strategies={visibleStrategies} onClose={() => setAdjustOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
