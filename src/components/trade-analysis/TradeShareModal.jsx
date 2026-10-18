import { AnimatePresence, motion } from 'framer-motion'
import { stagger, rise, SPRING, AnimatedNumber, Tap, Chip, SectionLabel } from './motionKit'
import { X, Share2, Link2, Copy, Square, SlidersHorizontal, Layers, Clock3, ArrowLeftRight, CheckCircle2, ShieldCheck, Eraser, ChevronDown, Check, Loader2, Eye, EyeOff, CalendarRange, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES, INDICES } from '../../data/instruments'
import { applyFilters } from '../../utils/tradeFilters'
import { isoDate, daysAgoIso, DATE_RANGE_PRESETS } from '../../utils/dateRangePresets'
import AnimatedSelect from './AnimatedSelect'
import AnimatedMultiSelect from './AnimatedMultiSelect'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { useTradeShareStore } from '../../store/tradeShareStore'
import { tradeShareUrl, LIVE_EXPIRY_OPTIONS } from '../../lib/tradeShare'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity', 'Index']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']
const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']
const ALL_PAIRS = [...INDIAN_STOCKS, ...FOREX_PAIRS, ...COMMODITIES, ...INDICES]

async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    window.prompt('Copy this link:', url)
    return false
  }
}

// A short one-line description of what's being shared, shown next to a
// created link in "Your active links" so it's obvious which is which
// without decoding the filters again.
function describeFilters({ types, pair, timeframe, direction, status, validationRuleId, dateFrom, dateTo, presetId }) {
  const bits = []
  if (types.length) bits.push(types.join('/'))
  else bits.push('All types')
  if (pair.length) bits.push(pair.length === 1 ? pair[0] : `${pair.length} pairs`)
  if (timeframe.length) bits.push(timeframe.join('/'))
  if (direction.length) bits.push(direction.join('/'))
  if (status.length) bits.push(status.join('/'))
  if (validationRuleId.length) bits.push(`${validationRuleId.length} rule${validationRuleId.length === 1 ? '' : 's'}`)
  if (presetId !== 'all') {
    const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId)
    bits.push(preset && preset.id !== 'custom' ? preset.label : `${dateFrom || '…'} → ${dateTo || '…'}`)
  }
  return bits.join(' · ')
}

