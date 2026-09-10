import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

// Generic themed replacement for a native <select> — used throughout the
// Filters popover (Pair / Time frame / Status / Validation rule) so every
// option list gets the same animated, styled menu as the rest of the
// trade-analysis feature (DatePicker, the Stock/Time-frame combos in
// TradeForm, StatusDropdown) instead of the browser's unstyled list.
export default function AnimatedSelect({
  value,
  onChange,
  options, // [{ value, label }]
  placeholder = 'Select…',
  disabled = false,
  inputCls = '',
}) {
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

  const current = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        disabled={disabled}
        whileHover={disabled ? {} : { scale: 1.01 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left disabled:opacity-50`}
        style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="ml-1 flex shrink-0">
          <ChevronDown size={13} style={{ color: 'var(--ta-slate)' }} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="ta-glass-popover absolute left-0 right-0 top-full z-30 mt-1 flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1.5 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top' }}
          >
            {options.length === 0 ? (
              <li className="px-2 py-1 text-[9px]" style={{ color: 'var(--ta-slate)' }}>No options</li>
            ) : (
              options.map((opt, idx) => {
                const active = opt.value === value
                return (
                  <motion.li
                    key={opt.value || `_empty_${idx}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(idx, 10) * 0.02, duration: 0.12 } }}
                  >
                    <motion.button
                      type="button"
                      whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
                      whileTap={{ scale: 0.98 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onChange(opt.value); setOpen(false) }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[10px] font-medium transition-colors"
                      style={active ? { color: 'var(--ta-accent)' } : { color: 'var(--ta-ink)' }}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active && <Check size={12} className="shrink-0" style={{ color: 'var(--ta-accent)' }} />}
                    </motion.button>
                  </motion.li>
                )
              })
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
