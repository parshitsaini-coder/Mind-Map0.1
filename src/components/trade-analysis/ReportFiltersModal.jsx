import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  FileDown,
  Loader2,
  CalendarRange,
  Gauge,
  SlidersHorizontal,
  Layers,
  Clock3,
  ArrowLeftRight,
  CheckCircle2,
  ShieldCheck,
  Eraser,
  ChevronDown,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES } from '../../data/instruments'
import { applyFilters } from '../../utils/tradeFilters'
import { isoDate, daysAgoIso, DATE_RANGE_PRESETS } from '../../utils/dateRangePresets'
import AnimatedMultiSelect from './AnimatedMultiSelect'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']
const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']
const ALL_PAIRS = [...INDIAN_STOCKS, ...FOREX_PAIRS, ...COMMODITIES]

// PDF quality presets — how far screenshots get downscaled/compressed
// before being embedded (see generateTradeReport.js's QUALITY_PRESETS,
// which these ids map straight into). Higher quality = crisper trade
// screenshots but a bigger PDF file; Low trades that off for a small file
// that's easy to WhatsApp/email.
const QUALITY_LEVELS = [
  { id: 'low', label: 'Low', hint: 'Smallest file' },
  { id: 'standard', label: 'Standard', hint: 'Balanced' },
  { id: 'high', label: 'High', hint: 'Best quality' },
]

