import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Pencil, Trash2, Camera } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'

const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']

// Step 10 (polish pass) — status pills use tints derived from the palette
// itself (--ta-accent's amber warmth, and muted green/rust variants at the
// same saturation/lightness) rather than stock Tailwind red-600/green-600,
// so they read as part of this module's theme. Buy/Sell direction badges
// are the one deliberate exception in this feature and keep saturated
// trading-standard green/red (see TradeForm.jsx / below).
const STATUS_STYLE = {
  Pending: { bg: 'rgba(235,94,40,0.14)', text: 'var(--ta-accent)' }, // amber-ish, straight off --ta-accent
  'Target Hit': { bg: 'rgba(95,138,82,0.16)', text: '#4c6f42' }, // muted, palette-weight green
  'SL Hit': { bg: 'rgba(179,80,58,0.16)', text: '#9c4a34' }, // muted rust-red, warm like --ta-accent but distinct
}

const TYPE_BADGE_BG = { Equity: '#eb5e2822', Forex: '#403d3922', Commodity: '#25242222' }

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
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-3xl">📈</span>
        <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades logged yet</p>
        <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
          Fill in the form on the left and hit Add to log your first trade here.
        </p>
      </div>
    )
  }

  if (filteredTrades.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-3xl">🔍</span>
        <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades match these filters</p>
        <p className="max-w-[220px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
          Try widening a filter, or clear them all from the Filters button above.
        </p>
      </div>
    )
  }

  const th = 'sticky top-0 z-10 whitespace-nowrap px-2.5 py-2 text-left text-[9px] font-semibold uppercase tracking-wide'
  const td = 'whitespace-nowrap px-2.5 py-2 align-middle text-[10.5px]'

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full min-w-[1180px] border-collapse">
        <thead>
          <tr style={{ backgroundColor: 'var(--ta-surface)' }}>
            {['No.', 'Date', 'Stock/Forex', 'Type', 'Time frame', 'Direction', 'Price', 'Screenshot', 'Status', 'Validation', 'Notes', 'Result', 'Actions'].map(
              (h) => (
                <th key={h} className={th} style={{ color: 'var(--ta-slate)', borderBottom: '1px solid var(--ta-slate)' }}>
                  {h}
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
              return (
                <motion.tr
                  key={trade.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx, 12) * 0.03, duration: 0.22 } }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
                  style={{
                    borderBottom: '1px solid rgba(64,61,57,0.15)',
                    backgroundColor: trade.id === editingTradeId ? 'rgba(235,94,40,0.08)' : 'transparent',
                  }}
                >
                  <td className={td} style={{ color: 'var(--ta-slate)' }}>{idx + 1}</td>

                  <td className={td} style={{ color: 'var(--ta-ink)' }}>{trade.date}</td>

                  <td className={td}>
                    <p className="font-medium" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
                    {trade.instrumentName && trade.instrumentName !== trade.pair && (
                      <p className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
                    )}
                  </td>

                  <td className={td}>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ backgroundColor: TYPE_BADGE_BG[trade.instrumentType] || '#403d3922', color: 'var(--ta-ink)' }}
                    >
                      {trade.instrumentType}
                    </span>
                  </td>

                  <td className={td} style={{ color: 'var(--ta-ink)' }}>{trade.timeframe}</td>

                  <td className={td}>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                      style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
                    >
                      {trade.direction}
                    </span>
                  </td>

                  <td className={td} style={{ color: 'var(--ta-ink)' }}>{trade.price}</td>

                  <td className={td}>
                    {trade.screenshotUrl ? (
                      <button
                        onClick={() => useUiStore.getState().openImageLightbox(trade.screenshotUrl)}
                        title="View screenshot"
                      >
                        <img src={trade.screenshotUrl} alt="Screenshot" className="h-8 w-8 rounded object-cover" />
                      </button>
                    ) : (
                      <span className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                    )}
                  </td>

                  <td className={td}>
                    <select
                      value={trade.status}
                      onChange={(e) => useTradeAnalysisStore.getState().updateTradeStatus(trade.id, e.target.value)}
                      className="rounded-full border-0 px-2 py-0.5 text-[9.5px] font-semibold outline-none transition-colors"
                      style={{ backgroundColor: STATUS_STYLE[trade.status].bg, color: STATUS_STYLE[trade.status].text }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  <td className={`${td} whitespace-normal`}>
                    <div className="flex max-w-[150px] flex-wrap items-center gap-1">
                      {checkedRules.length === 0 ? (
                        <span className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                      ) : (
                        checkedRules.map((label) => (
                          <span
                            key={label}
                            className="truncate rounded-full px-1.5 py-0.5 text-[8.5px]"
                            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                          >
                            {label}
                          </span>
                        ))
                      )}
                      {trade.validationScore && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold"
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
                      <span className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>—</span>
                    )}
                  </td>

                  <td className={td}>
                    {trade.resultImageUrl ? (
                      <button
                        onClick={() => useUiStore.getState().openImageLightbox(trade.resultImageUrl)}
                        title="View result image"
                      >
                        <img src={trade.resultImageUrl} alt="Result" className="h-8 w-8 rounded object-cover" />
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
