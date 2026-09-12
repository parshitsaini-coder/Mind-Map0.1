import { AnimatePresence, motion } from 'framer-motion'
import { X, PencilLine } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import TradeForm from './TradeForm'

// Step 8 (revised) — clicking the pencil icon on a table row now opens
// this centered popup instead of switching the sidebar into an "editing"
// state. It reuses TradeForm (mode="modal") for every field, so edits stay
// in lockstep with whatever the "New Trade" form supports — only the shell
// around it differs, matching the same backdrop/spring-scale pattern as
// ValidationRulesModal.jsx.
export default function EditTradeModal() {
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)
  const trade = useTradeAnalysisStore((s) => s.trades.find((t) => t.id === s.editingTradeId))
  const open = Boolean(editingTradeId && trade)

  const close = () => useTradeAnalysisStore.getState().cancelEditingTrade()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-[340px] flex-col overflow-hidden rounded-xl border shadow-2xl"
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
                <PencilLine size={12} color="#fffcf2" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--ta-ink)' }}>
                  Edit Trade
                </p>
                {trade && (
                  <p className="truncate text-[9px] leading-tight" style={{ color: 'var(--ta-slate)' }}>
                    {trade.pair} · {trade.date}
                  </p>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={close}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={14} />
              </motion.button>
            </div>

            {/* Body — scrolls independently so the header stays put */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <TradeForm mode="modal" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
