import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListChecks, X, Check, Flame, BarChart3 } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'

// Step D of trade-analysis-validation-v3-master-prompt.md — the "Add
// Validation" popup opened from the trade form's Validation section
// (replaces the old inline flat checkbox list). Shows the same categories
// managed in ValidationSettingsPanel.jsx, side by side, so ticking which
// rules applied to *this* trade only ever shows active, categorized rules.
//
// The small "x" on each row (matching the reference screenshot) removes
// that tick from this trade's checklist — same effect as unchecking the
// box, just a second affordance for it. It never deletes the rule itself;
// that only happens from Validation Settings.

const CATEGORY_ICONS = { Flame, BarChart3, ListChecks }
const CategoryIcon = ({ name, ...props }) => {
  const Icon = CATEGORY_ICONS[name] || ListChecks
  return <Icon {...props} />
}

export default function ApplyValidationModal({ open, onClose, checkedIds, onToggle }) {
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const isMobile = useIsMobile()

  const grouped = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order)
    return sortedCategories
      .map((cat) => ({
        category: cat,
        rules: rules
          .filter((r) => r.categoryId === cat.id && r.active)
          .sort((a, b) => a.order - b.order),
      }))
      .filter((g) => g.rules.length > 0)
  }, [categories, rules])

  // A rule ticked-but-then-globally-disabled/deleted shouldn't hide from
  // an already-logged trade's own checklist history — but for the *pick*
  // popup we only ever offer currently-active rules, same as the old
  // inline list did.

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
                <ListChecks size={14} style={{ color: 'var(--ta-accent)' }} />
                Validation Checklist
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

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {grouped.length === 0 ? (
                <p className="rounded-md border border-dashed px-2 py-4 text-center text-[11px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                  No active validation rules yet — add some from Validation Settings up top.
                </p>
              ) : (
                <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {grouped.map(({ category, rules: catRules }) => {
                    const checkedInCat = catRules.filter((r) => checkedIds.includes(r.id)).length
                    return (
                      <div
                        key={category.id}
                        className="flex flex-col gap-1.5 rounded-xl border p-2"
                        style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)' }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-ink)' }}>
                            <CategoryIcon name={category.icon} size={11} style={{ color: 'var(--ta-accent)' }} />
                            {category.name}
                          </p>
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                            style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                          >
                            {checkedInCat}/{catRules.length}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          {catRules.map((rule) => {
                            const checked = checkedIds.includes(rule.id)
                            return (
                              <div
                                key={rule.id}
                                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px]"
                                style={{ backgroundColor: 'var(--ta-surface)', color: 'var(--ta-ink)' }}
                              >
                                <button
                                  type="button"
                                  onClick={() => onToggle(rule.id)}
                                  className="flex flex-1 items-center gap-1.5 text-left"
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
                                        >
                                          <Check size={9} color="#fffcf2" />
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </span>
                                  <span className="leading-snug">{rule.label}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => checked && onToggle(rule.id)}
                                  disabled={!checked}
                                  title="Remove from this trade's checklist"
                                  className="shrink-0 disabled:opacity-20"
                                  style={{ color: 'var(--ta-slate)' }}
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t px-3 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
