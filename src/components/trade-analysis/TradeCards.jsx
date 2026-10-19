import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Pencil, Trash2, Camera, PartyPopper, StickyNote, ListChecks } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import StatusDropdown from './StatusDropdown'
import ApplyValidationModal from './ApplyValidationModal'
import PasteImageMenu from './PasteImageMenu'
import { TYPE_BADGE_STYLE, TIMEFRAME_BADGE_STYLE, TIMEFRAME_DEFAULT_STYLE } from './TradesTable'
import { symbolForType } from '../../utils/currency'
import { applyFilters } from '../../utils/tradeFilters'

// One card. Memoised with stable callbacks from the parent so typing in the
// form, opening a popup or editing one card's P&L never re-renders the other
// cards. All hover/entrance effects are CSS (compositor only) — no per-card
// framer-motion layout measurement, which is what made big lists hang.
const TradeCard = memo(function TradeCard({
  trade, ruleById, isEditing, isCelebrating, uploading,
  onValidation, onPasteMenu, onPickResult, onStatusChange,
}) {
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [editingPnl, setEditingPnl] = useState(false)
  const [pnlDraft, setPnlDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const checkedRules = useMemo(
    () => (trade.validationRuleIds || []).map((id) => {
      const r = ruleById.get(id)
      return r ? { id, ...r } : null
    }).filter(Boolean),
    [trade.validationRuleIds, ruleById]
  )

  const startEditPnl = () => {
    setEditingPnl(true)
    setPnlDraft(trade.pnl == null ? '' : String(trade.pnl))
  }
  const commitPnl = () => {
    const val = pnlDraft.trim()
    const num = val === '' ? null : Number(val)
    useTradeAnalysisStore.getState().updateTradePnl(trade.id, val === '' || Number.isNaN(num) ? null : num)
    setEditingPnl(false)
  }

  return (
    <div
      className="ta-trade-card ta-card-glow relative flex flex-col gap-2 rounded-2xl border p-2.5"
      style={{
        backgroundColor: 'var(--ta-surface)',
        borderColor: isEditing ? 'var(--ta-accent)' : 'var(--ta-slate)',
      }}
    >
                {isCelebrating && (
                  <span
                    className="ta-celebrate pointer-events-none absolute right-2 top-2 z-10"
                    style={{ color: '#16a34a' }}
                  >
                    <PartyPopper size={14} />
                  </span>
                )}

                {/* Header — pair/instrument + date, actions top-right */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
                    {trade.instrumentName && trade.instrumentName !== trade.pair && (
                      <p className="truncate text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{
                        scale: 1.06,
                        backgroundColor: 'color-mix(in srgb, var(--ta-accent) 26%, transparent)',
                      }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--ta-accent) 16%, transparent)',
                        color: 'var(--ta-accent)',
                      }}
                    >
                      {trade.date}
                    </span>
                    <button
                      onClick={() => onValidation(trade.id)}
                      title="Validation"
                      className="rounded p-1 hover:bg-black/5"
                      style={{ color: 'var(--ta-slate)' }}
                    >
                      <ListChecks size={11} />
                    </button>
                    <button
                      onClick={() => useTradeAnalysisStore.getState().setEditingTrade(trade.id)}
                      title="Edit"
                      className="rounded p-1 hover:bg-black/5"
                      style={{ color: 'var(--ta-slate)' }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm('Delete this trade? This cannot be undone.')) return
                        useTradeAnalysisStore.getState().deleteTrade(trade.id)
                      }}
                      title="Delete"
                      className="rounded p-1 hover:bg-black/5"
                      style={{ color: '#dc2626' }}
                    >
                      <Trash2 size={11} />
                    </button>
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
                  <span className="ml-auto text-[10.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>
                    {trade.price != null && trade.price !== '' ? <>{symbolForType(trade.instrumentType)}{trade.price}</> : null}
                  </span>
                </div>

                {/* P&L + Status */}
                <div className="flex items-center justify-between gap-1.5">
                  {editingPnl ? (
                    <input
                      autoFocus
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={pnlDraft}
                      onChange={(e) => setPnlDraft(e.target.value)}
                      onBlur={() => commitPnl()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitPnl()
                        if (e.key === 'Escape') setEditingPnl(false)
                      }}
                      className="w-16 rounded border px-1 py-0.5 text-[9px] outline-none"
                      style={{ borderColor: 'var(--ta-accent)', color: 'var(--ta-ink)' }}
                    />
                  ) : (
                    <button
                      onClick={() => startEditPnl()}
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
                      {trade.pnl == null
                        ? '+ Add P&L'
                        : `${trade.pnl > 0 ? '+' : ''}${symbolForType(trade.instrumentType)}${trade.pnl}`}
                    </button>
                  )}

                  <StatusDropdown value={trade.status} onChange={(next) => onStatusChange(trade, next)} />
                </div>

                {/* Screenshot + Result images side by side */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[7px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>Setup</span>
                    {trade.screenshotUrl ? (
                      <button
                        className="ta-thumb overflow-hidden rounded"
                        onClick={() =>
                          useUiStore
                            .getState()
                            .openImageLightbox(trade.screenshotUrl, () =>
                              useTradeAnalysisStore.getState().autosaveTrade(trade.id, { screenshotUrl: null, screenshotHosted: false })
                            )
                        }
                        title="View screenshot"
                      >
                        <img src={trade.screenshotUrl} alt="Screenshot" loading="lazy" decoding="async" className="h-10 w-10 object-cover" />
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
                      <button
                        className="ta-thumb overflow-hidden rounded"
                        onClick={() =>
                          useUiStore
                            .getState()
                            .openImageLightbox(trade.resultImageUrl, () =>
                              useTradeAnalysisStore.getState().updateTradeResultImage(trade.id, null, false)
                            )
                        }
                        title="View result image"
                      >
                        <img src={trade.resultImageUrl} alt="Result" loading="lazy" decoding="async" className="h-10 w-10 object-cover" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => inputRef.current?.click()}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            onPasteMenu({ x: e.clientX, y: e.clientY, trade })
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOver(true)
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOver(false)
                            const file = e.dataTransfer.files?.[0]
                            if (file) onPickResult(trade, file)
                          }}
                          disabled={uploading}
                          title="Attach result / P&L image — click, drag & drop, or right-click to paste"
                          className="flex h-10 w-10 items-center justify-center rounded border border-dashed disabled:opacity-40"
                          style={{ color: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)', borderColor: dragOver ? 'var(--ta-accent)' : undefined, transform: dragOver ? 'scale(1.12)' : undefined }}
                        >
                          {uploading ? <Camera size={13} className="animate-pulse" /> : <ImagePlus size={14} />}
                        </button>
                        <input
                          ref={inputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            onPickResult(trade, file)
                          }}
                        />
                      </>
                    )}
                  </div>

                  {/* Validation score — the thumbnails row keeps only the
                      compact N/Total pill; the individual rule badges now
                      live in their own full-width row below, where up to
                      10 of them have room to wrap cleanly across the
                      card instead of being squeezed into this row's
                      leftover space. */}
                  {trade.validationScore && (
                    <span
                      className="ml-auto shrink-0 self-start rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
                      style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                    >
                      {trade.validationScore.checked}/{trade.validationScore.total}
                    </span>
                  )}
                </div>

                {(trade.setupTypes || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {trade.setupTypes.map((name) => (
                      <span
                        key={name}
                        className="truncate rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold"
                        style={{ borderColor: 'var(--ta-accent)', color: 'var(--ta-accent)', maxWidth: 110 }}
                        title={`Setup: ${name}`}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Validation badges — full-width wrap row, up to 10 rule
                    labels. Sits on its own line (rather than squeezed
                    beside the thumbnails) so a trade with many checked
                    rules still reads cleanly instead of truncating after
                    just 3. */}
                {checkedRules.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {checkedRules.slice(0, 10).map((rule) => (
                      <span
                        key={rule.id}
                        className="truncate rounded-full px-1.5 py-0.5 text-[7.5px]"
                        style={{ backgroundColor: rule.color || 'var(--ta-bg)', color: 'var(--ta-ink)', maxWidth: 96 }}
                        title={rule.label}
                      >
                        {rule.label}
                      </span>
                    ))}
                    {checkedRules.length > 10 && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold"
                        style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}
                        title={checkedRules.slice(10).map((r) => r.label).join(', ')}
                      >
                        +{checkedRules.length - 10} more
                      </span>
                    )}
                  </div>
                )}

                {/* Notes — collapsed to one line, expandable */}
                {trade.notes && (
                  <button
                    onClick={() => setNotesExpanded((v) => !v)}
                    className={`flex items-start gap-1 rounded-lg px-1.5 py-1 text-left text-[9px] ${notesExpanded ? '' : 'truncate'}`}
                    title={notesExpanded ? 'Click to collapse' : trade.notes}
                    style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                  >
                    <StickyNote size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--ta-slate)' }} />
                    <span className={notesExpanded ? '' : 'truncate'}>{trade.notes}</span>
                  </button>
                )}
    </div>
  )
})

