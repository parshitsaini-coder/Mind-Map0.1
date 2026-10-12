import { AnimatePresence, motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { Check } from 'lucide-react'
import { FIELD_TYPES } from '../../utils/strategyTesterFields'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'

// Opened from the "+" icon on the left of a date row. Lets a person pick
// which of the 9 trackable data points this row cares about — the choice
// applies across every strategy column so the same day stays comparable
// strategy to strategy.
export default function FieldPickerPopover({ open, row, onClose }) {
  if (!row) return null
  const activeFields = row.fields

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-full z-[71] mt-1 w-40 overflow-hidden rounded-lg border shadow-xl"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
          >
            <div
              className="border-b px-2 py-1 text-[9px] font-semibold uppercase tracking-wide"
              style={{ borderColor: 'var(--color-sage)', color: 'var(--color-slate)' }}
            >
              Track for Day {row.day}
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {FIELD_TYPES.map((f) => {
                const Icon = Icons[f.icon] || Icons.Circle
                const active = activeFields.includes(f.id)
                return (
                  <motion.button
                    key={f.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => useStrategyTesterStore.getState().toggleRowField(row.id, f.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] transition-colors hover:bg-black/5"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                      style={{ backgroundColor: active ? 'var(--color-accent)' : 'var(--color-sage)' }}
                    >
                      <Icon size={11} color="var(--color-ink)" />
                    </span>
                    <span className="flex-1 truncate">{f.label}</span>
                    {active && <Check size={11} color="var(--color-ink)" />}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
