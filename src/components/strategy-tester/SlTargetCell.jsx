import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

const OPTIONS = [
  { key: 'sl', label: 'SL', long: 'Stop loss', color: '#dc2626' },
  { key: 'target', label: 'Target', long: 'Target', color: '#16a34a' },
]

// SL / Target cell. The cell shows what is set; clicking it opens a small
// popup with two options — SL or Target — pick one and type its price.
// Stored shape is unchanged: { sl, target }.
export default function SlTargetCell({ value, onChange, label }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('sl')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const sl = value?.sl ?? ''
  const tp = value?.target ?? ''
  const has = sl !== '' || tp !== ''

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

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, active])

  const toggle = () => {
    if (!open) setActive(sl === '' && tp !== '' ? 'target' : 'sl')
    setOpen((o) => !o)
  }
  const cur = OPTIONS.find((o) => o.key === active)
  const set = (key, v) => onChange({ ...(value || {}), [key]: v })

  return (
    <div ref={rootRef} className="relative flex h-full w-full items-center justify-center">
      <button
        type="button"
        onClick={toggle}
        title={label}
        className="flex h-full w-full flex-col items-center justify-center gap-[1px] px-0.5 leading-none"
        style={{ opacity: has ? 1 : 0.55 }}
      >
        {has ? (
          <>
            {sl !== '' && (
              <span className="text-[8px] font-bold tabular-nums" style={{ color: '#dc2626' }}>
                SL {sl}
              </span>
            )}
            {tp !== '' && (
              <span className="text-[8px] font-bold tabular-nums" style={{ color: '#16a34a' }}>
                TP {tp}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px]" style={{ color: 'var(--ta-slate)' }}>
            —
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="ta-glass-popover absolute left-1/2 top-full z-[90] mt-1 flex w-36 -translate-x-1/2 flex-col gap-1.5 rounded-lg border p-1.5 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top center' }}
          >
            <div className="flex gap-1">
              {OPTIONS.map((o) => {
                const on = active === o.key
                const filled = (o.key === 'sl' ? sl : tp) !== ''
                return (
                  <motion.button
                    key={o.key}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActive(o.key)}
                    className="flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[9px] font-bold"
                    style={{
                      backgroundColor: on ? o.color : 'transparent',
                      color: on ? '#fffcf2' : o.color,
                      border: `1px solid ${o.color}`,
                    }}
                  >
                    {o.label}
                    {filled && !on && <Check size={8} />}
                  </motion.button>
                )
              })}
            </div>
            <input
              ref={inputRef}
              key={active}
              type="text"
              inputMode="decimal"
              value={(active === 'sl' ? sl : tp) ?? ''}
              onChange={(e) => set(active, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
              placeholder={`${cur.long} price`}
              className="w-full rounded border bg-transparent px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums outline-none"
              style={{ color: cur.color, borderColor: cur.color }}
            />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-[8px] font-semibold"
                style={{ color: 'var(--ta-slate)' }}
              >
                Clear
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[8px] font-bold" style={{ color: 'var(--ta-accent)' }}>
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
