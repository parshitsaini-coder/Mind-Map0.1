import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  Image as ImageIcon,
  CheckSquare,
  StickyNote,
  Hash,
  ArrowLeftRight,
  Crosshair,
  Trophy,
  Scale,
  IndianRupee,
} from 'lucide-react'
import { FIELD_TYPES } from '../../utils/strategyTesterFields'

const ICONS = {
  Image: ImageIcon,
  CheckSquare,
  StickyNote,
  Hash,
  ArrowLeftRight,
  Crosshair,
  Trophy,
  Scale,
  IndianRupee,
}

// The "+" on a strategy's header — click it, pick what that row needs
// (image, checkbox, notes, number, buy/sell, SL/target, win rate, RRR,
// P&L) and it's added as a new column under that strategy only. Every
// type can be added more than once (e.g. two Number columns for two
// different custom metrics) — rename the column afterwards by clicking
// its label.
export default function AddFieldMenu({ onPick, compact = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.12, rotate: open ? 45 : 90 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        title="Add a field to this strategy"
        onClick={() => setOpen((o) => !o)}
        className={`flex shrink-0 items-center justify-center rounded-full ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}
        style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
      >
        <Plus size={compact ? 10 : 12} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 440, damping: 30 }}
            className="ta-glass-popover absolute left-0 top-full z-[80] mt-1.5 flex w-44 flex-col gap-0.5 rounded-lg border p-1.5 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top left' }}
          >
            <p className="px-1.5 pb-1 pt-0.5 text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
              Add a field
            </p>
            {FIELD_TYPES.map((f, idx) => {
              const Icon = ICONS[f.icon]
              return (
                <motion.button
                  key={f.type}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02, duration: 0.12 } }}
                  whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.97 }}
                  title={f.hint}
                  onClick={() => {
                    onPick(f.type, f.label)
                    setOpen(false)
                  }}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] font-medium"
                  style={{ color: 'var(--ta-ink)' }}
                >
                  <Icon size={11} style={{ color: 'var(--ta-accent)' }} />
                  {f.label}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
