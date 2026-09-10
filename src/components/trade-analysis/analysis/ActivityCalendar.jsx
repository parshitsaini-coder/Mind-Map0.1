import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarRange, Target, ShieldAlert, Hourglass, PlusCircle } from 'lucide-react'
import { getCalendarMonths } from '../../../utils/tradeAnalytics'
import { Card, CardTitle, EmptyHint, STATUS_COLOR } from './primitives'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const VISIBLE_MONTHS = 4

// Step 10 — its own file per the master prompt, since it's the most
// involved widget: a multi-month grid with per-day outcome markers, a
// prev/next window, and a legend. `offset` shifts the 4-month window back
// in time (0 = ending on the current month).
export default function ActivityCalendar({ trades }) {
  const [offset, setOffset] = useState(0)
  // getCalendarMonths always ends "now" — to page backwards we fake `now`
  // by asking for offset+VISIBLE_MONTHS months and slicing the earliest
  // VISIBLE_MONTHS of that window.
  const months = getCalendarMonths(trades, VISIBLE_MONTHS + offset).slice(0, VISIBLE_MONTHS)
  const rangeLabel = months.length ? `${monthShort(months[0].label)} — ${monthShort(months[months.length - 1].label)}` : ''

  return (
    <Card delay={0.05}>
      <div className="mb-2 flex items-center justify-between">
        <CardTitle icon={CalendarRange} title="Activity Calendar" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o + 1)}
            title="Earlier months"
            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--ta-ink)' }}
          >
            <ChevronLeft size={12} />
          </button>
          <span className="min-w-[110px] text-center text-[9px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
            {rangeLabel}
          </span>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            title="Later months"
            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-black/5 disabled:opacity-30"
            style={{ color: 'var(--ta-ink)' }}
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {trades.length === 0 ? (
        <EmptyHint>Your trade calendar will fill in once you start logging.</EmptyHint>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.25 }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {months.map((m) => (
              <motion.div
                key={m.label}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--ta-bg)' }}
                variants={{ hidden: { opacity: 0, y: 14, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1 } }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className="px-1.5 py-1 text-center text-[8.5px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: 'var(--ta-ink)' }}
                >
                  {m.label}
                </div>
                <div className="grid grid-cols-7 gap-[2px] p-1">
                  {DOW.map((d, i) => (
                    <div key={i} className="text-center text-[7px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
                      {d}
                    </div>
                  ))}
                  {m.cells.map((cell, i) => (
                    <DayCell key={i} cell={cell} />
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px]" style={{ color: 'var(--ta-slate)' }}>
            <LegendItem color={STATUS_COLOR['Target Hit'].solid} label="Profit day" />
            <LegendItem color={STATUS_COLOR['SL Hit'].solid} label="Loss day" />
            <LegendItem color={STATUS_COLOR.Pending.solid} label="Pending only" />
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border-2" style={{ borderColor: 'var(--ta-accent)' }} />
              Today
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

function monthShort(label) {
  return label.split(' ')[0].slice(0, 3) + ' ' + label.split(' ')[1]
}

function LegendItem({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function DayCell({ cell }) {
  if (!cell) return <div className="aspect-square" />
  const today = new Date()
  const isToday =
    cell.date.getFullYear() === today.getFullYear() &&
    cell.date.getMonth() === today.getMonth() &&
    cell.date.getDate() === today.getDate()

  let dot = null
  if (cell.targetHit > 0) dot = <Target size={7} style={{ color: STATUS_COLOR['Target Hit'].solid }} />
  else if (cell.slHit > 0) dot = <ShieldAlert size={7} style={{ color: STATUS_COLOR['SL Hit'].solid }} />
  else if (cell.pending > 0) dot = <Hourglass size={7} style={{ color: STATUS_COLOR.Pending.solid }} />
  else if (cell.added > 0) dot = <PlusCircle size={7} style={{ color: 'var(--ta-accent)' }} />

  return (
    <div
      className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[3px]"
      style={{
        outline: isToday ? '1.5px solid var(--ta-accent)' : 'none',
        outlineOffset: -1,
        backgroundColor: cell.added > 0 ? 'color-mix(in srgb, var(--ta-surface) 80%, var(--ta-accent) 20%)' : 'transparent',
      }}
      title={cell.added > 0 ? `${cell.date.toDateString()}: ${cell.added} trade${cell.added > 1 ? 's' : ''}` : cell.date.toDateString()}
    >
      <span className="text-[7.5px] font-medium" style={{ color: 'var(--ta-ink)' }}>{cell.day}</span>
      {dot}
    </div>
  )
}
