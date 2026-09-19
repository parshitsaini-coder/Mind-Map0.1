import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListChecks, X, Check, Flame, BarChart3, PartyPopper } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'

// Step D of trade-analysis-validation-v3-master-prompt.md — the "Add
// Validation" popup opened from the trade form's Validation section
// (replaces the old inline flat checkbox list). Shows the same categories
// managed in ValidationSettingsPanel.jsx, laid out 4 per row (wrapping to
// further rows beyond that), so ticking which rules applied to *this*
// trade only ever shows active, categorized rules.
//
// The small "x" on each row (matching the reference screenshot) removes
// that tick from this trade's checklist — same effect as unchecking the
// box, just a second affordance for it. It never deletes the rule itself;
// that only happens from Validation Settings.
//
// Motion pass: staggered card/row entrance, spring-y hover lift on rows,
// an animated (popLayout) progress badge per category, and a small
// celebratory pulse around a category's border once every rule in it is
// ticked — all driven by variants so the choreography lives in one place
// instead of being scattered across inline props.

const CATEGORY_ICONS = { Flame, BarChart3, ListChecks }
const CategoryIcon = ({ name, ...props }) => {
  const Icon = CATEGORY_ICONS[name] || ListChecks
  return <Icon {...props} />
}

const gridVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 30 },
  },
}

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
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

  const totalActive = grouped.reduce((sum, g) => sum + g.rules.length, 0)
  const totalChecked = grouped.reduce(
    (sum, g) => sum + g.rules.filter((r) => checkedIds.includes(r.id)).length,
    0
  )
  const allComplete = totalActive > 0 && totalChecked === totalActive

  // A rule ticked-but-then-globally-disabled/deleted shouldn't hide from
  // an already-logged trade's own checklist history — but for the *pick*
  // popup we only ever offer currently-active rules, same as the old
  // inline list did.

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-3"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
                <motion.span
                  animate={allComplete ? { rotate: [0, -12, 12, -8, 0] } : { rotate: 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                  <ListChecks size={14} style={{ color: 'var(--ta-accent)' }} />
                </motion.span>
                Validation Checklist
                <AnimatePresence mode="wait">
                  {totalActive > 0 && (
                    <motion.span
                      key={`${totalChecked}-${totalActive}`}
                      initial={{ scale: 0.6, opacity: 0, y: -4 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.6, opacity: 0, y: 4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                      className="ml-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{
                        backgroundColor: allComplete ? '#16a34a' : 'var(--ta-accent)',
                        color: '#fffcf2',
                        boxShadow: allComplete
                          ? '0 0 0 3px color-mix(in srgb, #16a34a 25%, transparent)'
                          : 'none',
                      }}
                    >
                      {allComplete && <PartyPopper size={9} />}
                      {totalChecked}/{totalActive}
                    </motion.span>
                  )}
                </AnimatePresence>
              </p>
              <motion.button
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
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
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-md border border-dashed px-2 py-4 text-center text-[11px]"
                  style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}
                >
                  No active validation rules yet — add some from Validation Settings up top.
                </motion.p>
              ) : (
                <motion.div
                  variants={gridVariants}
                  initial="hidden"
                  animate="show"
                  className={
                    isMobile
                      ? 'flex flex-col gap-2'
                      // Desktop: exactly 4 categories per row. Once there
                      // are more than 4 active categories, the extra ones
                      // wrap down to the next row instead of pushing the
                      // row wider and scrolling horizontally.
                      : 'grid grid-cols-4 items-start gap-2'
                  }
                >
                  {grouped.map(({ category, rules: catRules }) => {
                    const checkedInCat = catRules.filter((r) => checkedIds.includes(r.id)).length
                    const catComplete = checkedInCat === catRules.length
                    return (
                      <motion.div
                        key={category.id}
                        variants={cardVariants}
                        whileHover={{ y: -2 }}
                        animate={
                          catComplete
                            ? {
                                boxShadow: [
                                  '0 0 0 0px color-mix(in srgb, #16a34a 0%, transparent)',
                                  '0 0 0 3px color-mix(in srgb, #16a34a 22%, transparent)',
                                  '0 0 0 0px color-mix(in srgb, #16a34a 0%, transparent)',
                                ],
                              }
                            : { boxShadow: '0 0 0 0px transparent' }
                        }
                        transition={catComplete ? { duration: 1.1, ease: 'easeInOut' } : { duration: 0.2 }}
                        className={`flex h-full flex-col gap-1.5 rounded-xl border p-2 ${isMobile ? '' : 'min-w-0'}`}
                        style={{
                          borderColor: catComplete ? '#16a34a' : 'var(--ta-slate)',
                          backgroundColor: 'var(--ta-bg)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-ink)' }}>
                            <CategoryIcon name={category.icon} size={11} style={{ color: 'var(--ta-accent)' }} />
                            {category.name}
                          </p>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={`${checkedInCat}-${catRules.length}`}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                              style={{
                                backgroundColor: catComplete ? '#16a34a' : 'var(--ta-accent)',
                                color: '#fffcf2',
                              }}
                            >
                              {checkedInCat}/{catRules.length}
                            </motion.span>
                          </AnimatePresence>
                        </div>

                        <motion.div variants={gridVariants} initial="hidden" animate="show" className="flex flex-col gap-1">
                          {catRules.map((rule) => {
                            const checked = checkedIds.includes(rule.id)
                            return (
                              <motion.div
                                key={rule.id}
                                variants={rowVariants}
                                whileHover={{ x: 2, backgroundColor: 'color-mix(in srgb, var(--ta-accent) 8%, var(--ta-surface))' }}
                                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] transition-colors"
                                style={{ backgroundColor: 'var(--ta-surface)', color: 'var(--ta-ink)' }}
                              >
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => onToggle(rule.id)}
                                  className="flex flex-1 items-center gap-1.5 text-left"
                                >
                                  <motion.span
                                    className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border"
                                    animate={
                                      checked
                                        ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)' }
                                        : { backgroundColor: 'rgba(0,0,0,0)', borderColor: 'var(--ta-slate)' }
                                    }
                                    transition={{ duration: 0.18 }}
                                  >
                                    <AnimatePresence>
                                      {checked && (
                                        <motion.span
                                          key="ripple"
                                          initial={{ scale: 0.4, opacity: 0.55 }}
                                          animate={{ scale: 2.4, opacity: 0 }}
                                          transition={{ duration: 0.45, ease: 'easeOut' }}
                                          className="absolute inset-0 rounded-sm"
                                          style={{ backgroundColor: 'var(--ta-accent)' }}
                                        />
                                      )}
                                    </AnimatePresence>
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
                                  </motion.span>
                                  <span className="leading-snug">{rule.label}</span>
                                </motion.button>
                                <motion.button
                                  type="button"
                                  whileHover={checked ? { scale: 1.15, rotate: 90 } : {}}
                                  whileTap={checked ? { scale: 0.85 } : {}}
                                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                                  onClick={() => checked && onToggle(rule.id)}
                                  disabled={!checked}
                                  title="Remove from this trade's checklist"
                                  className="shrink-0 disabled:opacity-20"
                                  style={{ color: 'var(--ta-slate)' }}
                                >
                                  <X size={11} />
                                </motion.button>
                              </motion.div>
                            )
                          })}
                        </motion.div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t px-3 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 4px 18px color-mix(in srgb, var(--ta-accent) 45%, transparent)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
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
