import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { SELECT_COLORS } from '../../utils/strategyTesterFields'

const chipStyle = (color) => ({ backgroundColor: `${color}26`, color })

function Chip({ option, className = '' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-[4px] px-1.5 py-[1px] text-[9px] font-semibold ${className}`}
      style={chipStyle(option.color)}
    >
      <span className="truncate">{option.label}</span>
    </span>
  )
}

// Notion-style single select. The column owns a list of options (label +
// colour); each day's cell just stores the id of the chosen option.
// Type in the box and press Enter to create a new option on the spot,
// click a tag to select it, click its dot to change colour, × to delete.
export default function SelectCell({ strategyId, field, value, onChange }) {
  const options = field.options || []
  const selected = options.find((o) => o.id === value) || null

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const inputRef = useRef(null)

  // The popover is portaled into the themed overlay root (so --ta-* vars
  // still apply) and positioned with fixed coords, so the table's scroll
  // container can't clip it.
  const getRoot = () => btnRef.current?.closest('[data-ta-theme]') || document.body

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const root = getRoot().getBoundingClientRect()
    const W = 176
    const H = 260
    const flipUp = r.bottom + H > window.innerHeight && r.top > H
    let left = r.left + r.width / 2 - W / 2
    left = Math.max(4, Math.min(left, window.innerWidth - W - 4))
    setPos({
      left: left - root.left,
      top: (flipUp ? r.top - 4 : r.bottom + 4) - root.top,
      flipUp,
      width: W,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      setQuery('')
    }
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const store = useStrategyTesterStore.getState
  const q = query.trim()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options
  const exact = options.some((o) => o.label.toLowerCase() === q.toLowerCase())

  const pick = (id) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const create = () => {
    if (!q || exact) return
    const id = store().addFieldOption(strategyId, field.id, q)
    if (id) pick(id)
  }

  const cycleColor = (opt) => {
    const idx = SELECT_COLORS.indexOf(opt.color)
    store().updateFieldOption(strategyId, field.id, opt.id, { color: SELECT_COLORS[(idx + 1) % SELECT_COLORS.length] })
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.button
        ref={btnRef}
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((o) => !o)}
        title={field.label}
        className="flex h-full w-full items-center justify-center gap-0.5 px-1"
      >
        {selected ? (
          <Chip option={selected} />
        ) : (
          <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--ta-slate)', opacity: 0.55 }}>
            —<ChevronDown size={9} />
          </span>
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={popRef}
              data-st-popover
              initial={{ opacity: 0, y: pos.flipUp ? 4 : -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="ta-glass-popover fixed z-[95] flex flex-col gap-1 rounded-lg border p-1.5 shadow-xl"
              style={{
                left: pos.left,
                top: pos.top,
                width: pos.width,
                transform: pos.flipUp ? 'translateY(-100%)' : undefined,
                backgroundColor: 'var(--ta-surface)',
                borderColor: 'var(--ta-slate)',
                color: 'var(--ta-ink)',
              }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (q && !exact) create()
                    else if (filtered.length === 1) pick(filtered[0].id)
                  }
                }}
                placeholder="Search or create option…"
                className="w-full rounded border bg-transparent px-1.5 py-0.5 text-[10px] outline-none"
                style={{ borderColor: 'var(--tad-border)' }}
              />

              <p className="px-1 pt-0.5 text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                Select an option
              </p>

              <div className="ta-scroll flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                {value && (
                  <button
                    type="button"
                    onClick={() => pick(null)}
                    className="rounded px-1.5 py-0.5 text-left text-[9px] hover:bg-black/5"
                    style={{ color: 'var(--ta-slate)' }}
                  >
                    — Clear
                  </button>
                )}
                {filtered.map((o) => (
                  <div key={o.id} className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-black/5">
                    <button
                      type="button"
                      title="Change colour"
                      onClick={() => cycleColor(o)}
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: o.color }}
                    />
                    <button type="button" onClick={() => pick(o.id)} className="flex min-w-0 flex-1 items-center gap-1 text-left">
                      <Chip option={o} />
                      {value === o.id && <Check size={9} style={{ color: 'var(--ta-accent)' }} />}
                    </button>
                    <button
                      type="button"
                      title="Delete option"
                      onClick={() => store().removeFieldOption(strategyId, field.id, o.id)}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                      style={{ color: 'var(--ta-slate)' }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
                {filtered.length === 0 && !q && (
                  <p className="px-1.5 py-1 text-[9px] italic" style={{ color: 'var(--ta-slate)' }}>
                    No options yet — type a name and press Enter.
                  </p>
                )}
              </div>

              {q && !exact && (
                <button
                  type="button"
                  onClick={create}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-left text-[9.5px] font-semibold hover:bg-black/5"
                  style={{ color: 'var(--ta-accent)' }}
                >
                  <Plus size={10} />
                  Create “{q}”
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        getRoot()
      )}
    </div>
  )
}
