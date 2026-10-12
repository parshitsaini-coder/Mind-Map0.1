import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Plus, X } from 'lucide-react'

// Multi-select dropdown for a trade's strategy / setup type. Selected
// values show as removable chips inside the trigger; the popover lists every
// option with a checkbox (menu stays open across picks), and has an inline
// "add your own" row at the bottom. Options can be deleted with the small x
// that appears on hover.
export default function SetupTypeSelect({ values = [], options = [], onToggle, onAdd, onRemoveOption }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const submit = () => {
    const n = draft.trim()
    if (!n) return
    onAdd(n)
    setDraft('')
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        className="flex min-h-[28px] w-full cursor-pointer items-center gap-1 rounded-md border bg-white/70 px-1.5 py-1 text-left text-[10px] transition-shadow"
        style={{
          borderColor: open ? 'var(--ta-accent)' : 'var(--ta-slate)',
          color: 'var(--ta-ink)',
          boxShadow: open ? '0 0 0 2px rgba(235,94,40,0.15)' : 'none',
        }}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {values.length === 0 ? (
            <span style={{ color: 'var(--ta-slate)' }}>Select…</span>
          ) : (
            <AnimatePresence initial={false}>
              {values.map((v) => (
                <motion.span
                  key={v}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                  className="flex items-center gap-0.5 rounded-full py-0.5 pl-1.5 pr-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
                >
                  {v}
                  <button
                    type="button"
                    aria-label={`Remove ${v}`}
                    onClick={(e) => { e.stopPropagation(); onToggle(v) }}
                    className="flex h-3 w-3 items-center justify-center rounded-full hover:bg-black/20"
                  >
                    <X size={8} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          )}
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.12 }} className="flex shrink-0">
          <ChevronDown size={13} style={{ color: 'var(--ta-slate)' }} />
        </motion.span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="ta-glass-popover absolute right-0 top-full z-30 mt-1 flex w-[calc(200%+0.5rem)] flex-col rounded-lg border shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top' }}
          >
            <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto p-1.5">
              {options.length === 0 && (
                <li className="px-2 py-1 text-[9px]" style={{ color: 'var(--ta-slate)' }}>No options — add one below</li>
              )}
              {options.map((name) => {
                const active = values.includes(name)
                return (
                  <li key={name} className="group relative">
                    <button
                      type="button"
                      onClick={() => onToggle(name)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 pr-6 text-left text-[10px] font-medium transition-colors hover:bg-black/5"
                      style={{ color: active ? 'var(--ta-accent)' : 'var(--ta-ink)' }}
                    >
                      <span
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border"
                        style={active ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)' } : { borderColor: 'var(--ta-slate)' }}
                      >
                        {active && <Check size={10} color="#fffcf2" />}
                      </span>
                      <span className="truncate">{name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete option ${name}`}
                      title="Delete this option"
                      onClick={() => onRemoveOption(name)}
                      className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-red-500 hover:bg-red-500/10 group-hover:block"
                    >
                      <X size={10} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center gap-1 border-t p-1.5" style={{ borderColor: 'var(--ta-slate)' }}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder="Add new (e.g. Order Flow)…"
                className="w-full rounded-md border bg-white/70 px-1.5 py-1 text-[10px] outline-none"
                style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
              />
              <button
                type="button"
                onClick={submit}
                aria-label="Add setup type"
                className="flex shrink-0 items-center justify-center rounded-md px-1.5 py-1"
                style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
              >
                <Plus size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
