import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']

// Same tint palette as the pill itself (kept in sync with TradesTable's
// STATUS_STYLE) plus a solid "dot" color used inside the option list so
// each choice reads clearly even at a glance.
const STATUS_STYLE = {
  Pending: { bg: 'rgba(235,94,40,0.14)', text: 'var(--ta-accent)', dot: '#eb5e28' },
  'Target Hit': { bg: 'rgba(95,138,82,0.16)', text: '#4c6f42', dot: '#5f8a52' },
  'SL Hit': { bg: 'rgba(179,80,58,0.16)', text: '#9c4a34', dot: '#b3503a' },
}

// A small, self-contained animated dropdown that replaces the native
// <select> for the Status column — the browser's own option list can't be
// styled or animated, so this renders its own popover menu (same
// open/close spring feel as the rest of the trade-analysis popovers) with
// colored status dots, a check mark on the active choice, and a hover
// sweep per row.
export default function StatusDropdown({ value, onChange }) {
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

  const current = STATUS_STYLE[value] || STATUS_STYLE.Pending

  return (
    <div ref={rootRef} className="relative inline-block">
      <motion.button
        type="button"
        key={value}
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold outline-none transition-colors"
        style={{ backgroundColor: current.bg, color: current.text }}
      >
        <motion.span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: current.dot }}
          animate={{ boxShadow: [`0 0 0px ${current.dot}`, `0 0 4px ${current.dot}`, `0 0 0px ${current.dot}`] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        {value}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="flex">
          <ChevronDown size={9} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute left-0 top-full z-[70] mt-1 w-28 overflow-hidden rounded-lg border p-1 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            {STATUS_OPTIONS.map((option, i) => {
              const style = STATUS_STYLE[option]
              const active = option === value
              return (
                <motion.button
                  key={option}
                  type="button"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: i * 0.03, duration: 0.12 } }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[9px] font-medium transition-colors hover:bg-black/5"
                  style={{ color: active ? style.text : 'var(--ta-ink)' }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} />
                  <span className="flex-1">{option}</span>
                  {active && <Check size={10} style={{ color: style.text }} />}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