export default function TradeCards() {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const filters = useTradeAnalysisStore((s) => s.filters)
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const [uploadingResultId, setUploadingResultId] = useState(null)
  const [pasteMenu, setPasteMenu] = useState(null)
  const [celebrateId, setCelebrateId] = useState(null)
  const [validationCardId, setValidationCardId] = useState(null)
  const validationCardTrade = useMemo(
    () => trades.find((t) => t.id === validationCardId) || null,
    [trades, validationCardId]
  )
  const prevStatusRef = useRef(new Map(trades.map((t) => [t.id, t.status])))

  const ruleById = useMemo(() => {
    const map = new Map()
    validationRules.forEach((r) => map.set(r.id, { label: r.label, color: r.color }))
    return map
  }, [validationRules])

  const filteredTrades = useMemo(() => {
    return applyFilters(trades, filters).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
  }, [trades, filters])

  const celebrate = useCallback((id) => {
    setCelebrateId(id)
    setTimeout(() => setCelebrateId((cur) => (cur === id ? null : cur)), 900)
  }, [])

  const handleResultImagePick = useCallback(async (trade, file) => {
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
      if (trade.status === 'Target Hit') celebrate(trade.id)
    } finally {
      setUploadingResultId(null)
    }
  }, [celebrate])

  const handleStatusChange = useCallback((trade, next) => {
    useTradeAnalysisStore.getState().updateTradeStatus(trade.id, next)
    if (prevStatusRef.current.get(trade.id) !== next && next === 'Target Hit') celebrate(trade.id)
    prevStatusRef.current.set(trade.id, next)
  }, [celebrate])

  const openValidation = useCallback((id) => setValidationCardId(id), [])
  const openPasteMenu = useCallback((m) => setPasteMenu(m), [])

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
    <div className="ta-scroll-area h-full w-full overflow-auto p-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            ruleById={ruleById}
            isEditing={trade.id === editingTradeId}
            isCelebrating={trade.id === celebrateId}
            uploading={uploadingResultId === trade.id}
            onValidation={openValidation}
            onPasteMenu={openPasteMenu}
            onPickResult={handleResultImagePick}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <ApplyValidationModal
        open={!!validationCardId}
        onClose={() => setValidationCardId(null)}
        checkedIds={validationCardTrade?.validationRuleIds || []}
        onToggle={(ruleId) => useTradeAnalysisStore.getState().toggleTradeValidationRule(validationCardId, ruleId)}
      />

      <PasteImageMenu
        pos={pasteMenu ? { x: pasteMenu.x, y: pasteMenu.y } : null}
        onClose={() => setPasteMenu(null)}
        onFile={(file) => pasteMenu && handleResultImagePick(pasteMenu.trade, file)}
      />
    </div>
  )
}
