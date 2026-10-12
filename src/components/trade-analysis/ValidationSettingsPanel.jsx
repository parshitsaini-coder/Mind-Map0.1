import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Settings,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  X,
  GripVertical,
  AlertTriangle,
  Flame,
  BarChart3,
  ListChecks,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
  Check,
  Minus,
} from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import RuleColorPicker from './RuleColorPicker'

// Step B of trade-analysis-validation-v3-master-prompt.md — the popup
// behind the top bar's "Validation Settings" button (previously "Add
// Validation Rule" / ValidationRulesModal.jsx's flat list). Rules are now
// grouped into named categories: a left sidebar of categories, a right
// pane of that category's rules. Everything here writes straight to the
// store (same as the old modal did) — there's no separate draft state, so
// "Save Changes" is just a friendly way to close once you're done, same
// as the old "Done" button.
//
// UI/UX pass: every panel here is now a distinct "card" with a soft themed
// glow (reuses .ta-card-glow so it automatically matches whichever color
// theme — including Claymorphism — is active), categories carry a little
// emoji + a mini progress bar so status is readable at a glance, the
// primary buttons reuse the app's .ta-btn-primary shimmer, and the Danger
// Zone reuses the existing .ta-alert-live sweep + .ta-pulse ring instead
// of inventing new one-off effects.

const CATEGORY_ICONS = { Flame, BarChart3, ListChecks }
const CategoryIcon = ({ name, ...props }) => {
  const Icon = CATEGORY_ICONS[name] || ListChecks
  return <Icon {...props} />
}

// A little emoji per built-in icon so the sidebar reads friendlier at a
// glance — keyed off the category's `icon` field (not its name, which is
// free-text the person can change), so this stays correct for any custom
// category too since new ones default to the ListChecks icon.
const CATEGORY_EMOJI = { Flame: '🔥', BarChart3: '📊', ListChecks: '📋' }
const categoryEmoji = (icon) => CATEGORY_EMOJI[icon] || '📁'

// Small fixed cycle of dot colors for the category list — reuses accent
// tones already present in src/theme/tradeAnalysisThemes.js rather than
// inventing new hex values.
const DOT_COLORS = ['#eb5e28', '#415a77', '#bc6c25', '#adc178', '#cb997e', '#fca311']

