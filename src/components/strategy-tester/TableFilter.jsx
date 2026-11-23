import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Filter, X } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'

const FALLBACK = 'var(--ta-accent)'

// Filter button + popup for the Table view. Filters belong to ONE strategy:
// each strategy keeps its own, and switching strategy shows that one's.
export default function TableFilter({ strategyId, categories, filter, shownCount }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const toggle = useStrategyTesterStore((s) => s.toggleTableFilter)
  const clear = useStrategyTesterStore((s) => s.clearTableFilter)
  const active = Object.values(filter || {}).reduce((n, a) => n + a.length, 0)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!categories.length) return null

  return (
    <div ref={rootRef} className="relative ml-auto flex items-center gap-1">
      {active > 0 && (
        <>
          <span className="text-[8.5px] font-semibold tabular-nums" style={{ color: 'var(--ta-slate)' }}>
            {shownCount} shown
          </span>
          <button
            type="button"
            onClick={() => clear(strategyId)}
            title="Clear filter"
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}
          >
            <X size={9} />
          </button>
        </>
      )}
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold"
        style={
          active > 0
            ? { backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }
            : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
        }
      >
        <Filter size={9} />
        Filter
        {active > 0 && <span className="tabular-nums">· {active}</span>}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.97, transition: { duration: 0.09 } }}
            transition={{ type: 'spring', stiffness: 760, damping: 44, mass: 0.55 }}
            className="ta-glass-popover st-pop absolute right-0 top-full z-[90] mt-1 flex max-h-[60vh] w-64 flex-col gap-2 overflow-y-auto rounded-lg border p-2 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top right' }}
          >
            <p className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
              Show only rows with… (this strategy)
            </p>
            {categories.map((cat) => (
              <div key={cat.fieldId} className="flex flex-col gap-1">
                <span className="text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-ink)' }}>
                  {cat.label}
                </span>
                <div className="flex flex-wrap gap-1">
                  {cat.options.map((o) => {
                    const on = (filter?.[cat.fieldId] || []).includes(o.key)
                    const c = o.color || FALLBACK
                    return (
                      <motion.button
                        key={o.key}
                        type="button"
                        whileTap={{ scale: 0.93 }}
                        onClick={() => toggle(strategyId, cat.fieldId, o.key)}
                        className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                        style={{
                          backgroundColor: on ? c : 'var(--ta-bg)',
                          color: on ? '#fffcf2' : 'var(--ta-ink)',
                          boxShadow: on ? 'none' : `inset 0 0 0 1px ${c}55`,
                          transition: 'background-color 0.12s ease, color 0.12s ease',
                        }}
                      >
                        {o.label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            ))}
            {active > 0 && (
              <button
                type="button"
                onClick={() => clear(strategyId)}
                className="self-start text-[8.5px] font-semibold"
                style={{ color: 'var(--ta-accent)' }}
              >
                Clear all
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
