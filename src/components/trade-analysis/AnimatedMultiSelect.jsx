import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search } from 'lucide-react'

// Multi-select sibling of AnimatedSelect — same look and feel, but keeps
// the menu open across picks and lets several options be active at once.
// Used by FiltersPopover so Pair / Time frame / Status / Validation rule
// can each match more than one value.
//
// No per-item stagger delay here (AnimatedSelect's `idx * 0.02` fade-in):
// with 10+ options that delay visibly trickles in, which is what made the
// old single-select feel slow to open. This menu appears in one 0.1s fade
// instead, so it's ready to use immediately.
export default function AnimatedMultiSelect({
  values = [], // array of selected values
  onToggle, // (value) => void
  options, // [{ value, label }] — should NOT include an "All"/empty placeholder option
  placeholder = 'All',
  disabled = false,
  inputCls = '',
  searchable = false, // show a search box above the list — for long option sets (e.g. Pair)
  searchPlaceholder = 'Search...',
  // true (default) = classic floating popover that overlays whatever sits
  // below it — right for FiltersPopover, which already floats over the
  // table/cards behind it. false = the menu renders in normal document
  // flow instead, pushing the fields below it down the page rather than
  // covering them — needed inside ReportFiltersModal, where several of
  // these selects sit stacked in a scrollable column and an overlaid menu
  // would hide the PDF-quality picker / footer underneath it.
  floating = true,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)

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

  // Clear the search text each time the menu closes, and focus it the
  // instant the menu opens so typing works immediately with no extra click.
  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
    if (!open) setQuery('')
  }, [open, searchable])

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query, searchable])

  const label =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label || values[0]
        : `${values.length} selected`

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
        <span className="truncate">{label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.12 }} className="ml-1 flex shrink-0">
          <ChevronDown size={13} style={{ color: 'var(--ta-slate)' }} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className={`ta-glass-popover z-30 mt-1 flex flex-col rounded-lg border shadow-xl ${floating ? 'absolute left-0 right-0 top-full' : 'relative'}`}
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top' }}
          >
            {searchable && (
              <div className="flex items-center gap-1.5 border-b px-2 py-1.5" style={{ borderColor: 'var(--ta-slate)' }}>
                <Search size={12} style={{ color: 'var(--ta-slate)' }} className="shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-[10.5px] outline-none"
                  style={{ color: 'var(--ta-ink)' }}
                />
              </div>
            )}
            <ul className="flex max-h-44 flex-col gap-0.5 overflow-y-auto p-1.5">
              {visibleOptions.length === 0 ? (
                <li className="px-2 py-1 text-[9px]" style={{ color: 'var(--ta-slate)' }}>
                  {query.trim() ? 'No matches' : 'No options'}
                </li>
              ) : (
                visibleOptions.map((opt) => {
                  const active = values.includes(opt.value)
                  return (
                    <li key={opt.value}>
                      <motion.button
                        type="button"
                        whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
                        whileTap={{ scale: 0.98 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onToggle(opt.value)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] font-medium transition-colors"
                        style={{ color: active ? 'var(--ta-accent)' : 'var(--ta-ink)' }}
                      >
                        <span
                          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border"
                          style={
                            active
                              ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)' }
                              : { borderColor: 'var(--ta-slate)' }
                          }
                        >
                          {active && <Check size={10} color="#fffcf2" />}
                        </span>
                        <span className="truncate">{opt.label}</span>
                      </motion.button>
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