export default function ValidationSettingsPanel({ open, onClose }) {
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const isMobile = useIsMobile()

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories])

  const [selectedId, setSelectedId] = useState(sortedCategories[0]?.id || null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newRuleLabel, setNewRuleLabel] = useState('')
  const [dangerOpen, setDangerOpen] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState(null)
  const [confirmWipeAllOpen, setConfirmWipeAllOpen] = useState(false)

  // Keep a valid selection whenever the category list changes (e.g. the
  // selected one just got deleted, or this is the very first render).
  useEffect(() => {
    if (!sortedCategories.some((c) => c.id === selectedId)) {
      setSelectedId(sortedCategories[0]?.id || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCategories])

  useEffect(() => {
    if (!open) {
      setDangerOpen(false)
      setConfirmResetOpen(false)
      setConfirmDeleteCategoryId(null)
      setConfirmWipeAllOpen(false)
      setNewCategoryName('')
      setNewRuleLabel('')
    }
  }, [open])

  const selectedCategory = sortedCategories.find((c) => c.id === selectedId) || null
  const rulesForSelected = useMemo(
    () =>
      selectedCategory
        ? rules.filter((r) => r.categoryId === selectedCategory.id).sort((a, b) => a.order - b.order)
        : [],
    [rules, selectedCategory]
  )
  const activeCountFor = (categoryId) => rules.filter((r) => r.categoryId === categoryId && r.active).length
  const totalCountFor = (categoryId) => rules.filter((r) => r.categoryId === categoryId).length

  const handleAddCategory = () => {
    const name = newCategoryName.trim()
    if (!name) return
    const id = useTradeAnalysisStore.getState().addCategory(name)
    setNewCategoryName('')
    setSelectedId(id)
  }

  const handleAddRule = () => {
    const label = newRuleLabel.trim()
    if (!label || !selectedCategory) return
    useTradeAnalysisStore.getState().addValidationRule(selectedCategory.id, label)
    setNewRuleLabel('')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5"
              style={{
                borderColor: 'var(--ta-slate)',
                background: 'linear-gradient(180deg, color-mix(in srgb, var(--ta-accent) 7%, transparent), transparent)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <motion.span
                  whileHover={{ rotate: 90, scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="ta-pulse mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--ta-accent) 16%, transparent)',
                    color: 'var(--ta-accent)',
                  }}
                >
                  <Settings size={16} />
                </motion.span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ta-ink)' }}>
                    Validation Settings
                    <span aria-hidden>🛡️</span>
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ta-slate)' }}>
                    Manage categories and rules — only enabled rules show in the checklist.
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.08, rotate: 90, backgroundColor: 'rgba(0,0,0,0.06)' }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={15} />
              </motion.button>
            </div>

            {/* Body */}
            <div className={`ta-scroll flex min-h-0 flex-1 ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden`}>
              {/* Left sidebar — categories */}
              <div
                className={`ta-scroll flex shrink-0 flex-col gap-2 overflow-y-auto border-b p-3 ${isMobile ? 'max-h-[35vh] w-full' : 'w-[220px] border-b-0 border-r'}`}
                style={{ borderColor: 'var(--ta-slate)' }}
              >
                <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                  <Tag size={10} />
                  Categories
                </p>
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                  className="flex flex-col gap-1.5"
                >
                  {sortedCategories.map((cat, idx) => {
                    const dot = DOT_COLORS[idx % DOT_COLORS.length]
                    const active = cat.id === selectedId
                    const total = totalCountFor(cat.id)
                    const activeN = activeCountFor(cat.id)
                    const pct = total > 0 ? Math.round((activeN / total) * 100) : 0
                    return (
                      <motion.button
                        key={cat.id}
                        variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                        whileHover={{ x: 2, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedId(cat.id)}
                        className="ta-card-glow relative flex flex-col gap-1.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left text-[11px]"
                        style={{
                          color: 'var(--ta-ink)',
                          borderColor: active ? 'color-mix(in srgb, var(--ta-accent) 45%, transparent)' : 'transparent',
                          backgroundColor: active ? 'color-mix(in srgb, var(--ta-accent) 10%, transparent)' : 'transparent',
                        }}
                      >
                        {active && (
                          <motion.span
                            layoutId="category-active-bar"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            className="absolute inset-y-0 left-0 w-[3px] rounded-r-full"
                            style={{ backgroundColor: 'var(--ta-accent)' }}
                          />
                        )}
                        <span className="flex items-center gap-1.5">
                          <span className="shrink-0 text-[13px] leading-none" aria-hidden>
                            {categoryEmoji(cat.icon)}
                          </span>
                          <span className="flex flex-1 items-center gap-1 truncate">
                            <CategoryIcon name={cat.icon} size={10} style={{ color: 'var(--ta-slate)' }} />
                            <span className="truncate font-medium">{cat.name}</span>
                          </span>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={`${activeN}-${total}`}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                              style={{
                                backgroundColor: activeN > 0 ? 'color-mix(in srgb, var(--ta-accent) 18%, transparent)' : 'var(--ta-bg)',
                                color: activeN > 0 ? 'var(--ta-accent)' : 'var(--ta-slate)',
                              }}
                            >
                              {activeN}/{total}
                            </motion.span>
                          </AnimatePresence>
                          <span className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation()
                                useTradeAnalysisStore.getState().reorderCategory(cat.id, 'up')
                              }}
                              className="hover:opacity-70 disabled:opacity-20"
                              style={{ color: 'var(--ta-slate)' }}
                              title="Move up"
                            >
                              <ChevronUp size={10} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === sortedCategories.length - 1}
                              onClick={(e) => {
                                e.stopPropagation()
                                useTradeAnalysisStore.getState().reorderCategory(cat.id, 'down')
                              }}
                              className="hover:opacity-70 disabled:opacity-20"
                              style={{ color: 'var(--ta-slate)' }}
                              title="Move down"
                            >
                              <ChevronDown size={10} />
                            </button>
                          </span>
                        </span>

                        {/* Mini progress bar — active rules as a share of total */}
                        <span className="relative block h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                          <motion.span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ backgroundColor: dot }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                          />
                        </span>
                      </motion.button>
                    )
                  })}
                  {sortedCategories.length === 0 && (
                    <p className="rounded-xl border border-dashed px-2 py-4 text-center text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                      📂 No categories yet.
                    </p>
                  )}
                </motion.div>

                <div className="mt-1 flex flex-col gap-1.5">
                  <div className="relative">
                    <Tag size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--ta-slate)' }} />
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="New category name…"
                      className="ta-input w-full rounded-lg border bg-white/70 py-1.5 pl-6 pr-2 text-[11px] outline-none"
                      style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="ta-btn-primary flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={11} />
                    New Category
                  </motion.button>
                </div>
              </div>

              {/* Right pane — selected category's rules */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="ta-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                  {!selectedCategory ? (
                    <p className="rounded-xl border border-dashed px-2 py-6 text-center text-[11px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                      ✨ Add a category on the left to get started.
                    </p>
                  ) : (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedCategory.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.16 }}
                          className="ta-card-glow flex shrink-0 items-start justify-between gap-2 rounded-xl border px-3 py-2.5"
                          style={{ borderColor: 'var(--ta-slate)' }}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px]"
                              style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' }}
                              aria-hidden
                            >
                              {categoryEmoji(selectedCategory.icon)}
                            </span>
                            <div>
                              <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                                <CategoryIcon name={selectedCategory.icon} size={13} style={{ color: 'var(--ta-accent)' }} />
                                {selectedCategory.name}
                              </p>
                              <p className="mt-0.5 text-[10px]" style={{ color: 'var(--ta-slate)' }}>
                                {activeCountFor(selectedCategory.id)} of {totalCountFor(selectedCategory.id)} rules active
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <motion.button
                              whileHover={{ scale: 1.05, boxShadow: '0 3px 14px color-mix(in srgb, var(--ta-accent) 45%, transparent)' }}
                              whileTap={{ scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                              onClick={() => document.getElementById('ta-new-rule-input')?.focus()}
                              className="ta-btn-primary flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white"
                            >
                              <Plus size={11} />
                              Add Rule
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05, backgroundColor: 'rgba(220,38,38,0.08)' }}
                              whileTap={{ scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                              onClick={() => setConfirmDeleteCategoryId(selectedCategory.id)}
                              className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold"
                              style={{ borderColor: '#dc2626', color: '#dc2626' }}
                            >
                              <Trash2 size={11} />
                              Delete
                            </motion.button>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      <div className="mt-2.5 flex flex-1 flex-col gap-2 overflow-y-auto">
                        {rulesForSelected.length === 0 ? (
                          <p className="rounded-xl border border-dashed px-2 py-6 text-center text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                            ✨ No rules yet — add your first one below.
                          </p>
                        ) : (
                          <AnimatePresence initial={false}>
                            {rulesForSelected.map((rule) => (
                              <motion.div
                                key={rule.id}
                                layout
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 12 }}
                                whileHover={{
                                  y: -1.5,
                                  boxShadow: `0 8px 22px -8px color-mix(in srgb, ${rule.color || 'var(--ta-accent)'} 55%, transparent)`,
                                }}
                                transition={{ duration: 0.16 }}
                                className="relative flex items-center gap-2 overflow-hidden rounded-xl border pl-3 pr-2 py-2"
                                style={{
                                  borderColor: 'color-mix(in srgb, var(--ta-slate) 35%, transparent)',
                                  backgroundColor: rule.color
                                    ? `color-mix(in srgb, ${rule.color} 16%, var(--ta-surface))`
                                    : 'var(--ta-surface)',
                                }}
                              >
                                {/* Colored accent strip — reads the rule's chosen
                                    color as a clean edge instead of painting the
                                    whole row solid. */}
                                <span
                                  className="absolute inset-y-0 left-0 w-1"
                                  style={{ backgroundColor: rule.color || 'color-mix(in srgb, var(--ta-accent) 55%, transparent)' }}
                                />

                                <span
                                  className="flex shrink-0 cursor-grab flex-col items-center gap-0.5 rounded-md px-0.5 py-0.5 hover:bg-black/5"
                                  style={{ color: 'var(--ta-slate)' }}
                                >
                                  <GripVertical size={12} />
                                  <span className="flex flex-col">
                                    <button
                                      onClick={() => useTradeAnalysisStore.getState().moveValidationRule(rule.id, 'up')}
                                      style={{ color: 'var(--ta-slate)' }}
                                      title="Move up"
                                    >
                                      <ChevronUp size={9} />
                                    </button>
                                    <button
                                      onClick={() => useTradeAnalysisStore.getState().moveValidationRule(rule.id, 'down')}
                                      style={{ color: 'var(--ta-slate)' }}
                                      title="Move down"
                                    >
                                      <ChevronDown size={9} />
                                    </button>
                                  </span>
                                </span>

                                <input
                                  type="text"
                                  value={rule.label}
                                  onChange={(e) =>
                                    useTradeAnalysisStore.getState().updateValidationRuleLabel(rule.id, e.target.value)
                                  }
                                  className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[12px] font-medium outline-none transition-colors focus:bg-black/5"
                                  style={{ color: 'var(--ta-ink)' }}
                                />

                                <span
                                  className="hidden shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide sm:flex"
                                  style={{
                                    backgroundColor: rule.active ? 'color-mix(in srgb, var(--ta-accent) 16%, transparent)' : 'var(--ta-bg)',
                                    color: rule.active ? 'var(--ta-accent)' : 'var(--ta-slate)',
                                  }}
                                >
                                  <span aria-hidden>{rule.active ? '✅' : '⏸️'}</span>
                                  {rule.active ? 'Active' : 'Inactive'}
                                </span>

                                <motion.button
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => useTradeAnalysisStore.getState().toggleValidationRuleActive(rule.id)}
                                  title={rule.active ? 'Active — click to disable' : 'Inactive — click to enable'}
                                  className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                                  style={{ backgroundColor: rule.active ? 'var(--ta-accent)' : 'var(--ta-slate)', opacity: rule.active ? 1 : 0.4 }}
                                >
                                  <motion.span
                                    layout
                                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                    className="absolute top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm"
                                    style={{ left: rule.active ? 18 : 2, color: rule.active ? 'var(--ta-accent)' : 'var(--ta-slate)' }}
                                  >
                                    {rule.active ? <Check size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
                                  </motion.span>
                                </motion.button>

                                <RuleColorPicker
                                  value={rule.color}
                                  onChange={(hex) => useTradeAnalysisStore.getState().updateValidationRuleColor(rule.id, hex)}
                                />

                                {rule.color && (
                                  <motion.button
                                    whileHover={{ rotate: 90 }}
                                    onClick={() => useTradeAnalysisStore.getState().updateValidationRuleColor(rule.id, null)}
                                    className="shrink-0 rounded p-0.5 hover:bg-black/5"
                                    style={{ color: 'var(--ta-slate)' }}
                                    title="Reset row color"
                                  >
                                    <X size={11} />
                                  </motion.button>
                                )}

                                <motion.button
                                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(220,38,38,0.12)' }}
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => useTradeAnalysisStore.getState().deleteValidationRule(rule.id)}
                                  className="shrink-0 rounded-md p-0.5"
                                  style={{ color: '#dc2626' }}
                                  title="Delete rule"
                                >
                                  <X size={13} />
                                </motion.button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        )}
                      </div>

                      <div className="mt-2.5 flex shrink-0 items-center gap-1.5 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
                        <div className="relative min-w-0 flex-1">
                          <Sparkles size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--ta-slate)' }} />
                          <input
                            id="ta-new-rule-input"
                            type="text"
                            value={newRuleLabel}
                            onChange={(e) => setNewRuleLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                            placeholder="e.g. Risk:Reward ≥ 1:2"
                            className="ta-input w-full rounded-lg border bg-white/70 py-1.5 pl-6 pr-2 text-[11px] outline-none"
                            style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                          />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ scale: 1.03 }}
                          onClick={handleAddRule}
                          disabled={!newRuleLabel.trim()}
                          className="ta-btn-primary flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={12} />
                          Add rule
                        </motion.button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex shrink-0 items-center justify-between border-t px-4 py-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
              <motion.button
                whileHover={{ rotate: -25, backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmResetOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                style={{ color: 'var(--ta-slate)' }}
              >
                <motion.span className="flex" whileHover={{ rotate: 360 }} transition={{ duration: 0.4 }}>
                  <RotateCcw size={12} />
                </motion.span>
                Reset Defaults
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 6px 22px color-mix(in srgb, var(--ta-accent) 55%, transparent)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onClose}
                className="ta-btn-primary flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold text-white"
              >
                <Save size={12} />
                Save Changes
              </motion.button>
            </div>

            {/* Danger Zone */}
            <div className="shrink-0 border-t px-4 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <button
                onClick={() => setDangerOpen((o) => !o)}
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: '#dc2626' }}
              >
                <motion.span animate={{ rotate: dangerOpen ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex">
                  <ChevronRight size={12} />
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex"
                >
                  <AlertTriangle size={12} />
                </motion.span>
                Danger Zone
                <span aria-hidden>⚠️</span>
              </button>
              <AnimatePresence initial={false}>
                {dangerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="ta-alert-live mt-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
                      style={{ borderColor: 'rgba(220,38,38,0.35)' }}
                    >
                      <p className="text-[10px]" style={{ color: 'var(--ta-ink)' }}>
                        🗑️ Permanently delete every category and rule (this will also untick them from any logged trades).
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.06, boxShadow: '0 4px 16px rgba(220,38,38,0.45)' }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        onClick={() => setConfirmWipeAllOpen(true)}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: '#dc2626' }}
                      >
                        Delete ALL
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Confirm: Reset Defaults */}
          <ConfirmDialog
            open={confirmResetOpen}
            title="Reset to default rules?"
            message="This replaces every category and rule with the built-in defaults (Candle Rules / SMC Rules). Your custom rules will be lost."
            confirmLabel="Reset Defaults"
            onCancel={() => setConfirmResetOpen(false)}
            onConfirm={() => {
              useTradeAnalysisStore.getState().resetValidationDefaults()
              setConfirmResetOpen(false)
            }}
          />

          {/* Confirm: delete one category */}
          <ConfirmDialog
            open={Boolean(confirmDeleteCategoryId)}
            title="Delete this category?"
            message="This deletes the category and all of its rules, and unticks them from any trade that had them checked."
            confirmLabel="Delete Category"
            onCancel={() => setConfirmDeleteCategoryId(null)}
            onConfirm={() => {
              useTradeAnalysisStore.getState().deleteCategory(confirmDeleteCategoryId)
              setConfirmDeleteCategoryId(null)
            }}
          />

          {/* Confirm: wipe everything (Danger Zone) */}
          <ConfirmDialog
            open={confirmWipeAllOpen}
            title="Delete ALL categories and rules?"
            message="This cannot be undone. Every category, every rule, and every trade's ticked checklist state will be cleared."
            confirmLabel="Delete Everything"
            onCancel={() => setConfirmWipeAllOpen(false)}
            onConfirm={() => {
              useTradeAnalysisStore.setState({
                validationCategories: [],
                validationRules: [],
                trades: useTradeAnalysisStore.getState().trades.map((t) => ({ ...t, validationRuleIds: [] })),
              })
              setConfirmWipeAllOpen(false)
              setDangerOpen(false)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ConfirmDialog({ open, title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(3px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-xs flex-col gap-2.5 rounded-2xl border p-4 shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: '#dc2626' }}
          >
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(220,38,38,0.14)', color: '#dc2626' }}
              >
                <AlertTriangle size={16} />
              </motion.span>
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                {title}
              </p>
            </div>
            <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--ta-slate)' }}>
              {message}
            </p>
            <div className="mt-1 flex justify-end gap-1.5">
              <motion.button
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
                style={{ color: 'var(--ta-slate)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 4px 18px rgba(220,38,38,0.45)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onConfirm}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
