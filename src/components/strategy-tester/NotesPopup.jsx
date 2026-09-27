import { AnimatePresence, motion } from 'framer-motion'
import { StickyNote, X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Centered modal for the Notes field — explicitly requested to open "in a
// popup" rather than an inline text box, since a date x strategy note can
// run longer than a grid cell should ever grow.
export default function NotesPopup({ open, value, dayLabel, strategyName, onClose, onSave }) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    if (open) setDraft(value || '')
  }, [open, value])

  const handleClose = () => {
    onSave(draft)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
          >
            <div
              className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
              style={{ borderColor: 'var(--color-sage)' }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <StickyNote size={12} color="var(--color-ink)" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--color-ink)' }}>
                  Note
                </p>
                <p className="truncate text-[9px] leading-tight" style={{ color: 'var(--color-slate)' }}>
                  Day {dayLabel} · {strategyName}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleClose}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--color-slate)' }}
                title="Save & close"
              >
                <X size={14} />
              </motion.button>
            </div>
            <div className="p-3">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="What happened on this trade / day..."
                className="w-full resize-none rounded-md border bg-white/70 p-2 text-[11px] outline-none focus:ring-1"
                style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
