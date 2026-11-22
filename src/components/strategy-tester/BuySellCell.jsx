import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

const OPTIONS = [
  { key: 'buy', label: 'Buy', color: '#16a34a' },
  { key: 'sell', label: 'Sell', color: '#dc2626' },
]

// Buy / Sell cell: shows the chosen side (or —); click opens a small popup
// with the two options. Stored values unchanged: 'buy' | 'sell' | null.
export default function BuySellCell({ value, onChange, label }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const cur = OPTIONS.find((o) => o.key === value)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const pick = (v) => {
    onChange(v === value ? null : v)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative flex h-full w-full items-center justify-center">
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((o) => !o)}
        title={label}
        className="flex h-full w-full items-center justify-center px-0.5"
        style={{ opacity: cur ? 1 : 0.55 }}
      >
        {cur ? (
          <span
            key={cur.key}
            className="st-val-in rounded-[3px] px-1.5 py-[1px] text-[8.5px] font-bold"
            style={{ backgroundColor: cur.color, color: '#fffcf2' }}
          >
            {cur.label}
          </span>
        ) : (
          <span className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>
            —
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="ta-glass-popover absolute left-1/2 top-full z-[90] mt-1 flex w-20 -translate-x-1/2 flex-col gap-1 rounded-lg border p-1 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top center' }}
          >
            {OPTIONS.map((o, idx) => (
              <motion.button
                key={o.key}
                type="button"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02, duration: 0.1 } }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pick(o.key)}
                className="flex items-center justify-between gap-1 rounded-md px-2 py-1 text-[9px] font-bold"
                style={{
                  backgroundColor: value === o.key ? o.color : 'transparent',
                  color: value === o.key ? '#fffcf2' : o.color,
                  border: `1px solid ${o.color}`,
                }}
              >
                {o.label}
                {value === o.key && <Check size={9} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
