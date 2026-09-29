import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { RRR_OPTIONS } from '../../utils/strategyTesterFields'

// Replaces the native <select> for the RRR cell with a small popover menu
// so it can actually be styled/animated (native <select> option lists
// can't be) — same glass-popover + staggered-item language as
// AddFieldMenu, just sized for a table cell instead of a header button.
export default function RRRSelect({ value, onChange, label }) {
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

  const pick = (v) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative flex h-full w-full items-center justify-center">
      <motion.button
        type="button"
        whileTap={{ transform: 'scale(0.94)' }}
        onClick={() => setOpen((o) => !o)}
        title={label}
        className="flex h-full w-full items-center justify-center gap-0.5 px-0.5"
        style={{ color: value ? 'var(--ta-ink)' : 'var(--ta-slate)', opacity: value ? 1 : 0.55 }}
      >
        <span key={value || 'none'} className={`text-[9px] font-semibold tabular-nums ${value ? 'st-val-in' : ''}`}>{value || '—'}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className="flex shrink-0"
        >
          <ChevronDown size={9} style={{ opacity: 0.7 }} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="ta-glass-popover absolute left-1/2 top-full z-[90] mt-1 flex w-16 -translate-x-1/2 flex-col gap-0.5 rounded-lg border p-1 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top center' }}
          >
            <motion.button
              type="button"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.1 } }}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => pick(null)}
              className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-left text-[9px] font-medium"
              style={{ color: 'var(--ta-slate)' }}
            >
              —
              {!value && <Check size={9} style={{ color: 'var(--ta-accent)' }} />}
            </motion.button>
            {RRR_OPTIONS.map((o, idx) => (
              <motion.button
                key={o}
                type="button"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0, transition: { delay: (idx + 1) * 0.015, duration: 0.1 } }}
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pick(o)}
                className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-left text-[9px] font-semibold tabular-nums"
                style={{ color: value === o ? 'var(--ta-accent)' : 'var(--ta-ink)' }}
              >
                {o}
                {value === o && <Check size={9} style={{ color: 'var(--ta-accent)' }} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
