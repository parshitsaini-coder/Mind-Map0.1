import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Pencil, Trash2, Camera, PartyPopper, StickyNote } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import StatusDropdown from './StatusDropdown'
import { TYPE_BADGE_STYLE, TIMEFRAME_BADGE_STYLE, TIMEFRAME_DEFAULT_STYLE } from './TradesTable'

// Card-grid alternative to TradesTable's horizontal rows — same data, same
// store actions, just laid out as a responsive grid of cards (3-up on a
// wide screen, fewer as it narrows) instead of a wide scrolling table.
// Toggled from the top bar's List/Cards switch (TradeAnalysis.jsx), backed
// by tradeAnalysisStore's `entriesView`.
export default function TradeCards() {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const filters = useTradeAnalysisStore((s) => s.filters)
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const [expandedNotes, setExpandedNotes] = useState(() => new Set())
  const [uploadingResultId, setUploadingResultId] = useState(null)
  const resultInputRefs = useRef({})
  const [editingPnlId, setEditingPnlId] = useState(null)
  const [pnlDraft, setPnlDraft] = useState('')
  const [dragOverResultId, setDragOverResultId] = useState(null)
  const [celebrateId, setCelebrateId] = useState(null)
  const prevStatusRef = useRef(new Map(trades.map((t) => [t.id, t.status])))

  const ruleLabelById = useMemo(() => {
    const map = new Map()
    validationRules.forEach((r) => map.set(r.id, r.label))
    return map
  }, [validationRules])

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
      if (trade.status === 'Target Hit') {
        setCelebrateId(trade.id)
        setTimeout(() => setCelebrateId((id) => (id === trade.id ? null : id)), 900)
      }
    } finally {
      setUploadingResultId(null)
    }
  }

  const handleStatusChange = (trade, next) => {
    useTradeAnalysisStore.getState().updateTradeStatus(trade.id, next)
    if (prevStatusRef.current.get(trade.id) !== next && next === 'Target Hit') {
      setCelebrateId(trade.id)
      setTimeout(() => setCelebrateId((id) => (id === trade.id ? null : id)), 900)
    }
    prevStatusRef.current.set(trade.id, next)
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

  return (
    <div className="h-full w-full overflow-auto p-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {filteredTrades.map((trade, idx) => {
            const notesExpanded = expandedNotes.has(trade.id)
            const checkedRules = (trade.validationRuleIds || []).map((id) => ruleLabelById.get(id)).filter(Boolean)
            const isEditing = trade.id === editingTradeId
            const isCelebrating = trade.id === celebrateId

            return (
              <motion.div
                key={trade.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ delay: Math.min(idx, 12) * 0.03, duration: 0.22 }}
                whileHover={{ y: -2, boxShadow: '0 6px 20px -6px rgba(64,61,57,0.22)' }}
                className="ta-card-glow relative flex flex-col gap-2 rounded-2xl border p-2.5"
                style={{
                  backgroundColor: 'var(--ta-surface)',
                  borderColor: isEditing ? 'var(--ta-accent)' : 'var(--ta-slate)',
                }}
              >
                <AnimatePresence>
                  {isCelebrating && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.4, y: 0 }}
                      animate={{ opacity: 1, scale: 1.3, y: -10 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                      className="pointer-events-none absolute right-2 top-2 z-10"
                      style={{ color: '#16a34a' }}
                    >
                      <PartyPopper size={14} />
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Header — pair/instrument + date, actions top-right */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
                    {trade.instrumentName && trade.instrumentName !== trade.pair && (
                      <p className="truncate text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--ta-slate)' }}>{trade.date}</span>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => useTradeAnalysisStore.getState().setEditingTrade(trade.id)}
                      title="Edit"
                      className="rounded p-1 hover:bg-black/5"
                      style={{ color: 'var(--ta-slate)' }}
                    >
                      <Pencil size={11} />
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
                      <Trash2 size={11} />
                    </motion.button>
                  </div>
                </div>

                {/* Badges row — type / timeframe / direction */}
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                    style={{
                      backgroundColor: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).bg,
                      color: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).text,
                    }}
                  >
                    {trade.instrumentType}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).bg,
                      color: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).text,
                    }}
                  >
                    {trade.timeframe}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
                    style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
                  >
                    {trade.direction}
                  </span>
                  <span className="ml-auto text-[10.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>{trade.price}</span>
                </div>

                {/* P&L + Status */}
                <div className="flex items-center justify-between gap-1.5">
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
                      {trade.pnl == null ? '+ Add P&L' : `${trade.pnl > 0 ? '+' : ''}${trade.pnl}`}
                    </motion.button>
                  )}

                  <StatusDropdown value={trade.status} onChange={(next) => handleStatusChange(trade, next)} />
                </div>

                {/* Screenshot + Result images side by side */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[7px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>Setup</span>
                    {trade.screenshotUrl ? (
                      <button onClick={() => useUiStore.getState().openImageLightbox(trade.screenshotUrl)} title="View screenshot">
                        <img src={trade.screenshotUrl} alt="Screenshot" className="h-10 w-10 rounded object-cover" />
                      </button>
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-[7px]"
                        style={{ color: 'var(--ta-slate)', borderColor: 'var(--ta-slate)' }}
                      >
                        —
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[7px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>Result</span>
                    {trade.resultImageUrl ? (
                      <button onClick={() => useUiStore.getState().openImageLightbox(trade.resultImageUrl)} title="View result image">
                        <img src={trade.resultImageUrl} alt="Result" className="h-10 w-10 rounded object-cover" />
                      </button>
                    ) : (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => resultInputRefs.current[trade.id]?.click()}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverResultId(trade.id)
                          }}
                          onDragLeave={() => setDragOverResultId((id) => (id === trade.id ? null : id))}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOverResultId(null)
                            const file = e.dataTransfer.files?.[0]
                            if (file) handleResultImagePick(trade, file)
                          }}
                          disabled={uploadingResultId === trade.id}
                          title="Attach result / P&L image — click or drag & drop"
                          animate={{
                            scale: dragOverResultId === trade.id ? 1.12 : 1,
                            borderColor: dragOverResultId === trade.id ? 'var(--ta-accent)' : 'var(--ta-slate)',
                            backgroundColor: dragOverResultId === trade.id ? 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' : 'rgba(0,0,0,0)',
                          }}
                          transition={{ duration: 0.15 }}
                          className="flex h-10 w-10 items-center justify-center rounded border border-dashed disabled:opacity-40"
                          style={{ color: dragOverResultId === trade.id ? 'var(--ta-accent)' : 'var(--ta-slate)' }}
                        >
                          {uploadingResultId === trade.id ? <Camera size={13} className="animate-pulse" /> : <ImagePlus size={14} />}
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
                  </div>

                  {/* Validation badges */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 self-start">
                    {checkedRules.slice(0, 3).map((label) => (
                      <span
                        key={label}
                        className="truncate rounded-full px-1.5 py-0.5 text-[7.5px]"
                        style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)', maxWidth: 64 }}
                      >
                        {label}
                      </span>
                    ))}
                    {trade.validationScore && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
                        style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                      >
                        {trade.validationScore.checked}/{trade.validationScore.total}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes — collapsed to one line, expandable */}
                {trade.notes && (
                  <button
                    onClick={() => toggleNotes(trade.id)}
                    className={`flex items-start gap-1 rounded-lg px-1.5 py-1 text-left text-[9px] ${notesExpanded ? '' : 'truncate'}`}
                    title={notesExpanded ? 'Click to collapse' : trade.notes}
                    style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                  >
                    <StickyNote size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--ta-slate)' }} />
                    <span className={notesExpanded ? '' : 'truncate'}>{trade.notes}</span>
                  </button>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
