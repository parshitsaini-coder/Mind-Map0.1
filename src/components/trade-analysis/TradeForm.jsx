import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import {
  ChevronDown,
  ImagePlus,
  X,
  Check,
  Sparkles,
  Tag,
  Search,
  Clock,
  IndianRupee,
  ArrowLeftRight,
  StickyNote,
  ListChecks,
  Camera,
  Plus,
} from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES } from '../../data/instruments'
import DatePicker from './DatePicker'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']

const listForType = (type) => (type === 'Equity' ? INDIAN_STOCKS : type === 'Forex' ? FOREX_PAIRS : COMMODITIES)

const todayISO = () => new Date().toISOString().slice(0, 10)

const blankForm = () => ({
  name: '',
  date: todayISO(),
  instrumentType: 'Equity',
  pair: '',
  timeframe: '15m',
  direction: 'Buy',
  price: '',
  notes: '',
  validationRuleIds: [],
})

// Step 8 — turns a stored trade back into this form's field shape when
// Edit is clicked on a table row.
const formFromTrade = (trade) => ({
  name: trade.name || '',
  date: trade.date,
  instrumentType: trade.instrumentType,
  pair: trade.pair,
  timeframe: trade.timeframe,
  direction: trade.direction,
  price: String(trade.price ?? ''),
  notes: trade.notes || '',
  validationRuleIds: trade.validationRuleIds || [],
})

