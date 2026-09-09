import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { ChevronDown, ImagePlus, X, Check } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES } from '../../data/instruments'

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
// 1-11 in order. Lives inside the Step 2 sidebar shell. Step 8 adds editing:
// clicking Edit on a table row sets `editingTradeId` in the store, which
// this form watches and prefills from below, switching into "editing trade
// #N" mode (title/button copy change, a Cancel option appears) until the
// edit is saved or cancelled.
export default function TradeForm() {
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const activeRules = useMemo(() => validationRules.filter((r) => r.active), [validationRules])
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const editingTrade = useTradeAnalysisStore((s) =>
    s.editingTradeId ? s.trades.find((t) => t.id === s.editingTradeId) : null
  )

  const [form, setForm] = useState(blankForm)
  const [pairQuery, setPairQuery] = useState('')
  const [pairOpen, setPairOpen] = useState(false)
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

  const fieldLabelCls = 'text-[10px] font-medium uppercase tracking-wide'
  const inputCls =
    'w-full rounded-md border bg-white/70 px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-1'

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
        {editingTradeId ? 'Edit Trade' : 'New Trade'}
      </p>

      {/* 1. Name */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Name</span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Breakout retest"
          className={inputCls}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        />
      </label>

      {/* 2. Date */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Date</span>
        <input
          type="date"
          value={form.date}
          onChange={(e) => patch({ date: e.target.value })}
          className={inputCls}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        />
      </label>

      {/* 4. Type (placed above pair so it can filter the pair list) */}
      <div className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Type</span>
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
              className="rounded-md border py-1 text-[10px] font-medium transition-colors"
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
      </div>

      {/* 3. Stock / Forex pair — searchable combobox */}
      <div className="relative flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>
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
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-md border shadow-md"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
            >
              {filteredInstruments.length === 0 ? (
                <li className="px-2 py-1.5 text-[10px]" style={{ color: 'var(--ta-slate)' }}>No matches</li>
              ) : (
                filteredInstruments.map((i) => (
                  <li key={i.symbol}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { patch({ pair: i.symbol }); setPairOpen(false); setPairQuery('') }}
                      className="flex w-full flex-col items-start px-2 py-1 text-left text-[10px] hover:bg-black/5"
                      style={{ color: 'var(--ta-ink)' }}
                    >
                      <span className="font-medium">{i.symbol}</span>
                      <span style={{ color: 'var(--ta-slate)' }}>{i.name}</span>
                    </button>
                  </li>
                ))
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Time frame */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Time frame</span>
        <select
          value={form.timeframe}
          onChange={(e) => patch({ timeframe: e.target.value })}
          className={inputCls}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </label>

      {/* 6. Direction */}
      <div className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Direction</span>
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
              className="rounded-md border py-1 text-[10px] font-semibold"
              style={{ borderColor: form.direction === d ? (d === 'Buy' ? '#16a34a' : '#dc2626') : 'var(--ta-slate)' }}
            >
              {d}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 7. Price */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Price</span>
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

      {/* 8. Notes */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Notes</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Setup, reasoning, anything worth remembering…"
          className={`${inputCls} resize-none`}
          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
        />
      </label>

      {/* 9. Validation checklist */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Validation</span>
          {scorePct !== null && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
            >
              {checkedCount}/{activeRules.length} ({scorePct}%)
            </span>
          )}
        </div>
        {activeRules.length === 0 ? (
          <p className="rounded-md border border-dashed px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
            No validation rules yet — add some from the ✚ button up top.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {activeRules.map((rule) => {
              const checked = form.validationRuleIds.includes(rule.id)
              return (
                <motion.button
                  key={rule.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleRule(rule.id)}
                  className="flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] transition-colors"
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
      </div>

      {/* 10. Screenshot upload — while editing, an already-uploaded image
          (`existingScreenshot`) shows the same way a freshly-picked one
          does; a newly-picked file always takes priority over it. */}
      <div className="flex flex-col gap-1">
        <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Screenshot</span>
        {screenshot ? (
          <div className="relative overflow-hidden rounded-md border" style={{ borderColor: 'var(--ta-slate)' }}>
            <img src={screenshot.previewUrl} alt="Screenshot preview" className="h-24 w-full object-cover" />
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={clearScreenshot}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              title="Remove screenshot"
            >
              <X size={11} />
            </motion.button>
          </div>
        ) : existingScreenshot ? (
          <div className="relative overflow-hidden rounded-md border" style={{ borderColor: 'var(--ta-slate)' }}>
            <img src={existingScreenshot.url} alt="Current screenshot" className="h-24 w-full object-cover" />
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => setExistingScreenshot(null)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              title="Remove screenshot"
            >
              <X size={11} />
            </motion.button>
          </div>
        ) : (
          <div
            ref={dropZoneRef}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-2 py-3 text-center transition-colors"
            style={{
              borderColor: dragActive ? 'var(--ta-accent)' : 'var(--ta-slate)',
              backgroundColor: dragActive ? 'rgba(235,94,40,0.08)' : 'transparent',
            }}
          >
            <ImagePlus size={16} style={{ color: 'var(--ta-slate)' }} />
            <p className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>
              Drop, click to browse, or paste (Ctrl+V)
            </p>
          </div>
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
      </div>

      {error && (
        <p className="text-[10px] font-medium" style={{ color: '#dc2626' }}>{error}</p>
      )}

      {/* 11. Add / Update button — Cancel sits alongside it while editing. */}
      <div className="mt-1 flex gap-1.5">
        {editingTradeId && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleCancelEdit}
            disabled={saving}
            className="rounded-md border py-2 px-3 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-60"
            style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
          >
            Cancel
          </motion.button>
        )}
        <motion.button
          type="button"
          animate={pulseControls}
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={saving}
          className="flex-1 rounded-md py-2 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: 'var(--ta-accent)' }}
        >
          {saving ? (editingTradeId ? 'Saving…' : 'Adding…') : editingTradeId ? 'Save changes' : 'Add'}
        </motion.button>
      </div>
    </div>
  )
}
