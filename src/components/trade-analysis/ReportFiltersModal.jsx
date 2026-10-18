import { AnimatePresence, motion } from 'framer-motion'
import { stagger, rise, SPRING, AnimatedNumber, Tap, Chip, SectionLabel } from './motionKit'
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
  Target,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES, INDICES } from '../../data/instruments'
import { applyFilters } from '../../utils/tradeFilters'
import { isoDate, daysAgoIso, DATE_RANGE_PRESETS } from '../../utils/dateRangePresets'
import AnimatedMultiSelect from './AnimatedMultiSelect'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity', 'Index']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']
const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']
const ALL_PAIRS = [...INDIAN_STOCKS, ...FOREX_PAIRS, ...COMMODITIES, ...INDICES]

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
const QUALITY_BARS = { low: 1, standard: 2, high: 3 }

export default function ReportFiltersModal({ open, onClose, trades, busy, onGenerate, validationRules = [], validationCategories = [] }) {
  const [presetId, setPresetId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [types, setTypes] = useState([]) // empty = all types
  const [pair, setPair] = useState([])
  const [timeframe, setTimeframe] = useState([])
  const [direction, setDirection] = useState([])
  const [status, setStatus] = useState([])
  const [setupType, setSetupType] = useState([])
  const setupTypeOptions = useTradeAnalysisStore((s) => s.setupTypes)
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
    () => applyFilters(trades, { pair, instrumentType: types, timeframe, direction, status, setupType, validationRuleId, dateFrom, dateTo }),
    [trades, pair, types, timeframe, direction, status, setupType, validationRuleId, dateFrom, dateTo]
  )

  const extraActiveCount = [pair, timeframe, direction, status, setupType, validationRuleId].filter((a) => a.length > 0).length

  const fieldLabelCls = 'text-[10px] font-medium uppercase tracking-wide flex items-center gap-1'
  const inputCls =
    'w-full rounded-md border bg-white/70 px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-1'

  const handleGenerate = () => {
    if (busy || filteredTrades.length === 0) return
    onGenerate(filteredTrades, { dateFrom, dateTo, types }, quality)
  }

  const rangeDays =
    dateFrom && dateTo ? Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1) : null
  const pct = trades.length ? Math.round((filteredTrades.length / trades.length) * 100) : 0
  const empty = filteredTrades.length === 0

  useEffect(() => {
    if (!open) return undefined
    const key = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, filteredTrades, quality])

  const dateInput = (value, setter) => ({
    type: 'date',
    value,
    onChange: (e) => {
      setter(e.target.value)
      setPresetId('custom')
    },
    className: `${inputCls} !rounded-lg !py-2 hover:shadow-sm focus:!shadow-md`,
    style: { borderColor: value ? 'var(--ta-accent)' : 'var(--ta-slate)', color: 'var(--ta-ink)' },
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(40,32,20,0.5), rgba(5,4,2,0.75))' }}
          onClick={busy ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: 900, '--ta-accent': '#111111', '--ta-ink': '#16130d', '--ta-slate': '#8a8068', '--ta-bg': '#efe5cc', '--ta-surface': '#fbf5e4' }}
            className="relative w-full max-w-[420px] overflow-clip rounded-[18px] p-[1.5px] shadow-[0_30px_80px_rgba(2,6,23,0.55)]"
          >
            {/* rotating accent beam around the card */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: 'conic-gradient(from 0deg, transparent 0 60%, #111 78%, #f3e7c4 92%, transparent 100%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: busy ? 1.6 : 7, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative flex max-h-[88vh] flex-col overflow-hidden rounded-[17px]" style={{ backgroundColor: 'var(--ta-surface)' }}>
              {/* Header */}
              <div className="relative flex shrink-0 items-center gap-2.5 overflow-hidden px-4 py-3" style={{ background: 'linear-gradient(135deg, #0b0b0b, #2a2620)' }}>
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(243,231,196,0.35), transparent 70%)' }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.span
                  initial={{ rotate: -90, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-md"
                  style={{ background: 'linear-gradient(135deg, #f6ecd0, #e2d3a8)' }}
                >
                  <CalendarRange size={15} color="#111" />
                </motion.span>
                <div className="relative min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[13px] font-bold leading-tight" style={{ color: '#f6ecd0' }}>
                    Download Report
                    <Sparkles size={11} />
                  </p>
                  <p className="truncate text-[10px] leading-tight" style={{ color: '#b9ad8c' }}>
                    Choose what to include · <kbd className="font-mono">Ctrl+Enter</kbd> to generate
                  </p>
                </div>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING}
                  onClick={onClose}
                  disabled={busy}
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-40"
                  style={{ color: '#f6ecd0' }}
                  aria-label="Close"
                >
                  <X size={15} />
                </motion.button>
              </div>

              {/* Body */}
              <motion.div variants={stagger} initial="hidden" animate="show" className="ta-scroll flex flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
                {/* Date range presets — a thumb slides between choices */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <SectionLabel icon={CalendarRange}>Date range</SectionLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DATE_RANGE_PRESETS.map((p) => {
                      const active = presetId === p.id
                      return (
                        <Tap
                          key={p.id}
                          onClick={() => applyPreset(p)}
                          ripple="rgba(0,0,0,0.12)"
                          hover={1.03}
                          className="rounded-lg border py-2 text-[10.5px] font-semibold"
                          style={{ borderColor: active ? '#111' : 'var(--ta-slate)', color: active ? '#fbf5e4' : 'var(--ta-ink)' }}
                        >
                          {active && (
                            <motion.span
                              layoutId="rp-preset-thumb"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-[7px]"
                              style={{ background: 'linear-gradient(135deg, #0b0b0b, #34302a)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                            />
                          )}
                          <span className="relative z-10">{p.label}</span>
                        </Tap>
                      )
                    })}
                  </div>
                </motion.div>

                {/* From / To */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>From</span>
                      <input {...dateInput(dateFrom, setDateFrom)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>To</span>
                      <input {...dateInput(dateTo, setDateTo)} />
                    </label>
                  </div>
                  <AnimatePresence>
                    {rangeDays && (
                      <motion.p
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden text-[10px] font-medium"
                        style={{ color: 'var(--ta-accent)' }}
                      >
                        📅 <AnimatedNumber value={rangeDays} /> day{rangeDays === 1 ? '' : 's'} selected
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Instrument type */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <SectionLabel icon={Layers}>Type</SectionLabel>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['All', ...INSTRUMENT_TYPES].map((t) => {
                      const isAll = t === 'All'
                      return (
                        <Chip key={t} active={isAll ? types.length === 0 : types.includes(t)} onClick={() => (isAll ? setTypes([]) : toggleType(t))}>
                          {t}
                        </Chip>
                      )
                    })}
                  </div>
                </motion.div>

                {/* More filters */}
                <motion.div variants={rise} className="flex flex-col">
                  <Tap
                    onClick={() => setMoreOpen((o) => !o)}
                    hover={1.01}
                    ripple="rgba(0,0,0,0.1)"
                    className="rounded-lg border px-3 py-2 text-[11px] font-semibold"
                    style={
                      moreOpen
                        ? { borderColor: 'var(--ta-accent)', color: 'var(--ta-ink)', backgroundColor: 'rgba(17,17,17,0.07)' }
                        : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
                    }
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal size={12} style={{ color: 'var(--ta-accent)' }} />
                        More filters
                        <AnimatePresence>
                          {extraActiveCount > 0 && (
                            <motion.span
                              key={extraActiveCount}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 600, damping: 16 }}
                              className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none"
                              style={{ backgroundColor: '#111', color: '#fbf5e4' }}
                            >
                              {extraActiveCount}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <motion.span animate={{ rotate: moreOpen ? 180 : 0 }} transition={SPRING} className="flex" style={{ color: 'var(--ta-slate)' }}>
                        <ChevronDown size={13} />
                      </motion.span>
                    </span>
                  </Tap>

                  {/* CSS-grid collapse (see note in git history): always fits dropdowns growing inside. */}
                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                    style={{ gridTemplateRows: moreOpen ? '1fr' : '0fr', opacity: moreOpen ? 1 : 0, pointerEvents: moreOpen ? 'auto' : 'none' }}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-3" aria-hidden={!moreOpen}>
                        <div className="flex flex-col gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 50%, transparent)' }}>
                          <div className="grid grid-cols-2 gap-2.5">
                            <label className="flex flex-col gap-1">
                              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><Layers size={9} />Pair</span>
                              <AnimatedMultiSelect values={pair} onToggle={toggleArr(setPair)} inputCls={inputCls} placeholder="All pairs" searchable searchPlaceholder="Search pair..." floating={false} options={ALL_PAIRS.map((i) => ({ value: i.symbol, label: i.symbol }))} />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><Clock3 size={9} />Time frame</span>
                              <AnimatedMultiSelect values={timeframe} onToggle={toggleArr(setTimeframe)} inputCls={inputCls} placeholder="All time frames" floating={false} options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))} />
                            </label>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><ArrowLeftRight size={9} />Direction</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {['All', 'Buy', 'Sell'].map((d) => {
                                const isAll = d === 'All'
                                const color = d === 'Buy' ? '#15803d' : d === 'Sell' ? '#b91c1c' : 'var(--ta-accent)'
                                return (
                                  <Chip key={d} color={color} active={isAll ? direction.length === 0 : direction.includes(d)} onClick={() => (isAll ? setDirection([]) : toggleDirection(d))}>
                                    {d === 'Buy' && <TrendingUp size={10} />}
                                    {d === 'Sell' && <TrendingDown size={10} />}
                                    {d}
                                  </Chip>
                                )
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <label className="flex flex-col gap-1">
                              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><CheckCircle2 size={9} />Status</span>
                              <AnimatedMultiSelect values={status} onToggle={toggleArr(setStatus)} inputCls={inputCls} placeholder="All statuses" floating={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><Target size={9} />Setup type</span>
                              <AnimatedMultiSelect values={setupType} onToggle={toggleArr(setSetupType)} inputCls={inputCls} placeholder="All setups" floating={false} options={setupTypeOptions.map((n) => ({ value: n, label: n }))} />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1">
                              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}><ShieldCheck size={9} />Rule met</span>
                              <AnimatedMultiSelect values={validationRuleId} onToggle={toggleArr(setValidationRuleId)} inputCls={inputCls} disabled={validationRuleOptions.length === 0} placeholder={validationRuleOptions.length === 0 ? 'No rules yet' : 'Any rule'} floating={false} options={validationRuleOptions} />
                            </label>
                          </div>

                          <AnimatePresence>
                            {extraActiveCount > 0 && (
                              <motion.button
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => {
                                  setPair([])
                                  setTimeframe([])
                                  setDirection([])
                                  setStatus([])
                                  setSetupType([])
                                  setValidationRuleId([])
                                }}
                                className="flex items-center gap-1 self-start text-[10.5px] font-medium underline-offset-2 hover:underline"
                                style={{ color: 'var(--ta-slate)' }}
                              >
                                <Eraser size={11} />
                                Clear these filters
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* PDF quality — sliding thumb + size bars */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <SectionLabel icon={Gauge}>PDF quality</SectionLabel>
                  <div className="relative grid grid-cols-3 gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 55%, transparent)' }}>
                    {QUALITY_LEVELS.map((q) => {
                      const active = quality === q.id
                      return (
                        <Tap
                          key={q.id}
                          onClick={() => setQuality(q.id)}
                          hover={1.02}
                          ripple="rgba(0,0,0,0.1)"
                          className="rounded-lg py-2"
                          style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
                          title={q.hint}
                        >
                          {active && (
                            <motion.span
                              layoutId="rp-quality-thumb"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-lg"
                              style={{ background: 'linear-gradient(135deg, #0b0b0b, #34302a)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                            />
                          )}
                          <span className="relative z-10 flex flex-col items-center gap-0.5">
                            <span className="text-[11px] font-bold">{q.label}</span>
                            <span className="flex items-end gap-[2px]" aria-hidden>
                              {[1, 2, 3].map((b) => (
                                <motion.span
                                  key={b}
                                  className="w-[3px] rounded-sm"
                                  animate={{ height: 3 + b * 2.5, opacity: b <= QUALITY_BARS[q.id] ? 1 : 0.25 }}
                                  style={{ backgroundColor: 'currentColor' }}
                                />
                              ))}
                            </span>
                            <span className="text-[8.5px] opacity-80">{q.hint}</span>
                          </span>
                        </Tap>
                      )
                    })}
                  </div>
                </motion.div>

                {/* Live match meter */}
                <motion.div variants={rise} className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5" style={{ borderColor: empty ? '#b91c1c' : 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 40%, transparent)' }}>
                  <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ta-ink)' }}>
                    <span>
                      <b className="text-[14px]" style={{ color: empty ? '#b91c1c' : 'var(--ta-accent)' }}>
                        <AnimatedNumber value={filteredTrades.length} />
                      </b>{' '}
                      of {trades.length} trade{trades.length === 1 ? '' : 's'} match
                      {filteredTrades.length === trades.length ? '' : ' this selection'}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--ta-slate)' }}>
                      <AnimatedNumber value={pct} />%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-slate) 28%, transparent)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                      style={{ background: empty ? '#b91c1c' : 'linear-gradient(90deg, #111, #4a4337)' }}
                    />
                  </div>
                  <AnimatePresence>
                    {empty && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto', x: [0, -4, 4, -3, 3, 0] }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ x: { duration: 0.4 } }}
                        className="flex items-center gap-1 overflow-hidden text-[10.5px] font-medium text-red-700"
                      >
                        <AlertTriangle size={11} /> No trades match — widen the date range or clear a filter.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>

              {/* Footer */}
              <div className="relative flex shrink-0 items-center justify-between border-t px-4 py-3" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)' }}>
                <motion.button
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-40"
                  style={{ color: 'var(--ta-slate)' }}
                >
                  Cancel
                </motion.button>
                <Tap
                  onClick={handleGenerate}
                  disabled={busy || empty}
                  hover={1.05}
                  title={empty ? 'No trades match this selection' : undefined}
                  className="rounded-xl px-4 py-2 text-[11.5px] font-bold text-[#f6ecd0] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0b0b0b, #34302a)', boxShadow: empty ? 'none' : '0 8px 22px rgba(0,0,0,0.4), 0 0 0 1px rgba(246,236,208,0.12) inset' }}
                >
                  {!empty && !busy && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(246,236,208,0.3), transparent)' }}
                      animate={{ x: ['0%', '480%'] }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                    />
                  )}
                  <motion.span className="flex" animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}>
                    {busy ? <Loader2 size={13} /> : <FileDown size={13} />}
                  </motion.span>
                  {busy ? 'Building…' : (
                    <>
                      <span>Generate PDF (<AnimatedNumber value={filteredTrades.length} />)</span>
                    </>
                  )}
                </Tap>
                {busy && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px]"
                    style={{ background: 'linear-gradient(90deg, transparent, #111, transparent)', backgroundSize: '50% 100%', backgroundRepeat: 'no-repeat' }}
                    animate={{ backgroundPositionX: ['-50%', '150%'] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