// Section — Trade Analysis's own "Share" popup. Distinct from the mind
// map's ShareModal (toolbar/ShareModal.jsx): this one shares a *filtered
// snapshot of trades* — read-only cards anyone with the link can open,
// vertically listed, in the same theme this account is currently using —
// rather than the whole canvas. Reuses the exact filter fields
// ReportFiltersModal already has so scoping a share feels identical to
// scoping a PDF, then adds an expiry + live-link step in place of the PDF
// quality picker.
export default function TradeShareModal({ open, onClose }) {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const validationCategories = useTradeAnalysisStore((s) => s.validationCategories)
  const theme = useTradeAnalysisStore((s) => s.theme)
  const authUser = useAuthStore((s) => s.user)
  const toggleAuthModal = useUiStore((s) => s.toggleAuthModal)
  const showToast = useUiStore((s) => s.showToast)
  const createLink = useTradeShareStore((s) => s.create)
  const endLink = useTradeShareStore((s) => s.end)
  const refreshViewCounts = useTradeShareStore((s) => s.refreshViewCounts)
  // Pull the latest "who's viewed this" counts as soon as the popup opens —
  // view_count only ever lives server-side, so this browser's copy is
  // whatever it was at creation time until this refreshes it.
  useEffect(() => {
    if (authUser?.id) refreshViewCounts(authUser.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])
  // Subscribed only so this modal re-renders after create/end (activeLinks
  // itself isn't reactive state, same convention as the mind map's
  // ShareModal.jsx LiveTab) — the value itself is unused.
  useTradeShareStore((s) => s.links)
  const activeLinks = useTradeShareStore.getState().activeLinks()

  const [presetId, setPresetId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [types, setTypes] = useState([])
  const [pair, setPair] = useState([])
  const [timeframe, setTimeframe] = useState([])
  const [direction, setDirection] = useState([])
  const [status, setStatus] = useState([])
  const [validationRuleId, setValidationRuleId] = useState([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [endingId, setEndingId] = useState(null)
  const [expiryValue, setExpiryValue] = useState('7d')
  const [hideValidation, setHideValidation] = useState(false)
  const [busy, setBusy] = useState(false)

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
      if (preset.id === 'all') {
        setDateFrom('')
        setDateTo('')
      }
      return
    }
    setDateFrom(daysAgoIso(preset.days))
    setDateTo(isoDate(new Date()))
  }

  const toggleType = (t) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  const toggleDirection = (d) => setDirection((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  const toggleArr = (setter) => (v) => setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const filteredTrades = useMemo(
    () => applyFilters(trades, { pair, instrumentType: types, timeframe, direction, status, validationRuleId, dateFrom, dateTo }),
    [trades, pair, types, timeframe, direction, status, validationRuleId, dateFrom, dateTo]
  )

  const extraActiveCount = [pair, timeframe, direction, status, validationRuleId].filter((a) => a.length > 0).length

  const fieldLabelCls = 'text-[10px] font-medium uppercase tracking-wide flex items-center gap-1'
  const inputCls = 'w-full rounded-md border bg-white/70 px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-1'

  // Only the validation rules any filtered trade actually references get
  // embedded — same "denormalized snapshot, nothing extra" convention as
  // exportShareLink's collectReferencedChecklistsAndTrades. Empty outright
  // when the owner has switched validation details off for this link.
  const referencedValidationRules = useMemo(() => {
    if (hideValidation) return []
    const neededIds = new Set(filteredTrades.flatMap((t) => t.validationRuleIds || []))
    return validationRules.filter((r) => neededIds.has(r.id))
  }, [filteredTrades, validationRules, hideValidation])

  // The actual snapshot sent to Supabase — strips validationRuleIds/
  // validationScore off each trade when hidden, so there's nothing for a
  // viewer to recover even by inspecting the raw payload (not just a UI
  // toggle on the display side).
  const shareTrades = useMemo(() => {
    if (!hideValidation) return filteredTrades
    return filteredTrades.map(({ validationRuleIds, validationScore, ...rest }) => rest)
  }, [filteredTrades, hideValidation])

  const handleGenerate = async () => {
    if (busy || filteredTrades.length === 0) return
    if (!isSupabaseConfigured) {
      showToast('Cloud save isn\u2019t set up yet (missing Supabase keys) — see SUPABASE_SETUP.md.')
      return
    }
    if (!authUser) {
      toggleAuthModal()
      return
    }
    setBusy(true)
    const summary = describeFilters({ types, pair, timeframe, direction, status, validationRuleId, dateFrom, dateTo, presetId })
    const result = await createLink({
      userId: authUser.id,
      trades: shareTrades,
      validationRules: referencedValidationRules,
      filters: { pair, instrumentType: types, timeframe, direction, status, validationRuleId, dateFrom, dateTo },
      themeName: theme,
      expiryValue,
      summary,
    })
    setBusy(false)
    if (result.error) {
      showToast(result.error)
      return
    }
    const copied = await copyToClipboard(tradeShareUrl(result.id))
    showToast(copied ? 'Live link copied — anyone with it can view these trades' : 'Link ready — copy it below')
  }

  const handleCopy = async (id) => {
    const copied = await copyToClipboard(tradeShareUrl(id))
    showToast(copied ? 'Link copied to clipboard' : 'Link ready — copy it manually')
    if (copied) {
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1400)
    }
  }

  const handleEnd = async (id) => {
    if (!window.confirm('End this share link? Anyone with it will see "link ended" from now on.')) return
    setEndingId(id)
    await endLink(id)
    setEndingId(null)
    showToast('Share link ended')
  }

  const pct = trades.length ? Math.round((filteredTrades.length / trades.length) * 100) : 0
  const empty = filteredTrades.length === 0
  const rangeDays = dateFrom && dateTo ? Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1) : null
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

  // Black & cream palette, scoped to this popup (the nested dropdowns inherit it).
  const palette = {
    '--ta-accent': '#111111',
    '--ta-ink': '#16130d',
    '--ta-slate': '#8a8068',
    '--ta-bg': '#efe5cc',
    '--ta-surface': '#fbf5e4',
  }

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
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            style={palette}
            className="relative w-full max-w-[420px] overflow-clip rounded-[18px] p-[1.5px] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: 'conic-gradient(from 0deg, transparent 0 60%, #111 78%, #f3e7c4 92%, transparent 100%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: busy ? 1.6 : 7, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative flex max-h-[88vh] flex-col overflow-hidden rounded-[17px]" style={{ backgroundColor: 'var(--ta-surface)' }}>
              {/* Header — black with cream text */}
              <div className="relative flex shrink-0 items-center gap-2.5 overflow-hidden px-4 py-3" style={{ background: 'linear-gradient(135deg, #0b0b0b, #2a2620)' }}>
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(243,231,196,0.35), transparent 70%)' }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.span
                  initial={{ rotate: -90, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-md"
                  style={{ background: 'linear-gradient(135deg, #f6ecd0, #e2d3a8)' }}
                >
                  <Share2 size={15} color="#111" />
                </motion.span>
                <div className="relative min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[13px] font-bold leading-tight" style={{ color: '#f6ecd0' }}>
                    Share trades
                    <Sparkles size={11} />
                  </p>
                  <p className="truncate text-[10px] leading-tight" style={{ color: '#b9ad8c' }}>
                    Choose what a view-only link shows
                  </p>
                </div>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING}
                  onClick={onClose}
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
                  style={{ color: '#f6ecd0' }}
                  aria-label="Close"
                >
                  <X size={15} />
                </motion.button>
              </div>

              <motion.div variants={stagger} initial="hidden" animate="show" className="ta-scroll flex flex-col gap-3.5 overflow-y-auto px-4 py-3.5">
                {/* Date range */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <SectionLabel icon={CalendarRange}>Date range</SectionLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DATE_RANGE_PRESETS.map((p) => {
                      const active = presetId === p.id
                      return (
                        <Tap
                          key={p.id}
                          onClick={() => applyPreset(p)}
                          ripple="rgba(128,128,128,0.25)"
                          className="rounded-lg border py-2 text-[10.5px] font-semibold"
                          style={{ borderColor: active ? '#111' : 'var(--ta-slate)', color: active ? '#fbf5e4' : 'var(--ta-ink)' }}
                        >
                          {active && (
                            <motion.span
                              layoutId="sh-preset-thumb"
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
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden text-[10px] font-medium" style={{ color: 'var(--ta-ink)' }}>
                        📅 <AnimatedNumber value={rangeDays} /> day{rangeDays === 1 ? '' : 's'} selected
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Type */}
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
                    ripple="rgba(128,128,128,0.2)"
                    className="rounded-lg border px-3 py-2 text-[11px] font-semibold"
                    style={moreOpen ? { borderColor: '#111', color: 'var(--ta-ink)', backgroundColor: 'rgba(17,17,17,0.07)' } : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal size={12} />
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

                  {/* CSS-grid collapse: always fits dropdowns that grow inside; content stays mounted so selections persist. */}
                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                    style={{ gridTemplateRows: moreOpen ? '1fr' : '0fr', opacity: moreOpen ? 1 : 0, pointerEvents: moreOpen ? 'auto' : 'none' }}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-3" aria-hidden={!moreOpen}>
                        <div className="flex flex-col gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 55%, transparent)' }}>
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
                                const color = d === 'Buy' ? '#15803d' : d === 'Sell' ? '#b91c1c' : '#111111'
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
                              <AnimatedMultiSelect values={status} onToggle={toggleArr(setStatus)} inputCls={inputCls} placeholder="All statuses" floating={false} options={STATUS_OPTIONS.map((x) => ({ value: x, label: x }))} />
                            </label>
                            <label className="flex flex-col gap-1">
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

                {/* Match meter */}
                <motion.div variants={rise} className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5" style={{ borderColor: empty ? '#b91c1c' : 'var(--ta-slate)', backgroundColor: 'color-mix(in srgb, var(--ta-bg) 45%, transparent)' }}>
                  <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ta-ink)' }}>
                    <span>
                      <b className="text-[14px]" style={{ color: empty ? '#b91c1c' : '#111' }}>
                        <AnimatedNumber value={filteredTrades.length} />
                      </b>{' '}
                      of {trades.length} trade{trades.length === 1 ? '' : 's'} will be shared
                      {filteredTrades.length === trades.length ? '' : ' (this selection)'}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--ta-slate)' }}>
                      <AnimatedNumber value={pct} />%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(17,17,17,0.12)' }}>
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

                {/* Validation visibility */}
                <motion.div variants={rise} className="flex flex-col gap-1.5 rounded-xl border p-3" style={{ borderColor: hideValidation ? 'var(--ta-slate)' : '#111' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={hideValidation ? 'off' : 'on'} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={SPRING} className="flex">
                          {hideValidation ? <EyeOff size={13} style={{ color: 'var(--ta-slate)' }} /> : <Eye size={13} />}
                        </motion.span>
                      </AnimatePresence>
                      Validation details
                    </span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setHideValidation((v) => !v)}
                      role="switch"
                      aria-checked={!hideValidation}
                      title={hideValidation ? 'Hidden from viewers — tap to show' : 'Visible to viewers — tap to hide'}
                      className="relative flex h-5 w-9 shrink-0 items-center rounded-full p-0.5"
                      animate={{ backgroundColor: hideValidation ? '#b8ad8d' : '#111111' }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="h-4 w-4 rounded-full shadow" style={{ backgroundColor: '#fbf5e4', marginLeft: hideValidation ? 0 : 'auto' }} />
                    </motion.button>
                  </div>
                  <p className="text-[9.5px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
                    {hideValidation
                      ? 'Hidden — viewers won\u2019t see validation rule badges or the checklist score on any card.'
                      : 'Visible — viewers will see validation rule badges and the checklist score on each card.'}
                  </p>
                </motion.div>

                {/* Expiry */}
                <motion.div variants={rise} className="flex flex-col gap-1.5">
                  <SectionLabel icon={Timer}>Link expires after</SectionLabel>
                  <AnimatedSelect
                    value={expiryValue}
                    onChange={setExpiryValue}
                    options={LIVE_EXPIRY_OPTIONS}
                    inputCls="w-full rounded-lg border bg-[var(--ta-surface)] px-2 py-2 text-[11px] outline-none transition-colors focus:ring-1"
                  />
                </motion.div>

                {/* Generate / auth states */}
                <motion.div variants={rise} className="flex flex-col gap-2">
                  {!isSupabaseConfigured ? (
                    <p className="text-[10px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
                      Share links need cloud save set up (Supabase keys) — see <code>SUPABASE_SETUP.md</code>.
                    </p>
                  ) : !authUser ? (
                    <>
                      <p className="text-[10px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
                        A share link needs somewhere to save to. Log in to create one.
                      </p>
                      <Tap
                        onClick={() => {
                          onClose()
                          toggleAuthModal()
                        }}
                        ripple="rgba(128,128,128,0.25)"
                        className="rounded-xl border py-2 text-[11.5px] font-semibold"
                        style={{ borderColor: '#111', color: 'var(--ta-ink)' }}
                      >
                        Log in / sign up
                      </Tap>
                    </>
                  ) : (
                    <Tap
                      onClick={handleGenerate}
                      disabled={busy || empty}
                      hover={1.03}
                      title={empty ? 'No trades match this selection' : undefined}
                      className="rounded-xl py-2.5 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #0b0b0b, #34302a)', color: '#f6ecd0', boxShadow: empty ? 'none' : '0 8px 22px rgba(0,0,0,0.4), 0 0 0 1px rgba(246,236,208,0.12) inset' }}
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
                        {busy ? <Loader2 size={14} /> : <Link2 size={14} />}
                      </motion.span>
                      {busy ? 'Creating link…' : <span>Generate live link (<AnimatedNumber value={filteredTrades.length} />)</span>}
                    </Tap>
                  )}
                </motion.div>

            {/* Your active links */}
                {activeLinks.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
                <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                  Your active links ({activeLinks.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {activeLinks.map((link) => (
                      <motion.div
                        key={link.id}
                        layout
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-1 overflow-hidden rounded-md border px-2 py-1.5"
                        style={{ borderColor: 'var(--ta-slate)' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3fa66a] opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3fa66a]" />
                          </span>
                          <p className="min-w-0 flex-1 truncate text-[10px]" style={{ color: 'var(--ta-ink)' }} title={link.summary}>
                            {link.summary || 'All trades'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--ta-slate)' }}>
                          <span>{link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiry'}</span>
                          <span className="flex items-center gap-0.5 font-semibold" style={{ color: 'var(--ta-ink)' }}>
                            <Eye size={9} /> {link.viewCount || 0} view{link.viewCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleCopy(link.id)}
                            className="flex flex-1 items-center justify-center gap-1 overflow-hidden rounded py-1 text-[10px] font-medium transition-colors"
                            style={
                              copiedId === link.id
                                ? { backgroundColor: '#111', color: '#f6ecd0' }
                                : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
                            }
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {copiedId === link.id ? (
                                <motion.span
                                  key="copied"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.15 }}
                                  className="flex items-center gap-1"
                                >
                                  <Check size={10} /> Copied!
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="copy"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.15 }}
                                  className="flex items-center gap-1"
                                >
                                  <Copy size={10} /> Copy
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                          <motion.button
                            whileHover={endingId === link.id ? {} : { scale: 1.03 }}
                            whileTap={endingId === link.id ? {} : { scale: 0.94 }}
                            onClick={() => handleEnd(link.id)}
                            disabled={endingId === link.id}
                            className="flex items-center justify-center gap-1 rounded border px-2 py-1 text-[10px] transition-opacity disabled:opacity-60"
                            style={{ borderColor: '#c1443c', color: '#c1443c' }}
                          >
                            <motion.span
                              className="flex"
                              animate={endingId === link.id ? { rotate: 360 } : { rotate: 0 }}
                              transition={endingId === link.id ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                            >
                              {endingId === link.id ? <Loader2 size={9} /> : <Square size={9} />}
                            </motion.span>
                            {endingId === link.id ? 'Ending…' : 'End'}
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
