import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp, ChevronDown, Trash2, Plus, X } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'

// Step 5 of trade-analysis-master-prompt.md — the popup behind the top
// bar's "Add Validation Rule" button. Centered, backdrop blur, spring
// scale in/out. Rules created/edited/toggled/reordered/deleted here show
// up as the Step 3 form's checklist (field 9) and, later, as tags in the
// Step 6 table.
export default function ValidationRulesModal({ open, onClose }) {
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const [newLabel, setNewLabel] = useState('')

  const handleAdd = () => {
    const label = newLabel.trim()
    if (!label) return
    useTradeAnalysisStore.getState().addValidationRule(label)
    setNewLabel('')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-lg border p-4 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
                Manage Validation Rules
              </p>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={13} />
              </motion.button>
            </div>

            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {validationRules.length === 0 ? (
                <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                  No rules yet — add your first one below.
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {validationRules.map((rule, idx) => (
                    <motion.div
                      key={rule.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.16 }}
                      className="flex items-center gap-1 rounded-md border px-1.5 py-1"
                      style={{ borderColor: 'var(--ta-slate)' }}
                    >
                      <div className="flex shrink-0 flex-col">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => useTradeAnalysisStore.getState().moveValidationRule(rule.id, 'up')}
                          disabled={idx === 0}
                          className="disabled:opacity-25"
                          style={{ color: 'var(--ta-slate)' }}
                          title="Move up"
                        >
                          <ChevronUp size={11} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => useTradeAnalysisStore.getState().moveValidationRule(rule.id, 'down')}
                          disabled={idx === validationRules.length - 1}
                          className="disabled:opacity-25"
                          style={{ color: 'var(--ta-slate)' }}
                          title="Move down"
                        >
                          <ChevronDown size={11} />
                        </motion.button>
                      </div>

                      <input
                        type="text"
                        value={rule.label}
                        onChange={(e) =>
                          useTradeAnalysisStore.getState().updateValidationRuleLabel(rule.id, e.target.value)
                        }
                        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[11px] outline-none focus:bg-black/5"
                        style={{ color: 'var(--ta-ink)' }}
                      />

                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => useTradeAnalysisStore.getState().toggleValidationRuleActive(rule.id)}
                        title={rule.active ? 'Active — click to disable' : 'Inactive — click to enable'}
                        className="relative h-4 w-7 shrink-0 rounded-full transition-colors"
                        style={{ backgroundColor: rule.active ? 'var(--ta-accent)' : 'var(--ta-slate)', opacity: rule.active ? 1 : 0.4 }}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                          className="absolute top-0.5 h-3 w-3 rounded-full bg-white"
                          style={{ left: rule.active ? 14 : 2 }}
                        />
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => useTradeAnalysisStore.getState().deleteValidationRule(rule.id)}
                        className="shrink-0 rounded p-0.5 hover:bg-black/5"
                        style={{ color: '#dc2626' }}
                        title="Delete rule"
                      >
                        <Trash2 size={12} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="flex items-center gap-1.5 border-t pt-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Risk:Reward ≥ 1:2"
                className="min-w-0 flex-1 rounded-md border bg-white/70 px-2 py-1 text-[11px] outline-none"
                style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
              />
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleAdd}
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                <Plus size={12} />
                Add rule
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="self-end rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
              style={{ color: 'var(--ta-ink)' }}
            >
              Done
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
