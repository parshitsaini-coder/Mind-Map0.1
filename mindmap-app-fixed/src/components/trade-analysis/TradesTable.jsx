import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Pencil, Trash2, Camera, PartyPopper } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import StatusDropdown from './StatusDropdown'

// Step 10 (polish pass) note: status pill colors now live in
// StatusDropdown.jsx alongside the custom animated menu that replaced the
// native <select> below.

const TYPE_BADGE_STYLE = {
  Equity: { bg: 'rgba(235,94,40,0.18)', text: '#c1450f' }, // warm orange
  Forex: { bg: 'rgba(37,99,235,0.16)', text: '#1d4ed8' }, // blue
  Commodity: { bg: 'rgba(217,119,6,0.18)', text: '#b45309' }, // gold/amber
}

const TIMEFRAME_BADGE_STYLE = {
  '1m': { bg: 'rgba(20,184,166,0.16)', text: '#0f766e' },
  '5m': { bg: 'rgba(20,184,166,0.16)', text: '#0f766e' },
  '15m': { bg: 'rgba(139,92,246,0.16)', text: '#6d28d9' },
  '30m': { bg: 'rgba(139,92,246,0.16)', text: '#6d28d9' },
  '60m': { bg: 'rgba(219,39,119,0.16)', text: '#be185d' },
  '1H': { bg: 'rgba(219,39,119,0.16)', text: '#be185d' },
  '4H': { bg: 'rgba(2,132,199,0.16)', text: '#0369a1' },
  '1D': { bg: 'rgba(22,163,74,0.16)', text: '#15803d' },
}
const TIMEFRAME_DEFAULT_STYLE = { bg: 'rgba(75,85,99,0.16)', text: '#374151' }

