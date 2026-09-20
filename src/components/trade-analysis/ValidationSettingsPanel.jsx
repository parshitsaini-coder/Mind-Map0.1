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

const CATEGORY_ICONS = { Flame, BarChart3, ListChecks }
const CategoryIcon = ({ name, ...props }) => {
  const Icon = CATEGORY_ICONS[name] || ListChecks
  return <Icon {...props} />
}

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
            <div className="flex shrink-0 items-start justify-between border-b px-4 py-3" style={{ borderColor: 'var(--ta-slate)' }}>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ta-ink)' }}>
                  <motion.span
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="flex"
                  >
                    <Settings size={15} style={{ color: 'var(--ta-accent)' }} />
                  </motion.span>
                  Validation Settings
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ta-slate)' }}>
                  Manage categories and rules — only enabled rules show in the checklist.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                onClick={onClose}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={15} />
              </motion.button>
            </div>

            {/* Body */}
            <div className={`flex min-h-0 flex-1 ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden`}>
              {/* Left sidebar — categories */}
              <div
                className={`flex shrink-0 flex-col gap-2 overflow-y-auto border-b p-3 ${isMobile ? 'max-h-[35vh] w-full' : 'w-[200px] border-b-0 border-r'}`}
                style={{ borderColor: 'var(--ta-slate)' }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                  Categories
                </p>
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                  className="flex flex-col gap-1"
                >
                  {sortedCategories.map((cat, idx) => {
                    const dot = DOT_COLORS[idx % DOT_COLORS.length]
                    const active = cat.id === selectedId
                    return (
                      <motion.button
                        key={cat.id}
                        variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                        whileHover={{ x: 2 }}
                        onClick={() => setSelectedId(cat.id)}
                        className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px]"
                        style={{ color: 'var(--ta-ink)' }}
                      >
                        {active && (
                          <motion.span
                            layoutId="category-active-pill"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-lg"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' }}
                          />
                        )}
                        <span className="relative h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
                        <span className="relative flex items-center gap-1 truncate">
                          <CategoryIcon name={cat.icon} size={11} style={{ color: 'var(--ta-slate)' }} />
                          <span className="truncate font-medium">{cat.name}</span>
                        </span>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${activeCountFor(cat.id)}-${totalCountFor(cat.id)}`}
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                            className="relative ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}
                          >
                            {activeCountFor(cat.id)}/{totalCountFor(cat.id)}
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
                      </motion.button>
                    )
                  })}
                  {sortedCategories.length === 0 && (
                    <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                      No categories yet.
                    </p>
                  )}
                </motion.div>

                <div className="mt-1 flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    placeholder="New category naam..."
                    className="w-full rounded-md border bg-white/70 px-2 py-1 text-[11px] outline-none"
                    style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: 'color-mix(in srgb, var(--ta-accent) 10%, var(--ta-bg))' }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    onClick={handleAddCategory}
                    className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                  >
                    <Plus size={11} />
                    New Category
                  </motion.button>
                </div>
              </div>

              {/* Right pane — selected category's rules */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                  {!selectedCategory ? (
                    <p className="rounded-md border border-dashed px-2 py-4 text-center text-[11px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                      Add a category on the left to get started.
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
                          className="flex shrink-0 items-start justify-between gap-2"
                        >
                          <div>
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                              <CategoryIcon name={selectedCategory.icon} size={14} style={{ color: 'var(--ta-accent)' }} />
                              {selectedCategory.name}
                            </p>
                            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--ta-slate)' }}>
                              {activeCountFor(selectedCategory.id)} of {totalCountFor(selectedCategory.id)} rules active
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <motion.button
                              whileHover={{ scale: 1.05, boxShadow: '0 3px 14px color-mix(in srgb, var(--ta-accent) 45%, transparent)' }}
                              whileTap={{ scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                              onClick={() => document.getElementById('ta-new-rule-input')?.focus()}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: 'var(--ta-accent)' }}
                            >
                              <Plus size={11} />
                              Add Rule
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05, backgroundColor: 'rgba(220,38,38,0.08)' }}
                              whileTap={{ scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                              onClick={() => setConfirmDeleteCategoryId(selectedCategory.id)}
                              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold"
                              style={{ borderColor: '#dc2626', color: '#dc2626' }}
                            >
                              <Trash2 size={11} />
                              Delete
                            </motion.button>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      <div className="mt-2 flex flex-1 flex-col gap-1.5 overflow-y-auto">
                        {rulesForSelected.length === 0 ? (
                          <p className="rounded-md border border-dashed px-2 py-3 text-center text-[10px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                            No rules yet — add your first one below.
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
                                whileHover={{ y: -1, boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}
                                transition={{ duration: 0.16 }}
                                className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
                                style={{
                                  borderColor: 'var(--ta-slate)',
                                  backgroundColor: rule.color || 'transparent',
                                }}
                              >
                                <span className="flex shrink-0 cursor-grab flex-col items-center gap-0.5" style={{ color: 'var(--ta-slate)' }}>
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
                                  className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[12px] outline-none focus:bg-black/5"
                                  style={{ color: 'var(--ta-ink)' }}
                                />

                                <span
                                  className="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide sm:inline-block"
                                  style={{
                                    backgroundColor: rule.active ? 'color-mix(in srgb, var(--ta-accent) 16%, transparent)' : 'var(--ta-bg)',
                                    color: rule.active ? 'var(--ta-accent)' : 'var(--ta-slate)',
                                  }}
                                >
                                  {rule.active ? 'Active' : 'Inactive'}
                                </span>

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

                                <RuleColorPicker
                                  value={rule.color}
                                  onChange={(hex) => useTradeAnalysisStore.getState().updateValidationRuleColor(rule.id, hex)}
                                />

                                {rule.color && (
                                  <button
                                    onClick={() => useTradeAnalysisStore.getState().updateValidationRuleColor(rule.id, null)}
                                    className="shrink-0 rounded p-0.5 hover:bg-black/5"
                                    style={{ color: 'var(--ta-slate)' }}
                                    title="Reset row color"
                                  >
                                    <X size={11} />
                                  </button>
                                )}

                                <motion.button
                                  whileTap={{ scale: 0.85 }}
                                  onClick={() => useTradeAnalysisStore.getState().deleteValidationRule(rule.id)}
                                  className="shrink-0 rounded p-0.5 hover:bg-black/5"
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

                      <div className="mt-2 flex shrink-0 items-center gap-1.5 border-t pt-2" style={{ borderColor: 'var(--ta-slate)' }}>
                        <input
                          id="ta-new-rule-input"
                          type="text"
                          value={newRuleLabel}
                          onChange={(e) => setNewRuleLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                          placeholder="e.g. Risk:Reward ≥ 1:2"
                          className="min-w-0 flex-1 rounded-md border bg-white/70 px-2 py-1 text-[11px] outline-none"
                          style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
                        />
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={handleAddRule}
                          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:brightness-110"
                          style={{ backgroundColor: 'var(--ta-accent)' }}
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
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmResetOpen(true)}
                className="rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-black/5"
                style={{ color: 'var(--ta-slate)' }}
              >
                ↺ Reset Defaults
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 5px 20px color-mix(in srgb, var(--ta-accent) 50%, transparent)' }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                💾 Save Changes
              </motion.button>
            </div>

            {/* Danger Zone */}
            <div className="shrink-0 border-t px-4 py-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <button
                onClick={() => setDangerOpen((o) => !o)}
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#dc2626' }}
              >
                <motion.span animate={{ rotate: dangerOpen ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex">
                  <ChevronRight size={12} />
                </motion.span>
                <AlertTriangle size={12} />
                Danger Zone
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
                    <div className="mt-2 flex items-center justify-between rounded-md border px-2.5 py-2" style={{ borderColor: '#dc2626' }}>
                      <p className="text-[10px]" style={{ color: 'var(--ta-ink)' }}>
                        Permanently delete every category and rule (this will also untick them from any logged trades).
                      </p>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setConfirmWipeAllOpen(true)}
                        className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-white"
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
            className="flex w-full max-w-xs flex-col gap-2 rounded-lg border p-3 shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: '#dc2626' }}
          >
            <p className="text-[12px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
              {title}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--ta-slate)' }}>
              {message}
            </p>
            <div className="mt-1 flex justify-end gap-1.5">
              <motion.button
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                className="rounded-md px-2.5 py-1 text-[10px] font-medium"
                style={{ color: 'var(--ta-slate)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: '0 4px 16px rgba(220,38,38,0.4)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                onClick={onConfirm}
                className="rounded-md px-2.5 py-1 text-[10px] font-semibold text-white"
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
