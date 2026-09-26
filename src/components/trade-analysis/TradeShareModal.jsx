import { AnimatePresence, motion } from 'framer-motion'
import { X, Share2, Link2, Copy, Square, SlidersHorizontal, Layers, Clock3, ArrowLeftRight, CheckCircle2, ShieldCheck, Eraser, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES } from '../../data/instruments'
import { applyFilters } from '../../utils/tradeFilters'
import { isoDate, daysAgoIso, DATE_RANGE_PRESETS } from '../../utils/dateRangePresets'
import AnimatedMultiSelect from './AnimatedMultiSelect'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { useTradeShareStore } from '../../store/tradeShareStore'
import { tradeShareUrl, LIVE_EXPIRY_OPTIONS } from '../../lib/tradeShare'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']
const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']
const ALL_PAIRS = [...INDIAN_STOCKS, ...FOREX_PAIRS, ...COMMODITIES]

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
  const [expiryValue, setExpiryValue] = useState('7d')
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

  const pillCls = (active, activeColor = 'var(--ta-accent)') => ({
    className: 'rounded-md border py-1 text-[9.5px] font-medium transition-colors',
    style: active
      ? { backgroundColor: activeColor, borderColor: activeColor, color: '#fffcf2' }
      : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' },
  })

  // Only the validation rules any filtered trade actually references get
  // embedded — same "denormalized snapshot, nothing extra" convention as
  // exportShareLink's collectReferencedChecklistsAndTrades.
  const referencedValidationRules = useMemo(() => {
    const neededIds = new Set(filteredTrades.flatMap((t) => t.validationRuleIds || []))
    return validationRules.filter((r) => neededIds.has(r.id))
  }, [filteredTrades, validationRules])

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
      trades: filteredTrades,
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
  }

  const handleEnd = async (id) => {
    if (!window.confirm('End this share link? Anyone with it will see "link ended" from now on.')) return
    await endLink(id)
    showToast('Share link ended')
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
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
              <Share2 size={12} color="#fffcf2" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--ta-ink)' }}>
                Share trades
              </p>
              <p className="truncate text-[9px] leading-tight" style={{ color: 'var(--ta-slate)' }}>
                Choose what a view-only link shows
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
              style={{ color: 'var(--ta-slate)' }}
              title="Close"
            >
              <X size={13} />
            </button>
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
                height:'auto') — that pattern measures height once in JS
                and locks it, so when a dropdown inside (Pair/Time frame/
                etc.) opens and grows taller afterwards, the locked
                height clips the rest of the tray. grid-rows is driven
                natively by the browser every frame, so it always fits
                whatever is actually inside, dropdowns included. Content
                stays mounted even when collapsed so selections aren't
                lost while it's hidden. */}
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

            <p className="text-[10px]" style={{ color: 'var(--ta-slate)' }}>
              {filteredTrades.length} of {trades.length} trade{trades.length === 1 ? '' : 's'} will be shared
              {filteredTrades.length === trades.length ? '' : ' (this selection)'}.
            </p>

            {/* Expiry + generate */}
            <div className="flex flex-col gap-1 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Link expires after</span>
              <select
                value={expiryValue}
                onChange={(e) => setExpiryValue(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-[11px]"
                style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)', backgroundColor: 'var(--ta-surface)' }}
              >
                {LIVE_EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {!isSupabaseConfigured ? (
              <p className="text-[10px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
                Share links need cloud save set up (Supabase keys) — see <code>SUPABASE_SETUP.md</code>.
              </p>
            ) : !authUser ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
                  A share link needs somewhere to save to. Log in to create one.
                </p>
                <button
                  onClick={() => {
                    onClose()
                    toggleAuthModal()
                  }}
                  className="rounded-md border py-1.5 text-[11px] font-medium"
                  style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                >
                  Log in / sign up
                </button>
              </div>
            ) : (
              <motion.button
                whileHover={filteredTrades.length ? { scale: 1.02 } : {}}
                whileTap={filteredTrades.length ? { scale: 0.96 } : {}}
                onClick={handleGenerate}
                disabled={busy || filteredTrades.length === 0}
                title={filteredTrades.length === 0 ? 'No trades match this selection' : undefined}
                className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                <Link2 size={13} /> {busy ? 'Creating link…' : `Generate live link (${filteredTrades.length})`}
              </motion.button>
            )}

            {/* Your active links */}
            {activeLinks.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
                <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
                  Your active links ({activeLinks.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {activeLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex flex-col gap-1 rounded-md border px-2 py-1.5"
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
                      <p className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>
                        {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiry'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(link.id)}
                          className="flex flex-1 items-center justify-center gap-1 rounded py-1 text-[10px] font-medium"
                          style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                        >
                          <Copy size={10} /> Copy
                        </button>
                        <button
                          onClick={() => handleEnd(link.id)}
                          className="flex items-center justify-center gap-1 rounded border border-[#c1443c] px-2 py-1 text-[10px] text-[#c1443c]"
                        >
                          <Square size={9} /> End
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
