import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StickyNote, X } from 'lucide-react'

// Small centered popup for a Notes cell — opened by clicking the cell.
// Per the design brief, notes shouldn't try to fit inline in a narrow
// grid cell; they get their own focused popup with a real textarea.
export default function NotesPopup({ title, value, onSave, onClose }) {
  const [draft, setDraft] = useState(value || '')

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col gap-2 rounded-xl border p-3 shadow-2xl"
          style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
        >
          <div className="flex items-center gap-1.5">
            <StickyNote size={12} style={{ color: 'var(--ta-accent)' }} />
            <span className="flex-1 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
              {title}
            </span>
            <button onClick={onClose} className="rounded p-0.5 hover:bg-black/5" style={{ color: 'var(--ta-slate)' }}>
              <X size={13} />
            </button>
          </div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note…"
            rows={5}
            className="ta-input w-full resize-none rounded-md border px-2 py-1.5 text-[11px] outline-none"
            style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
          />
          <div className="flex justify-end gap-1.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="rounded-md px-2.5 py-1 text-[10.5px] font-medium"
              style={{ color: 'var(--ta-slate)' }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold"
              style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
            >
              Save note
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