// Step 6 of trade-analysis-master-prompt.md — the entries table, replacing
// the Step 2 body placeholder. Columns match the spec table exactly.
export default function TradesTable() {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const filters = useTradeAnalysisStore((s) => s.filters)
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const [expandedNotes, setExpandedNotes] = useState(() => new Set())
  const [uploadingResultId, setUploadingResultId] = useState(null)
  const resultInputRefs = useRef({})
  const [editingPnlId, setEditingPnlId] = useState(null)
  const [pnlDraft, setPnlDraft] = useState('')

  // "Pow" pass — flash-highlight whichever row was just added, and pop a
  // little confetti burst on whichever row just got marked Target Hit.
  // Both are purely cosmetic, timer-driven bits of local state; they never
  // touch the store, so nothing about the underlying data changes.
  const [freshRowId, setFreshRowId] = useState(null)
  const [celebrateRowId, setCelebrateRowId] = useState(null)
  const knownIdsRef = useRef(new Set(trades.map((t) => t.id)))
  const prevStatusRef = useRef(new Map(trades.map((t) => [t.id, t.status])))

  useEffect(() => {
    const known = knownIdsRef.current
    const prevStatus = prevStatusRef.current
    for (const t of trades) {
      if (!known.has(t.id)) {
        setFreshRowId(t.id)
        const timer = setTimeout(() => setFreshRowId((id) => (id === t.id ? null : id)), 1400)
        known.add(t.id)
        // eslint-disable-next-line no-loop-func
        return () => clearTimeout(timer)
      }
      if (prevStatus.get(t.id) && prevStatus.get(t.id) !== t.status && t.status === 'Target Hit') {
        setCelebrateRowId(t.id)
        const timer = setTimeout(() => setCelebrateRowId((id) => (id === t.id ? null : id)), 900)
        return () => clearTimeout(timer)
      }
      prevStatus.set(t.id, t.status)
    }
    known.forEach((id) => {
      if (!trades.some((t) => t.id === id)) known.delete(id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades])

  const ruleLabelById = useMemo(() => {
    const map = new Map()
    validationRules.forEach((r) => map.set(r.id, r.label))
    return map
  }, [validationRules])

  // Step 7 — apply the Filters popover's selections. Every filter is
  // optional (null = "don't filter on this"); a trade must satisfy all
  // of the ones that are set.
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filters.pair && t.pair !== filters.pair) return false
      if (filters.instrumentType && t.instrumentType !== filters.instrumentType) return false
      if (filters.timeframe && t.timeframe !== filters.timeframe) return false
      if (filters.direction && t.direction !== filters.direction) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.validationRuleId && !(t.validationRuleIds || []).includes(filters.validationRuleId)) return false
      if (filters.dateFrom && t.date < filters.dateFrom) return false
      if (filters.dateTo && t.date > filters.dateTo) return false
      return true
    })
  }, [trades, filters])

  const toggleNotes = (id) =>
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startEditPnl = (trade) => {
    setEditingPnlId(trade.id)
    setPnlDraft(trade.pnl == null ? '' : String(trade.pnl))
  }
  const commitPnl = (id) => {
    const val = pnlDraft.trim()
    const num = val === '' ? null : Number(val)
    useTradeAnalysisStore.getState().updateTradePnl(id, val === '' || Number.isNaN(num) ? null : num)
    setEditingPnlId(null)
  }

  const handleResultImagePick = async (trade, file) => {
    if (!file) return
    setUploadingResultId(trade.id)
    try {
      const { url, hosted, error } = await uploadTradeImage(file)
      useTradeAnalysisStore.getState().updateTradeResultImage(trade.id, url, hosted)
      if (!hosted) {
        useUiStore
          .getState()
          .showToast(error ? 'Result image saved locally — upload failed.' : 'Result image saved locally — connect Cloudinary to host it.')
      }
    } finally {
      setUploadingResultId(null)
    }
  }

  if (trades.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-3xl"
        >
          📈
        </motion.span>
        <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades logged yet</p>
        <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
          Fill in the form on the left and hit Add to log your first trade here.
        </p>
      </motion.div>
    )
  }

  if (filteredTrades.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <motion.span
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-3xl"
        >
          🔍
        </motion.span>
        <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades match these filters</p>
        <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
          Try widening a filter, or clear them all from the Filters button above.
        </p>
      </motion.div>
    )
  }

  const th = 'group relative sticky top-0 z-10 whitespace-nowrap px-2 py-1.5 text-left text-[8.5px] font-extrabold uppercase tracking-wider transition-colors'
  const td = 'whitespace-nowrap px-2 py-1 align-middle text-[9px]'

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full min-w-[1260px] border-collapse">
        <thead>
          <tr style={{ backgroundColor: 'var(--ta-surface)' }}>
            {['No.', 'Date', 'Stock/Forex', 'Type', 'Time frame', 'Direction', 'Price', 'P&L', 'Screenshot', 'Status', 'Validation', 'Notes', 'Result', 'Actions'].map(
              (h) => (
                <th
                  key={h}
                  className={th}
                  style={{ color: 'var(--ta-ink)', borderBottom: '2px solid var(--ta-slate)' }}
                >
                  <span className="relative inline-block pb-0.5">
                    {h}
                    <span
                      className="absolute -bottom-[3px] left-0 h-[2px] w-full origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100"
                      style={{ backgroundColor: 'var(--ta-accent)' }}
                    />
                  </span>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {filteredTrades.map((trade, idx) => {
              const notesExpanded = expandedNotes.has(trade.id)
              const checkedRules = (trade.validationRuleIds || []).map((id) => ruleLabelById.get(id)).filter(Boolean)
              const isFresh = trade.id === freshRowId
              const isCelebrating = trade.id === celebrateRowId
              return (
                <motion.tr
                  key={trade.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    backgroundColor: isFresh
                      ? ['rgba(235,94,40,0.28)', 'rgba(235,94,40,0.28)', 'rgba(235,94,40,0)']
                      : trade.id === editingTradeId
                        ? 'rgba(235,94,40,0.08)'
                        : 'rgba(235,94,40,0)',
                    transition: isFresh
                      ? { duration: 1.3, times: [0, 0.15, 1], ease: 'easeOut' }
                      : { delay: Math.min(idx, 12) * 0.03, duration: 0.22 },
                  }}
                  exit={{ opacity: 0, x: 16, scale: 0.98, transition: { duration: 0.15 } }}
                  whileHover={{ scale: 1.004, boxShadow: '0 2px 10px rgba(64,61,57,0.12)' }}
                  className="relative"
                  style={{
                    borderBottom: '1px solid rgba(64,61,57,0.15)',
                    position: 'relative',
                  }}
                >
                  <td className={td} style={{ color: 'var(--ta-slate)' }}>
                    <span className="relative inline-flex items-center">
                      {idx + 1}
                      <AnimatePresence>
                        {isCelebrating && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.4, y: 0 }}
                            animate={{ opacity: 1, scale: 1.3, y: -14 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                            className="pointer-events-none absolute -right-3 -top-1"
                            style={{ color: '#16a34a' }}
                          >
                            <PartyPopper size={12} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </td>

                  <td className={td} style={{ color: 'var(--ta-ink)' }}>{trade.date}</td>

                  <td className={td}>
                    <p className="font-medium" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
                    {trade.instrumentName && trade.instrumentName !== trade.pair && (
                      <p className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
                    )}
                  </td>

                  <td className={td}>
                    <motion.span
                      whileHover={{ scale: 1.08, y: -1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                      style={{
                        backgroundColor: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).bg,
                        color: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).text,
                      }}
                    >
                      {trade.instrumentType}
                    </motion.span>
                  </td>

                  <td className={td}>
                    <motion.span
                      whileHover={{ scale: 1.08, y: -1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                      style={{
                        backgroundColor: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).bg,
                        color: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).text,
                      }}
                    >
                      {trade.timeframe}
                    </motion.span>
                  </td>

                  <td className={td}>
                    <motion.span
                      whileHover={{ scale: 1.1 }}
                      animate={trade.direction === 'Buy' ? { y: [0, -1, 0] } : { y: [0, 1, 0] }}
                      transition={{ y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
                      className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
                      style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
                    >
                      {trade.direction}
                    </motion.span>
                  </td>

                  <td className={td} style={{ color: 'var(--ta-ink)' }}>{trade.price}</td>

                  {/* P&L — click the value (or the dash) to edit it inline;
                      Enter/blur saves, Escape cancels. Green/red by sign,
                      same convention as the Direction badge. */}
                  <td className={td}>
                    {editingPnlId === trade.id ? (
                      <motion.input
                        autoFocus
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={pnlDraft}
                        onChange={(e) => setPnlDraft(e.target.value)}
                        onBlur={() => commitPnl(trade.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitPnl(trade.id)
                          if (e.key === 'Escape') setEditingPnlId(null)
                        }}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-16 rounded border px-1 py-0.5 text-[9px] outline-none"
                        style={{ borderColor: 'var(--ta-accent)', color: 'var(--ta-ink)' }}
                      />
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => startEditPnl(trade)}
                        title="Click to edit P&L"
                        className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold transition-colors hover:brightness-95"
                        style={
                          trade.pnl == null
                            ? { color: 'var(--ta-slate)', border: '1px dashed var(--ta-slate)' }
                            : trade.pnl > 0
                              ? { backgroundColor: 'rgba(22,163,74,0.14)', color: '#16a34a' }
                              : trade.pnl < 0
                                ? { backgroundColor: 'rgba(220,38,38,0.14)', color: '#dc2626' }
                                : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
                        }
                      >
                        {trade.pnl == null ? '+ Add' : `${trade.pnl > 0 ? '+' : ''}${trade.pnl}`}
                      </motion.button>
                    )}
                  </td>

                  <td className={td}>
                    {trade.screenshotUrl ? (
                      <button
                        onClick={() => useUiStore.getState().openImageLightbox(trade.screenshotUrl)}
                        title="View screenshot"
                      >
                        <img src={trade.screenshotUrl} alt="Screenshot" className="h-6 w-6 rounded object-cover" />
                      </button>
                    ) : (
                      <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                    )}
                  </td>

                  <td className={td}>
                    <StatusDropdown
                      value={trade.status}
                      onChange={(next) => useTradeAnalysisStore.getState().updateTradeStatus(trade.id, next)}
                    />
                  </td>

                  <td className={`${td} whitespace-normal`}>
                    <div className="flex max-w-[150px] flex-wrap items-center gap-1">
                      {checkedRules.length === 0 ? (
                        <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                      ) : (
                        checkedRules.map((label) => (
                          <span
                            key={label}
                            className="truncate rounded-full px-1.5 py-0.5 text-[7.5px]"
                            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                          >
                            {label}
                          </span>
                        ))
                      )}
                      {trade.validationScore && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
                          style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                        >
                          {trade.validationScore.checked}/{trade.validationScore.total}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className={`${td} ${notesExpanded ? 'whitespace-normal' : ''}`}>
                    {trade.notes ? (
                      <button
                        onClick={() => toggleNotes(trade.id)}
                        className={`text-left ${notesExpanded ? 'max-w-[220px]' : 'max-w-[120px] truncate'} block`}
                        title={notesExpanded ? 'Click to collapse' : trade.notes}
                        style={{ color: 'var(--ta-ink)' }}
                      >
                        {trade.notes}
                      </button>
                    ) : (
                      <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                    )}
                  </td>

                  <td className={td}>
                    {trade.resultImageUrl ? (
                      <button
                        onClick={() => useUiStore.getState().openImageLightbox(trade.resultImageUrl)}
                        title="View result image"
                      >
                        <img src={trade.resultImageUrl} alt="Result" className="h-6 w-6 rounded object-cover" />
                      </button>
                    ) : (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => resultInputRefs.current[trade.id]?.click()}
                          disabled={uploadingResultId === trade.id}
                          title="Attach result / P&L image"
                          className="flex h-8 w-8 items-center justify-center rounded border border-dashed disabled:opacity-40"
                          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}
                        >
                          {uploadingResultId === trade.id ? <Camera size={12} className="animate-pulse" /> : <ImagePlus size={12} />}
                        </motion.button>
                        <input
                          ref={(el) => { resultInputRefs.current[trade.id] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            handleResultImagePick(trade, file)
                          }}
                        />
                      </>
                    )}
                  </td>

                  <td className={td}>
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => useTradeAnalysisStore.getState().setEditingTrade(trade.id)}
                        title="Edit"
                        className="rounded p-1 hover:bg-black/5"
                        style={{ color: 'var(--ta-slate)' }}
                      >
                        <Pencil size={12} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => {
                          if (!window.confirm('Delete this trade? This cannot be undone.')) return
                          useTradeAnalysisStore.getState().deleteTrade(trade.id)
                        }}
                        title="Delete"
                        className="rounded p-1 hover:bg-black/5"
                        style={{ color: '#dc2626' }}
                      >
                        <Trash2 size={12} />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