// Step: report-scoping popup. Sits between clicking "Download Report"
// and actually generating the PDF. Originally only scoped by date + one
// instrument type; now exposes the *same* filter fields as the main
// "Filters" popover (pair, type, time frame, direction, status,
// validation rule, date range) plus a PDF quality picker, so the report
// can be narrowed exactly like the table can — via the one shared
// `applyFilters` predicate (utils/tradeFilters.js) that already backs
// FiltersPopover/TradesTable/TradeCards, so "match" here means the same
// thing it means everywhere else in the app.
export default function ReportFiltersModal({ open, onClose, trades, busy, onGenerate, validationRules = [], validationCategories = [] }) {
  const [presetId, setPresetId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [types, setTypes] = useState([]) // empty = all types
  const [pair, setPair] = useState([])
  const [timeframe, setTimeframe] = useState([])
  const [direction, setDirection] = useState([])
  const [status, setStatus] = useState([])
  const [validationRuleId, setValidationRuleId] = useState([])
  const [quality, setQuality] = useState('standard')
  const [moreOpen, setMoreOpen] = useState(false)

  const validationRuleOptions = useMemo(
    () =>
      [...validationCategories]
        .sort((a, b) => a.order - b.order)
        .flatMap((cat) =>
          validationRules
            .filter((r) => r.categoryId === cat.id)
            .sort((a, b) => a.order - b.order)
            .map((r) => ({ value: r.id, label: `${cat.name} · ${r.label}` }))
        ),
    [validationRules, validationCategories]
  )

  const applyPreset = (preset) => {
    setPresetId(preset.id)
    if (preset.days == null) {
      // "All time" — clear the range entirely.
      if (preset.id === 'all') {
        setDateFrom('')
        setDateTo('')
      }
      // "Custom range" — leave whatever the person already typed.
      return
    }
    setDateFrom(daysAgoIso(preset.days))
    setDateTo(isoDate(new Date()))
  }

  const toggleType = (t) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  const toggleDirection = (d) => {
    setDirection((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }
  const toggleArr = (setter) => (v) => setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const filteredTrades = useMemo(
    () => applyFilters(trades, { pair, instrumentType: types, timeframe, direction, status, validationRuleId, dateFrom, dateTo }),
    [trades, pair, types, timeframe, direction, status, validationRuleId, dateFrom, dateTo]
  )

  const extraActiveCount = [pair, timeframe, direction, status, validationRuleId].filter((a) => a.length > 0).length

  const fieldLabelCls = 'text-[10px] font-medium uppercase tracking-wide flex items-center gap-1'
  const inputCls =
    'w-full rounded-md border bg-white/70 px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-1'

  const handleGenerate = () => {
    if (busy || filteredTrades.length === 0) return
    onGenerate(filteredTrades, { dateFrom, dateTo, types }, quality)
  }

  const pillCls = (active, activeColor = 'var(--ta-accent)') => ({
    className: 'rounded-md border py-1 text-[9.5px] font-medium transition-colors',
    style: active
      ? { backgroundColor: activeColor, borderColor: activeColor, color: '#fffcf2' }
      : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' },
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={busy ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="ta-card-glow flex max-h-[86vh] w-full max-w-[380px] flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5"
              style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)' }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                <CalendarRange size={12} color="#fffcf2" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--ta-ink)' }}>
                  Download Report
                </p>
                <p className="truncate text-[9px] leading-tight" style={{ color: 'var(--ta-slate)' }}>
                  Choose what to include
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                disabled={busy}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-40"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={13} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="ta-scroll flex flex-col gap-3 overflow-y-auto px-3.5 py-3">
              {/* Date range presets */}
              <div className="flex flex-col gap-1">
                <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Date range</span>
                <div className="grid grid-cols-2 gap-1">
                  {DATE_RANGE_PRESETS.map((p) => {
                    const active = presetId === p.id
                    const cls = pillCls(active)
                    return (
                      <motion.button key={p.id} type="button" whileTap={{ scale: 0.94 }} onClick={() => applyPreset(p)} {...cls}>
                        {p.label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Custom from/to — always editable; picking dates here
                  auto-switches the preset pill to "Custom range" so the
                  UI never shows a stale preset next to a hand-typed
                  range. */}
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-1">
                  <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPresetId('custom')
                    }}
                    className={inputCls}
                    style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPresetId('custom')
                    }}
                    className={inputCls}
                    style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                  />
                </label>
              </div>

              {/* Instrument type */}
              <div className="flex flex-col gap-1">
                <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Type</span>
                <div className="grid grid-cols-4 gap-1">
                  {['All', ...INSTRUMENT_TYPES].map((t) => {
                    const isAll = t === 'All'
                    const active = isAll ? types.length === 0 : types.includes(t)
                    const cls = pillCls(active)
                    return (
                      <motion.button
                        key={t}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => (isAll ? setTypes([]) : toggleType(t))}
                        {...cls}
                      >
                        {t}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Toggle for the rest of the filter system — collapsed by
                  default so the common case (just a date range) stays
                  quick, but every field FiltersPopover has is one tap
                  away. */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setMoreOpen((o) => !o)}
                className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-colors"
                style={
                  moreOpen
                    ? { borderColor: 'var(--ta-accent)', color: 'var(--ta-ink)', backgroundColor: 'color-mix(in srgb, var(--ta-accent) 8%, transparent)' }
                    : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
                }
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal size={11} style={{ color: 'var(--ta-accent)' }} />
                  More filters
                  {extraActiveCount > 0 && (
                    <span
                      className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8.5px] font-bold leading-none"
                      style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                    >
                      {extraActiveCount}
                    </span>
                  )}
                </span>
                <motion.span
                  animate={{ rotate: moreOpen ? 180 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex"
                  style={{ color: 'var(--ta-slate)' }}
                >
                  <ChevronDown size={12} />
                </motion.span>
              </motion.button>

              {/* Persistent CSS-grid collapse (not framer-motion's
                  height:'auto') — that pattern measures height once in
                  JS and locks it, so when a dropdown inside (Pair/Time
                  frame/etc.) opens and grows taller afterwards, the
                  locked height clips the rest of the tray. grid-rows
                  is driven natively by the browser every frame, so it
                  always fits whatever is actually inside, dropdowns
                  included. Content stays mounted even when collapsed
                  so selections aren't lost while it's hidden. */}
              <div
                className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                style={{
                  gridTemplateRows: moreOpen ? '1fr' : '0fr',
                  opacity: moreOpen ? 1 : 0,
                  pointerEvents: moreOpen ? 'auto' : 'none',
                }}
              >
                <div className="overflow-hidden">
                  <div className="pt-3" aria-hidden={!moreOpen}>
                    {/* Grouped in its own tray so it reads as a distinct
                        "advanced" cluster instead of blending into the
                        date/type fields above it. */}
                    <div
                      className="flex flex-col gap-2.5 rounded-lg border p-2.5"
                      style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 45%, transparent)' }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {/* Pair */}
                        <label className="flex flex-col gap-1">
                          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                            <Layers size={9} />
                            Pair
                          </span>
                          <AnimatedMultiSelect
                            values={pair}
                            onToggle={toggleArr(setPair)}
                            inputCls={inputCls}
                            placeholder="All pairs"
                            searchable
                            searchPlaceholder="Search pair..."
                            floating={false}
                            options={ALL_PAIRS.map((i) => ({ value: i.symbol, label: i.symbol }))}
                          />
                        </label>

                        {/* Time frame */}
                        <label className="flex flex-col gap-1">
                          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                            <Clock3 size={9} />
                            Time frame
                          </span>
                          <AnimatedMultiSelect
                            values={timeframe}
                            onToggle={toggleArr(setTimeframe)}
                            inputCls={inputCls}
                            placeholder="All time frames"
                            floating={false}
                            options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
                          />
                        </label>
                      </div>

                      {/* Direction */}
                      <div className="flex flex-col gap-1">
                        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                          <ArrowLeftRight size={9} />
                          Direction
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {['All', 'Buy', 'Sell'].map((d) => {
                            const isAll = d === 'All'
                            const active = isAll ? direction.length === 0 : direction.includes(d)
                            const activeColor = d === 'Buy' ? '#16a34a' : d === 'Sell' ? '#dc2626' : 'var(--ta-accent)'
                            const cls = pillCls(active, activeColor)
                            return (
                              <motion.button
                                key={d}
                                type="button"
                                whileTap={{ scale: 0.94 }}
                                onClick={() => (isAll ? setDirection([]) : toggleDirection(d))}
                                {...cls}
                              >
                                {d}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Status */}
                        <label className="flex flex-col gap-1">
                          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                            <CheckCircle2 size={9} />
                            Status
                          </span>
                          <AnimatedMultiSelect
                            values={status}
                            onToggle={toggleArr(setStatus)}
                            inputCls={inputCls}
                            placeholder="All statuses"
                            floating={false}
                            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                          />
                        </label>

                        {/* Validation rule */}
                        <label className="flex flex-col gap-1">
                          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                            <ShieldCheck size={9} />
                            Rule met
                          </span>
                          <AnimatedMultiSelect
                            values={validationRuleId}
                            onToggle={toggleArr(setValidationRuleId)}
                            inputCls={inputCls}
                            disabled={validationRuleOptions.length === 0}
                            placeholder={validationRuleOptions.length === 0 ? 'No rules yet' : 'Any rule'}
                            floating={false}
                            options={validationRuleOptions}
                          />
                        </label>
                      </div>

                      {extraActiveCount > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            setPair([])
                            setTimeframe([])
                            setDirection([])
                            setStatus([])
                            setValidationRuleId([])
                          }}
                          className="flex items-center gap-1 self-start text-[10px] font-medium underline-offset-2 hover:underline"
                          style={{ color: 'var(--ta-slate)' }}
                        >
                          <Eraser size={10} />
                          Clear these filters
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF quality */}
              <div className="flex flex-col gap-1">
                <span className={`${fieldLabelCls} flex items-center gap-1`} style={{ color: 'var(--ta-slate)' }}>
                  <Gauge size={10} />
                  PDF quality
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {QUALITY_LEVELS.map((q) => {
                    const active = quality === q.id
                    return (
                      <motion.button
                        key={q.id}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setQuality(q.id)}
                        title={q.hint}
                        className="flex flex-col items-center gap-0.5 rounded-md border py-1.5 transition-colors"
                        style={
                          active
                            ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)', color: '#fffcf2' }
                            : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
                        }
                      >
                        <span className="text-[10px] font-semibold">{q.label}</span>
                        <span className="text-[8px] opacity-80">{q.hint}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Live count of what will actually go into the PDF, so
                  picking an empty range/type is obvious before hitting
                  Generate rather than after opening a blank-ish report. */}
              <p className="text-[10px]" style={{ color: 'var(--ta-slate)' }}>
                {filteredTrades.length} of {trades.length} trade{trades.length === 1 ? '' : 's'} match
                {filteredTrades.length === trades.length ? '' : ' this selection'}.
              </p>
            </div>

            {/* Footer */}
            <div
              className="flex shrink-0 items-center justify-between border-t px-3.5 py-2.5"
              style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)' }}
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                disabled={busy}
                className="text-[10.5px] font-medium underline-offset-2 hover:underline disabled:opacity-40"
                style={{ color: 'var(--ta-slate)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={filteredTrades.length ? { scale: 1.04 } : {}}
                whileTap={filteredTrades.length ? { scale: 0.94 } : {}}
                onClick={handleGenerate}
                disabled={busy || filteredTrades.length === 0}
                title={filteredTrades.length === 0 ? 'No trades match this selection' : undefined}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: '#0f172a' }}
              >
                <motion.span
                  className="flex"
                  animate={busy ? { rotate: 360 } : { rotate: 0 }}
                  transition={busy ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                >
                  {busy ? <Loader2 size={12} /> : <FileDown size={12} />}
                </motion.span>
                {busy ? 'Building…' : `Generate PDF (${filteredTrades.length})`}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
