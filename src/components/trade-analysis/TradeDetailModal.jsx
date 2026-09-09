import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, TrendingUp, Pencil, Link2Off, ArrowUpRight } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'

const TYPE_BADGE_STYLE = {
  Equity: { bg: 'rgba(235,94,40,0.18)', text: '#c1450f' },
  Forex: { bg: 'rgba(37,99,235,0.16)', text: '#1d4ed8' },
  Commodity: { bg: 'rgba(217,119,6,0.18)', text: '#b45309' },
}
const STATUS_STYLE = {
  Pending: { bg: 'rgba(235,94,40,0.14)', text: '#c1450f' },
  'Target Hit': { bg: 'rgba(95,138,82,0.16)', text: '#4c6f42' },
  'SL Hit': { bg: 'rgba(179,80,58,0.16)', text: '#9c4a34' },
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-slate)]">{label}</p>
      <div className="text-xs text-[var(--color-ink)]">{children}</div>
    </div>
  )
}

// Opened by clicking a node's linked-trade badge on the canvas (or "View"
// in the inspector's Linked Trade section). Read-only snapshot of
// everything logged for that trade in Trade Analysis — including every
// validation-rule/checklist entry that was ticked — so the person doesn't
// have to leave the mind map to see why that node is tied to that trade.
// "Edit in Trade Analysis" hands off to the real editable form there.
export default function TradeDetailModal() {
  const detail = useUiStore((s) => s.tradeDetail)
  const close = useUiStore((s) => s.closeTradeDetail)
  const trade = useTradeAnalysisStore((s) => (detail ? s.trades.find((t) => t.id === detail.tradeId) : null))
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const updateNodeData = useMapStore((s) => s.updateNodeData)

  const open = Boolean(detail)

  const checkedRules = useMemo(() => {
    if (!trade) return []
    const byId = new Map(validationRules.map((r) => [r.id, r.label]))
    return (trade.validationRuleIds || []).map((id) => byId.get(id)).filter(Boolean)
  }, [trade, validationRules])

  const unlink = () => {
    if (detail?.nodeId) updateNodeData(detail.nodeId, { linkedTradeId: null })
    close()
  }

  const editInTradeAnalysis = () => {
    if (!trade) return
    const ta = useTradeAnalysisStore.getState()
    ta.setActiveView('table')
    ta.setEditingTrade(trade.id)
    ta.open()
    close()
  }

  return (
    <AnimatePresence>
      {open && trade && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-lg border shadow-2xl"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
          >
            <div
              className="flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2"
              style={{ borderColor: 'var(--color-sage)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <TrendingUp size={13} className="shrink-0 text-[var(--color-slate)]" />
                  <span className="truncate text-sm font-semibold text-[var(--color-ink)]">{trade.pair}</span>
                  {TYPE_BADGE_STYLE[trade.instrumentType] && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                      style={{
                        backgroundColor: TYPE_BADGE_STYLE[trade.instrumentType].bg,
                        color: TYPE_BADGE_STYLE[trade.instrumentType].text,
                      }}
                    >
                      {trade.instrumentType}
                    </span>
                  )}
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
                    style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
                  >
                    {trade.direction}
                  </span>
                </div>
                {trade.instrumentName && trade.instrumentName !== trade.pair && (
                  <p className="truncate text-[10px] text-[var(--color-slate)]">{trade.instrumentName}</p>
                )}
              </div>
              <button
                onClick={close}
                className="shrink-0 rounded-full p-1 text-[var(--color-slate)] hover:bg-[var(--color-sage)]/60 hover:text-[var(--color-ink)]"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Date">{trade.date}</Field>
                <Field label="Timeframe">{trade.timeframe}</Field>
                <Field label="Price">{trade.price || '—'}</Field>
              </div>

              <Field label="Status">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: (STATUS_STYLE[trade.status] || STATUS_STYLE.Pending).bg,
                    color: (STATUS_STYLE[trade.status] || STATUS_STYLE.Pending).text,
                  }}
                >
                  {trade.status}
                </span>
              </Field>

              <Field label={`Validation checklist (${checkedRules.length}/${validationRules.length || 0})`}>
                {checkedRules.length === 0 ? (
                  <p className="text-[var(--color-slate)]">No validation rules were checked on this trade.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {checkedRules.map((label) => (
                      <li
                        key={label}
                        className="rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{ backgroundColor: 'var(--color-sage)' }}
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              {trade.notes && (
                <Field label="Notes">
                  <p className="whitespace-pre-wrap break-words">{trade.notes}</p>
                </Field>
              )}

              {(trade.screenshotUrl || trade.resultImageUrl) && (
                <div className="flex gap-2">
                  {trade.screenshotUrl && (
                    <Field label="Screenshot">
                      <button onClick={() => useUiStore.getState().openImageLightbox(trade.screenshotUrl)}>
                        <img
                          src={trade.screenshotUrl}
                          alt="Entry screenshot"
                          className="h-14 w-14 rounded object-cover"
                        />
                      </button>
                    </Field>
                  )}
                  {trade.resultImageUrl && (
                    <Field label="Result">
                      <button onClick={() => useUiStore.getState().openImageLightbox(trade.resultImageUrl)}>
                        <img
                          src={trade.resultImageUrl}
                          alt="Result screenshot"
                          className="h-14 w-14 rounded object-cover"
                        />
                      </button>
                    </Field>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2"
              style={{ borderColor: 'var(--color-sage)' }}
            >
              <button
                onClick={unlink}
                className="flex items-center gap-1 text-[10px] text-[var(--color-slate)] underline hover:text-[#c1443c]"
              >
                <Link2Off size={11} /> Unlink from this node
              </button>
              <button
                onClick={editInTradeAnalysis}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <Pencil size={11} /> Edit in Trade Analysis <ArrowUpRight size={11} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
