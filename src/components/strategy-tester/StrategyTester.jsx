import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Table2, LineChart, CalendarRange } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { FIELD_BY_ID } from '../../utils/strategyTesterFields'
import FieldPickerPopover from './FieldPickerPopover'
import CellFieldControl from './CellFieldControl'
import NotesPopup from './NotesPopup'
import StrategyAnalysisView from './StrategyAnalysisView'

// Grid/Analysis segmented switch — same pill pattern used by Trade
// Analysis's ViewSwitch, kept local here since this feature otherwise has
// no dependency on the trade-analysis theming system.
function ViewSwitch({ view, onChange }) {
  const tabs = [
    { id: 'grid', label: 'Grid', icon: Table2 },
    { id: 'analysis', label: 'Analysis', icon: LineChart },
  ]
  return (
    <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--color-sage)' }}>
      {tabs.map((tab) => {
        const active = view === tab.id
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="relative flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: active ? '#fffcf2' : 'var(--color-ink)' }}
          >
            {active && (
              <motion.span
                layoutId="st-view-switch-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--color-accent)' }}
              />
            )}
            <tab.icon size={10} className="relative" />
            <span className="relative">{tab.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function StrategyHeaderCell({ strategy, canRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(strategy.name)

  const commit = () => {
    setEditing(false)
    const name = draft.trim()
    if (name && name !== strategy.name) useStrategyTesterStore.getState().renameStrategy(strategy.id, name)
    else setDraft(strategy.name)
  }

  return (
    <th
      className="sticky top-0 z-10 border px-2 py-1 text-left align-middle"
      style={{ backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-slate)', minWidth: 96 }}
    >
      <div className="flex items-center gap-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="w-full min-w-0 rounded border bg-white/80 px-1 py-0.5 text-[10px] outline-none"
            style={{ borderColor: 'var(--color-slate)', color: 'var(--color-ink)' }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold"
            style={{ color: 'var(--color-ink)' }}
            title="Click to rename"
          >
            {strategy.name}
          </button>
        )}
        {canRemove && (
          <button
            onClick={() => {
              if (window.confirm(`Remove "${strategy.name}"? Its data for this month will be lost.`)) {
                useStrategyTesterStore.getState().removeStrategy(strategy.id)
              }
            }}
            className="shrink-0 rounded p-0.5 hover:bg-black/10"
            title="Remove strategy"
          >
            <X size={11} color="var(--color-ink)" />
          </button>
        )}
      </div>
    </th>
  )
}

function DateRow({ row, strategies, openNotes }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <tr>
      <td
        className="sticky left-0 z-10 border px-1.5 py-1 align-top"
        style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
      >
        <div className="relative flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setPickerOpen((o) => !o)}
            title="Choose what to track for this day"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={10} color="var(--color-ink)" />
          </motion.button>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--color-ink)' }}>
            {row.day}
          </span>
          <FieldPickerPopover open={pickerOpen} row={row} onClose={() => setPickerOpen(false)} />
        </div>
      </td>
      {strategies.map((strategy) => {
        const cell = row.cells[strategy.id] || {}
        return (
          <td key={strategy.id} className="border px-1 py-1 align-top" style={{ borderColor: 'var(--color-slate)' }}>
            {row.fields.length === 0 ? (
              <span className="text-[9px]" style={{ color: 'var(--color-slate)', opacity: 0.5 }}>
                —
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {row.fields.map((fieldId) => {
                  const field = FIELD_BY_ID[fieldId]
                  if (!field) return null
                  return (
                    <CellFieldControl
                      key={fieldId}
                      field={field}
                      value={cell[fieldId]}
                      onChange={(value) => useStrategyTesterStore.getState().setCellValue(row.id, strategy.id, fieldId, value)}
                      onOpenNotes={() => openNotes(row, strategy, cell[fieldId])}
                    />
                  )
                })}
              </div>
            )}
          </td>
        )
      })}
      <td style={{ borderColor: 'var(--color-slate)' }} />
    </tr>
  )
}

export default function StrategyTester() {
  const isOpen = useStrategyTesterStore((s) => s.isOpen)
  const view = useStrategyTesterStore((s) => s.view)
  const activeMonthKey = useStrategyTesterStore((s) => s.activeMonthKey)
  const month = useStrategyTesterStore((s) => (activeMonthKey ? s.months[activeMonthKey] : null))
  const [labelDraft, setLabelDraft] = useState('')
  const [notesTarget, setNotesTarget] = useState(null) // { row, strategy, value }

  useEffect(() => {
    if (month) setLabelDraft(month.label)
  }, [month?.key, month?.label])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') useStrategyTesterStore.getState().close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen])

  if (!month) return null

  const openNotes = (row, strategy, value) => setNotesTarget({ row, strategy, value })

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ backgroundColor: 'var(--color-bg-main)' }}
        >
          {/* Top bar */}
          <div
            className="flex h-8 shrink-0 items-center gap-1.5 border-b px-2"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
          >
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => useStrategyTesterStore.getState().close()}
              title="Back to mind map (Esc)"
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-black/5"
              style={{ color: 'var(--color-ink)' }}
            >
              <ArrowLeft size={11} />
              Back
            </motion.button>

            <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: 'var(--color-slate)', opacity: 0.25 }} />

            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-ink)' }}>
              <CalendarRange size={12} />
              Strategy Tester
            </span>

            <ViewSwitch view={view} onChange={(v) => useStrategyTesterStore.getState().setView(v)} />

            <div className="mx-1 flex shrink-0 items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => useStrategyTesterStore.getState().goToMonth(-1)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-black/5"
                style={{ color: 'var(--color-ink)' }}
                title="Previous month"
              >
                <ChevronLeft size={13} />
              </motion.button>
              <input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => useStrategyTesterStore.getState().renameMonthLabel(labelDraft.trim() || month.label)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="w-32 rounded border bg-transparent px-1 py-0.5 text-center text-[11px] font-medium outline-none focus:bg-white/60"
                style={{ borderColor: 'transparent', color: 'var(--color-ink)' }}
                title="Click to rename this month"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => useStrategyTesterStore.getState().goToMonth(1)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-black/5"
                style={{ color: 'var(--color-ink)' }}
                title="Next month"
              >
                <ChevronRight size={13} />
              </motion.button>
            </div>

            <div className="flex-1" />
            <span className="hidden shrink-0 text-[9px] sm:inline" style={{ color: 'var(--color-slate)' }}>
              Click the + next to a date to choose what to track that day
            </span>
          </div>

          {view === 'analysis' ? (
            <StrategyAnalysisView month={month} />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 top-0 z-20 border px-2 py-1 text-left"
                      style={{ backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-slate)', minWidth: 56 }}
                    >
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--color-ink)' }}>
                        Date
                      </span>
                    </th>
                    {month.strategies.map((strategy) => (
                      <StrategyHeaderCell key={strategy.id} strategy={strategy} canRemove={month.strategies.length > 1} />
                    ))}
                    <th
                      className="sticky top-0 z-10 border px-1 py-1"
                      style={{ backgroundColor: 'var(--color-sage)', borderColor: 'var(--color-slate)' }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => useStrategyTesterStore.getState().addStrategy()}
                        title="Add a strategy column"
                        className="flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      >
                        <Plus size={12} color="var(--color-ink)" />
                      </motion.button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {month.rows.map((row) => (
                    <DateRow key={row.id} row={row} strategies={month.strategies} openNotes={openNotes} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <NotesPopup
            open={Boolean(notesTarget)}
            value={notesTarget?.value}
            dayLabel={notesTarget?.row?.day}
            strategyName={notesTarget?.strategy?.name}
            onClose={() => setNotesTarget(null)}
            onSave={(text) => {
              if (!notesTarget) return
              useStrategyTesterStore.getState().setCellValue(notesTarget.row.id, notesTarget.strategy.id, 'notes', text)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
