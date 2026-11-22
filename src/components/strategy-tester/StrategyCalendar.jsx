import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Trophy,
  ArrowLeftRight,
  Scale,
  IndianRupee,
  Crosshair,
  StickyNote,
  Hash,
  Check,
  Tag,
  Tags,
  Type,
  Clock,
  Star,
  Link2,
} from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { daysInMonth, dateKey, weekdayFor, MONTH_NAMES, WEEKDAY_SHORT } from '../../utils/strategyTesterFields'
import { Card, CardTitle } from '../trade-analysis/analysis/primitives'
import { dayTotals } from '../../utils/strategyBreakdown'

const EASE = [0.16, 1, 0.3, 1]

// Day status → color, derived from that day's outcome field(s) if the
// strategy has one, else just "was anything logged at all".
const STATUS_STYLE = {
  win: { solid: '#16a34a', bg: 'rgba(22,163,74,0.16)' },
  loss: { solid: '#dc2626', bg: 'rgba(220,38,38,0.14)' },
  be: { solid: 'var(--ta-slate)', bg: 'rgba(120,120,120,0.14)' },
  logged: { solid: 'var(--ta-accent)', bg: 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' },
  empty: null,
}

// Reduce one day's row into a status + the bits worth showing at a
// glance (P&L) without pulling in every field type.
function dayStatus(strategy, strategyEntries, dk) {
  const totals = dayTotals(strategy, strategyEntries, dk)
  if (totals.entries === 0) return { status: 'empty', pnl: null, hasAny: false, totals }
  const pnlField = strategy.fields.find((f) => f.type === 'pnl')

  // Colour by the day's results across ALL its entries: more wins than losses
  // = win, more losses = loss, only breakevens = be, otherwise just "logged".
  let status = 'logged'
  if (totals.wins > totals.losses) status = 'win'
  else if (totals.losses > totals.wins) status = 'loss'
  else if (totals.wins === 0 && totals.be > 0) status = 'be'

  let pnl = null
  if (pnlField) {
    for (const { row } of totals.rows) {
      const raw = row[pnlField.id]
      const n = raw === '' || raw == null ? null : parseFloat(raw)
      if (n != null && !Number.isNaN(n)) pnl = (pnl ?? 0) + n
    }
  }

  return { status, pnl, hasAny: true, totals }
}

const FIELD_ICON = {
  buysell: ArrowLeftRight,
  outcome: Trophy,
  rrr: Scale,
  pnl: IndianRupee,
  sltarget: Crosshair,
  notes: StickyNote,
  number: Hash,
  checkbox: Check,
  select: Tag,
  multiselect: Tags,
  text: Type,
  time: Clock,
  rating: Star,
  link: Link2,
}

// Renders one field's value for the day-detail popup, in the same
// vocabulary as the table cells (B/S, W/L/BE, SL/TP…) instead of raw
// stored values.
function fieldValueLabel(field, value) {
  if (field.type === 'sltarget') {
    if (value === 'sl') return 'SL'
    if (value === 'target') return 'Target'
    const sl = value?.sl
    const tp = value?.target
    if ((sl ?? '') === '' && (tp ?? '') === '') return '—'
    return `SL ${sl || '—'} · TP ${tp || '—'}`
  }
  if (field.type === 'buysell') return value === 'buy' ? 'Buy' : value === 'sell' ? 'Sell' : '—'
  if (field.type === 'outcome') return value === 'win' ? 'Win' : value === 'loss' ? 'Loss' : value === 'be' ? 'Breakeven' : '—'
  if (field.type === 'checkbox') {
    if ((field.options || []).length > 0) {
      const names = (field.options || []).filter((o) => Array.isArray(value) && value.includes(o.id)).map((o) => o.label)
      return names.length ? names.join(', ') : '—'
    }
    return value ? 'Yes' : 'No'
  }
  if (field.type === 'multiselect') {
    const names = (field.options || []).filter((o) => Array.isArray(value) && value.includes(o.id)).map((o) => o.label)
    return names.length ? names.join(', ') : '—'
  }
  if (field.type === 'rating') return value ? `${value}/5 ★` : '—'
  if (field.type === 'select') return (field.options || []).find((o) => o.id === value)?.label || '—'
  if (value == null || value === '') return '—'
  return String(value)
}

function DayDetailPopup({ strategy, day, totals, onClose }) {
  const isFilled = (f, v) => {
    if (v == null) return false
    if (f.type === 'sltarget') return typeof v === 'string' ? v !== '' : (v.sl ?? '') !== '' || (v.target ?? '') !== ''
    if (Array.isArray(v)) return v.length > 0
    return v !== ''
  }
  const entries = totals.rows.map(({ row }) => strategy.fields.filter((f) => isFilled(f, row?.[f.id])))
  const chips = [
    { label: 'Entries', n: totals.entries, color: 'var(--ta-accent)', show: true },
    { label: 'SL', n: totals.sl, color: '#dc2626', show: totals.hasSl },
    { label: 'Target', n: totals.target, color: '#16a34a', show: totals.hasSl },
    { label: 'Buy', n: totals.buy, color: '#16a34a', show: totals.buy > 0 },
    { label: 'Sell', n: totals.sell, color: '#dc2626', show: totals.sell > 0 },
    { label: 'Win', n: totals.wins, color: '#16a34a', show: totals.wins > 0 },
    { label: 'Loss', n: totals.losses, color: '#dc2626', show: totals.losses > 0 },
  ].filter((c) => c.show)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.14, ease: EASE } }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xs flex-col gap-2 rounded-xl border p-3 shadow-2xl"
        style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
      >
        <div className="flex items-center gap-1.5">
          <CalendarDays size={12} style={{ color: 'var(--ta-accent)' }} />
          <span className="flex-1 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
            {weekdayFor(day.ymd[0], day.ymd[1], day.n)}, {day.n} {MONTH_NAMES[day.ymd[1]]}
          </span>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-black/5" style={{ color: 'var(--ta-slate)' }}>
            <X size={13} />
          </button>
        </div>

        {totals.entries === 0 ? (
          <p className="py-3 text-center text-[9.5px] italic" style={{ color: 'var(--ta-slate)' }}>
            Nothing logged for this day.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums"
                  style={{ backgroundColor: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}
                >
                  {c.label} {c.n}
                </span>
              ))}
            </div>
            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-0.5">
              {entries.map((filled, ei) => (
                <div key={totals.rows[ei].rk} className="flex flex-col gap-1">
                  {entries.length > 1 && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                      Entry {ei + 1}
                    </span>
                  )}
                  {filled.map((f, idx) => {
                    const Icon = FIELD_ICON[f.type] || Hash
                    return (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, delay: 0.06 + Math.min(idx, 8) * 0.035, ease: EASE }}
                        className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
                        style={{ backgroundColor: 'var(--ta-bg)' }}
                      >
                        <span className="flex items-center gap-1 truncate text-[9.5px] font-medium" style={{ color: 'var(--ta-slate)' }}>
                          <Icon size={10} style={{ color: 'var(--ta-accent)' }} />
                          {f.label}
                        </span>
                        <span className="shrink-0 text-[9.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                          {fieldValueLabel(f, totals.rows[ei].row[f.id])}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// Compact, real single-month calendar for the Analysis tab — one cell per
// calendar day (with the correct leading blanks so weekdays line up),
// colored green/red/gray from that day's outcome, P&L peeking through in
// small text, and a tap-to-inspect popup for everything else logged that
// day. Shares the store's year/month with the Table view, so paging here
// pages the table too. Deliberately small — this sits inside a Card next
// to the other stat widgets, not a full-screen calendar.
export default function StrategyCalendar({ strategy, entries }) {
  const year = useStrategyTesterStore((s) => s.year)
  const month = useStrategyTesterStore((s) => s.month)
  const [dir, setDir] = useState(1)
  const [openDay, setOpenDay] = useState(null) // { n, ymd: [y, m] } | null

  const nav = (delta) => {
    setDir(delta)
    useStrategyTesterStore.getState().goToMonth(delta)
  }
  const goToday = () => {
    const t = new Date()
    setDir(t.getFullYear() * 12 + t.getMonth() > year * 12 + month ? 1 : -1)
    useStrategyTesterStore.getState().goToToday()
  }

  const numDays = daysInMonth(year, month)
  const leadingBlanks = new Date(year, month, 1).getDay()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const cells = useMemo(() => {
    const strategyEntries = entries?.[strategy.id]
    const out = Array.from({ length: leadingBlanks }, () => null)
    for (let day = 1; day <= numDays; day++) {
      const dk = dateKey(year, month, day)
      out.push({ day, dk, ...dayStatus(strategy, strategyEntries, dk) })
    }
    return out
  }, [strategy, entries, year, month, leadingBlanks, numDays])

  const monthWins = cells.filter((c) => c?.status === 'win').length
  const monthLosses = cells.filter((c) => c?.status === 'loss').length

  return (
    <Card>
      <div className="mb-1.5 flex items-center justify-between">
        <CardTitle icon={CalendarDays} title="Calendar" subtitle={`${monthWins}W · ${monthLosses}L`} />
      </div>

      <div className="mx-auto flex w-full max-w-[260px] flex-col">
        {/* Month nav */}
        <div className="mb-1.5 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => nav(-1)}
            title="Previous month"
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ color: 'var(--ta-ink)', backgroundColor: 'var(--ta-bg)' }}
          >
            <ChevronLeft size={11} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={goToday}
            title="Jump to current month"
            className="rounded-full px-2 py-0.5 text-[9.5px] font-bold"
            style={{ color: 'var(--ta-ink)' }}
          >
            {MONTH_NAMES[month]} {year}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => nav(1)}
            title="Next month"
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ color: 'var(--ta-ink)', backgroundColor: 'var(--ta-bg)' }}
          >
            <ChevronRight size={11} />
          </motion.button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-[3px]">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="text-center text-[7.5px] font-bold uppercase" style={{ color: 'var(--ta-slate)', opacity: 0.7 }}>
              {d[0]}
            </div>
          ))}
        </div>

        {/* Day grid — slides in the direction of navigation */}
        <div className="relative mt-0.5 overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={`${year}-${month}`}
              custom={dir}
              initial={{ opacity: 0, x: 14 * dir }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 * dir }}
              transition={{ duration: 0.22, ease: EASE }}
              className="grid grid-cols-7 gap-[3px]"
            >
              {cells.map((cell, i) => {
                if (!cell) return <div key={`b${i}`} className="aspect-square" />
                const isToday = isCurrentMonth && today.getDate() === cell.day
                const style = STATUS_STYLE[cell.status]
                return (
                  <motion.button
                    key={cell.dk}
                    type="button"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.008, duration: 0.18, ease: EASE } }}
                    whileHover={{ scale: 1.12, zIndex: 2 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setOpenDay({ n: cell.day, ymd: [year, month] })}
                    title={cell.totals.entries ? `${cell.day} ${MONTH_NAMES[month]} — ${cell.totals.entries} entr${cell.totals.entries === 1 ? 'y' : 'ies'}${cell.totals.hasSl ? ` · SL ${cell.totals.sl} · Target ${cell.totals.target}` : ''} — tap for details` : `${cell.day} ${MONTH_NAMES[month]}`}
                    className="st-day relative flex aspect-square flex-col items-center justify-center gap-0 rounded-[5px]"
                    style={{
                      backgroundColor: style ? style.bg : 'transparent',
                      outline: isToday ? '1.5px solid var(--ta-accent)' : 'none',
                      outlineOffset: -1,
                    }}
                  >
                    <span
                      className="text-[8.5px] font-semibold leading-none"
                      style={{ color: style ? style.solid : 'var(--ta-ink)', opacity: style ? 1 : 0.55 }}
                    >
                      {cell.day}
                    </span>
                    {cell.totals.entries > 0 && (
                      <span
                        className="absolute right-[2px] top-[1px] text-[6px] font-bold leading-none"
                        style={{ color: 'var(--ta-slate)' }}
                      >
                        {cell.totals.entries}
                      </span>
                    )}
                    {cell.totals.hasSl && (cell.totals.sl > 0 || cell.totals.target > 0) && (
                      <span className="flex gap-[2px] text-[6px] font-bold leading-none">
                        {cell.totals.sl > 0 && <span style={{ color: '#dc2626' }}>{cell.totals.sl}</span>}
                        {cell.totals.target > 0 && <span style={{ color: '#16a34a' }}>{cell.totals.target}</span>}
                      </span>
                    )}
                    {cell.pnl != null && (
                      <span
                        className="text-[6px] font-bold leading-none"
                        style={{ color: cell.pnl >= 0 ? '#16a34a' : '#dc2626' }}
                      >
                        {cell.pnl >= 0 ? '+' : ''}
                        {Math.round(cell.pnl)}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 text-[7.5px]" style={{ color: 'var(--ta-slate)' }}>
          <LegendDot color={STATUS_STYLE.win.solid} label="Win" />
          <LegendDot color={STATUS_STYLE.loss.solid} label="Loss" />
          <LegendDot color={STATUS_STYLE.be.solid} label="BE" />
          <LegendDot color={STATUS_STYLE.logged.solid} label="Logged" />
          <span className="flex items-center gap-0.5">
            <span className="h-2 w-2 rounded-[3px]" style={{ border: '1.5px solid var(--ta-accent)' }} />
            Today
          </span>
          <span className="flex items-center gap-0.5">
            <b style={{ color: 'var(--ta-slate)' }}>n</b> entries ·<b style={{ color: '#dc2626' }}>SL</b>
            <b style={{ color: '#16a34a' }}>Target</b>
          </span>
        </div>
      </div>

      <AnimatePresence>
        {openDay && (
          <DayDetailPopup
            strategy={strategy}
            day={openDay}
            totals={dayTotals(strategy, entries?.[strategy.id], dateKey(openDay.ymd[0], openDay.ymd[1], openDay.n))}
            onClose={() => setOpenDay(null)}
          />
        )}
      </AnimatePresence>
    </Card>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-0.5">
      <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