// Step 3 of trade-analysis-master-prompt.md — the "New Trade" form, fields
// 1-11 in order. Lives inside the Step 2 sidebar shell, always in "Add"
// mode there (mode="sidebar", the default). Step 8's edit flow now opens
// this same form inside EditTradeModal.jsx instead (mode="modal"), where
// it prefills from the store's `editingTradeId` and saves via
// `updateTrade`; the sidebar copy ignores `editingTradeId` entirely so it
// stays a blank "New Trade" form no matter what's being edited elsewhere.
export default function TradeForm({ mode = 'sidebar' }) {
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const activeRules = useMemo(() => validationRules.filter((r) => r.active), [validationRules])
  const globalEditingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const editingTradeId = mode === 'modal' ? globalEditingTradeId : null
  const editingTrade = useTradeAnalysisStore((s) =>
    mode === 'modal' && s.editingTradeId ? s.trades.find((t) => t.id === s.editingTradeId) : null
  )

  const [form, setForm] = useState(blankForm)
  const [pairQuery, setPairQuery] = useState('')
  const [pairOpen, setPairOpen] = useState(false)
  const [timeframeOpen, setTimeframeOpen] = useState(false)
  const timeframeRef = useRef(null)
  const [screenshot, setScreenshot] = useState(null) // { file, previewUrl } — a newly-picked replacement image
  // The trade's already-uploaded screenshot, while editing. Separate from
  // `screenshot` above so re-opening the form doesn't force a re-upload of
  // an image that's already hosted; clearing this just means "drop it".
  const [existingScreenshot, setExistingScreenshot] = useState(null) // { url, hosted }
  const [dragActive, setDragActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Prefill (or reset) whenever which trade is being edited changes.
  useEffect(() => {
    if (editingTrade) {
      setForm(formFromTrade(editingTrade))
      setPairQuery('')
      setScreenshot((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return null
      })
      setExistingScreenshot(
        editingTrade.screenshotUrl ? { url: editingTrade.screenshotUrl, hosted: editingTrade.screenshotHosted } : null
      )
      setError('')
    } else {
      setForm(blankForm())
      setPairQuery('')
      setExistingScreenshot(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTradeId])

  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  const pulseControls = useAnimationControls()

  const patch = (fields) => setForm((f) => ({ ...f, ...fields }))

  const instrumentList = listForType(form.instrumentType)
  const filteredInstruments = useMemo(() => {
    const q = pairQuery.trim().toLowerCase()
    const list = !q
      ? instrumentList
      : instrumentList.filter((i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    return list.slice(0, 40)
  }, [instrumentList, pairQuery])

  const selectedInstrument = instrumentList.find((i) => i.symbol === form.pair) || null

  const checkedCount = form.validationRuleIds.length
  const scorePct = activeRules.length ? Math.round((checkedCount / activeRules.length) * 100) : null

  const toggleRule = (id) =>
    patch({
      validationRuleIds: form.validationRuleIds.includes(id)
        ? form.validationRuleIds.filter((r) => r !== id)
        : [...form.validationRuleIds, id],
    })

  // Ctrl+V / Cmd+V paste-to-attach — active only while this form is mounted.
  useEffect(() => {
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) attachFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (screenshot?.previewUrl) URL.revokeObjectURL(screenshot.previewUrl)
    }
  }, [screenshot])

  // Close the timeframe dropdown on outside click.
  useEffect(() => {
    if (!timeframeOpen) return
    const onClick = (e) => {
      if (timeframeRef.current && !timeframeRef.current.contains(e.target)) setTimeframeOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [timeframeOpen])

  const attachFile = (file) => {
    if (!file.type.startsWith('image/')) return
    setScreenshot((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl: URL.createObjectURL(file) }
    })
  }

  const clearScreenshot = () => {
    if (screenshot?.previewUrl) URL.revokeObjectURL(screenshot.previewUrl)
    setScreenshot(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) attachFile(file)
  }

  const resetForm = () => {
    setForm(blankForm())
    setPairQuery('')
    clearScreenshot()
    setExistingScreenshot(null)
  }

  // Step 8 — Cancel exits edit mode without saving; the editingTradeId
  // watcher effect above resets the form back to blank.
  const handleCancelEdit = () => {
    setError('')
    useTradeAnalysisStore.getState().cancelEditingTrade()
  }

  const handleAdd = async () => {
    setError('')
    if (!form.pair) return setError('Pick a stock, forex pair, or commodity first.')
    const priceNum = Number(form.price)
    if (form.price === '' || Number.isNaN(priceNum)) return setError('Enter a valid entry price.')

    setSaving(true)
    try {
      // Screenshot resolution: a newly-picked file always wins (upload it);
      // otherwise fall back to whatever's already attached to the trade
      // being edited (kept as-is, or null if the user removed it); a brand
      // new trade with neither has no screenshot.
      let screenshotUrl = existingScreenshot?.url ?? null
      let screenshotHosted = existingScreenshot?.hosted ?? false
      if (screenshot?.file) {
        const uploaded = await uploadTradeImage(screenshot.file)
        screenshotUrl = uploaded.url
        screenshotHosted = uploaded.hosted
        if (!uploaded.hosted) {
          useUiStore.getState().showToast('Screenshot saved locally — connect Cloudinary so it hosts properly.')
        }
      }

      const payload = {
        name: form.name.trim(),
        date: form.date,
        pair: form.pair,
        instrumentName: selectedInstrument?.name || form.pair,
        instrumentType: form.instrumentType,
        timeframe: form.timeframe,
        direction: form.direction,
        price: priceNum,
        notes: form.notes.trim(),
        validationRuleIds: form.validationRuleIds,
        validationScore: activeRules.length ? { checked: checkedCount, total: activeRules.length } : null,
        screenshotUrl,
        screenshotHosted,
      }

      if (editingTradeId) {
        useTradeAnalysisStore.getState().updateTrade(editingTradeId, payload)
        useUiStore.getState().showToast('Trade updated')
      } else {
        useTradeAnalysisStore.getState().addTrade({
          ...payload,
          resultImageUrl: null,
          resultImageHosted: null,
        })
        useUiStore.getState().showToast('Trade added')
      }

      resetForm()
      pulseControls.start({ scale: [1, 1.12, 1], transition: { duration: 0.35, ease: 'easeOut' } })
    } finally {
      setSaving(false)
    }
  }

  const fieldLabelCls = 'flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide'
  const inputCls =
    'ta-input w-full rounded-md border bg-white/70 px-1.5 py-1 text-[10px] outline-none'

  // Staggered entrance — each field group pops in one after another the
  // first time the form mounts (and again whenever it re-mounts, e.g.
  // switching between Add/Edit via `editingTradeId`), instead of the
  // whole panel appearing as one flat block.
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  }

  return (
    <motion.div className="flex h-full flex-col gap-2" variants={containerVariants} initial="hidden" animate="show">
      {mode !== 'modal' && (
        <motion.div variants={itemVariants} className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
            <motion.span
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
            >
              <Sparkles size={11} style={{ color: 'var(--ta-accent)' }} />
            </motion.span>
            {editingTradeId ? 'Edit Trade' : 'New Trade'}
          </p>
          <div className="ta-title-underline h-[2px] rounded-full" style={{ backgroundColor: 'var(--ta-accent)' }} />
        </motion.div>
      )}

      {/* 2. Date */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Date</span>
        <DatePicker value={form.date} onChange={(d) => patch({ date: d })} inputCls={inputCls} />
      </motion.div>

      {/* 4. Type (placed above pair so it can filter the pair list) */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <Tag size={10} style={{ color: 'var(--ta-accent)' }} />
          Type
        </span>
        <div className="grid grid-cols-3 gap-1">
          {INSTRUMENT_TYPES.map((t) => (
            <motion.button
              key={t}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                patch({ instrumentType: t, pair: '' })
                setPairQuery('')
              }}
              className="rounded-md border py-0.5 text-[9px] font-medium transition-colors"
              style={
                form.instrumentType === t
                  ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)', color: '#fffcf2' }
                  : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
              }
            >
              {t}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* 3. Stock / Forex pair — searchable combobox */}
      <motion.div variants={itemVariants} className="relative flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <Search size={10} style={{ color: 'var(--ta-accent)' }} />
          {form.instrumentType === 'Commodity' ? 'Commodity' : form.instrumentType === 'Forex' ? 'Forex pair' : 'Stock'}
        </span>
        <div className="relative">
          <input
            type="text"
            value={pairOpen ? pairQuery : selectedInstrument ? `${selectedInstrument.symbol} — ${selectedInstrument.name}` : form.pair}
            onFocus={() => { setPairOpen(true); setPairQuery('') }}
            onChange={(e) => { setPairQuery(e.target.value); patch({ pair: '' }) }}
            onBlur={() => setTimeout(() => setPairOpen(false), 120)}
            placeholder={instrumentList.length ? 'Search…' : 'No instruments loaded yet'}
            disabled={!instrumentList.length}
            className={`${inputCls} pr-6 disabled:opacity-50`}
            style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
          />
          <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--ta-slate)' }} />
        </div>
        <AnimatePresence>
          {pairOpen && instrumentList.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 shadow-lg"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top' }}
            >
              {filteredInstruments.length === 0 ? (
                <li className="px-2 py-1 text-[9px]" style={{ color: 'var(--ta-slate)' }}>No matches</li>
              ) : (
                filteredInstruments.map((i, idx) => {
                  const active = i.symbol === form.pair
                  return (
                    <motion.li
                      key={i.symbol}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.14, delay: Math.min(idx, 8) * 0.02 }}
                    >
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.015, x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { patch({ pair: i.symbol }); setPairOpen(false); setPairQuery('') }}
                        className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[9px] transition-colors hover:border-[#eb5e28] hover:bg-[rgba(235,94,40,0.08)]"
                        style={
                          active
                            ? { borderColor: 'var(--ta-accent)', backgroundColor: 'rgba(235,94,40,0.1)', color: 'var(--ta-ink)' }
                            : { borderColor: 'rgba(43,41,37,0.16)', color: 'var(--ta-ink)' }
                        }
                      >
                        <span className="flex flex-1 flex-col items-start gap-0.5">
                          <span className="font-semibold">{i.symbol}</span>
                          <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>{i.name}</span>
                        </span>
                        {active && <Check size={12} style={{ color: 'var(--ta-accent)' }} className="shrink-0" />}
                      </motion.button>
                    </motion.li>
                  )
                })
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 5. Time frame + Price — side by side */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2">
      <div className="relative flex flex-col gap-1" ref={timeframeRef}>
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <Clock size={10} style={{ color: 'var(--ta-accent)' }} />
          Time frame
        </span>
        <button
          type="button"
          onClick={() => setTimeframeOpen((v) => !v)}
          className={`${inputCls} flex items-center justify-between text-left`}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        >
          {form.timeframe}
          <motion.span animate={{ rotate: timeframeOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown size={13} style={{ color: 'var(--ta-slate)' }} />
          </motion.span>
        </button>
        <AnimatePresence>
          {timeframeOpen && (
            <motion.ul
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="absolute left-0 right-0 top-full z-20 mt-1 grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-1.5 shadow-lg"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top' }}
            >
              {TIMEFRAMES.map((tf, idx) => {
                const active = tf === form.timeframe
                return (
                  <motion.li
                    key={tf}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12, delay: Math.min(idx, 8) * 0.015 }}
                  >
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { patch({ timeframe: tf }); setTimeframeOpen(false) }}
                      className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[9px] font-medium transition-colors hover:bg-black/5"
                      style={
                        active
                          ? { backgroundColor: 'var(--ta-accent)', color: '#fffcf2', boxShadow: '0 1px 4px rgba(235,94,40,0.4)' }
                          : { color: 'var(--ta-ink)' }
                      }
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {tf}
                      {active && <Check size={10} />}
                    </motion.button>
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Price */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <IndianRupee size={10} style={{ color: 'var(--ta-accent)' }} />
          Price
        </span>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={form.price}
          onChange={(e) => patch({ price: e.target.value })}
          placeholder="Entry price"
          className={inputCls}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        />
      </label>
      </motion.div>

      {/* 6. Direction */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <ArrowLeftRight size={10} style={{ color: 'var(--ta-accent)' }} />
          Direction
        </span>
        <div className="grid grid-cols-2 gap-1">
          {['Buy', 'Sell'].map((d) => (
            <motion.button
              key={d}
              type="button"
              whileTap={{ scale: 0.94 }}
              animate={{
                backgroundColor: form.direction === d ? (d === 'Buy' ? '#16a34a' : '#dc2626') : 'rgba(0,0,0,0)',
                color: form.direction === d ? '#ffffff' : 'var(--ta-ink)',
              }}
              transition={{ duration: 0.16 }}
              onClick={() => patch({ direction: d })}
              className="rounded-md border py-0.5 text-[9px] font-semibold"
              style={{ borderColor: form.direction === d ? (d === 'Buy' ? '#16a34a' : '#dc2626') : 'var(--ta-slate)' }}
            >
              {d}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* 7. Notes */}
      <motion.label variants={itemVariants} className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <StickyNote size={10} style={{ color: 'var(--ta-accent)' }} />
          Notes
        </span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Setup, reasoning, anything worth remembering…"
          className={`${inputCls} resize-none`}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        />
      </motion.label>

      {/* 9. Validation checklist */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
            <ListChecks size={10} style={{ color: 'var(--ta-accent)' }} />
            Validation
          </span>
          {scorePct !== null && (
            <AnimatePresence mode="popLayout">
              <motion.span
                key={`${checkedCount}-${activeRules.length}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                style={{
                  backgroundColor: 'var(--ta-accent)',
                  color: '#fffcf2',
                  boxShadow: '0 1px 6px color-mix(in srgb, var(--ta-accent) 55%, transparent)',
                }}
              >
                {checkedCount}/{activeRules.length} ({scorePct}%)
              </motion.span>
            </AnimatePresence>
          )}
        </div>
        {activeRules.length === 0 ? (
          <p className="rounded-md border border-dashed px-1.5 py-1 text-[9px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
            No validation rules yet — add some from the ✚ button up top.
          </p>
        ) : (
          <div className="flex max-h-[100px] flex-col gap-1 overflow-y-auto pr-0.5">
            {activeRules.map((rule) => {
              const checked = form.validationRuleIds.includes(rule.id)
              return (
                <motion.button
                  key={rule.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleRule(rule.id)}
                  className="flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-[9px] transition-colors"
                  style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                >
                  <span
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors"
                    style={
                      checked
                        ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)' }
                        : { borderColor: 'var(--ta-slate)' }
                    }
                  >
                    <AnimatePresence>
                      {checked && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                          className="flex items-center justify-center"
                        >
                          <Check size={10} color="#fffcf2" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {rule.label}
                </motion.button>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* 10. Screenshot upload — while editing, an already-uploaded image
          (`existingScreenshot`) shows the same way a freshly-picked one
          does; a newly-picked file always takes priority over it. */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
          <Camera size={10} style={{ color: 'var(--ta-accent)' }} />
          Screenshot
        </span>
        {screenshot ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-md border"
            style={{ borderColor: 'var(--ta-slate)' }}
          >
            <img src={screenshot.previewUrl} alt="Screenshot preview" className="h-16 w-full object-cover" />
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={clearScreenshot}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              title="Remove screenshot"
            >
              <X size={11} />
            </motion.button>
          </motion.div>
        ) : existingScreenshot ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-md border"
            style={{ borderColor: 'var(--ta-slate)' }}
          >
            <img src={existingScreenshot.url} alt="Current screenshot" className="h-16 w-full object-cover" />
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => setExistingScreenshot(null)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              title="Remove screenshot"
            >
              <X size={11} />
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            ref={dropZoneRef}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            whileHover={{ scale: 1.01 }}
            animate={{
              borderColor: dragActive ? 'var(--ta-accent)' : 'var(--ta-slate)',
              backgroundColor: dragActive ? 'color-mix(in srgb, var(--ta-accent) 10%, transparent)' : 'rgba(0,0,0,0)',
            }}
            transition={{ duration: 0.15 }}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-2 py-2 text-center"
          >
            <motion.span animate={dragActive ? { y: [-2, 2, -2] } : { y: 0 }} transition={{ duration: 0.6, repeat: dragActive ? Infinity : 0 }}>
              <ImagePlus size={16} style={{ color: dragActive ? 'var(--ta-accent)' : 'var(--ta-slate)' }} />
            </motion.span>
            <p className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>
              Drop, click to browse, or paste (Ctrl+V)
            </p>
          </motion.div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) attachFile(file)
          }}
        />
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[9px] font-medium"
            style={{ color: '#dc2626' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 11. Add / Update button — Cancel sits alongside it while editing. */}
      <motion.div variants={itemVariants} className="mt-1 flex gap-1.5">
        {editingTradeId && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleCancelEdit}
            disabled={saving}
            className="rounded-md border py-1.5 px-2.5 text-[10px] font-medium transition-colors hover:bg-black/5 disabled:opacity-60"
            style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
          >
            Cancel
          </motion.button>
        )}
        <motion.button
          type="button"
          animate={pulseControls}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving}
          className="ta-btn-primary flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white/40 border-t-white"
            />
          ) : (
            <motion.span
              animate={{ rotate: [0, 0] }}
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              {editingTradeId ? <Check size={11} /> : <Plus size={11} />}
            </motion.span>
          )}
          {saving ? (editingTradeId ? 'Saving…' : 'Adding…') : editingTradeId ? 'Save changes' : 'Add'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
