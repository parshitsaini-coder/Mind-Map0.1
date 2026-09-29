import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import SelectOptionsPopup from './SelectOptionsPopup'
import { optionTextStyle } from '../../utils/strategyTesterFields'

// Checkbox column. Two modes, decided by whether the column has named
// checkboxes (created via right-click → options popup):
//  • none  → a plain single tick box, coloured with the column's box colour
//  • named → cell shows small coloured ticks for whichever are checked;
//            click opens a list of ALL the column's checkboxes to tick.
// Named mode stores an array of checked option ids; plain mode a boolean.
export default function CheckboxCell({ strategyId, field, value, onChange }) {
  const items = field.options || []
  const boxColor = field.color || null
  const checked = Array.isArray(value) ? value.filter((id) => items.some((o) => o.id === id)) : []

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [menuAt, setMenuAt] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const getRoot = () => btnRef.current?.closest('[data-ta-theme]') || document.body

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const root = getRoot().getBoundingClientRect()
    const W = 176
    const H = Math.min(240, 60 + items.length * 26)
    const flipUp = r.bottom + H > window.innerHeight && r.top > H
    let left = r.left + r.width / 2 - W / 2
    left = Math.max(4, Math.min(left, window.innerWidth - W - 4))
    setPos({ left: left - root.left, top: (flipUp ? r.top - 4 : r.bottom + 4) - root.top, flipUp })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const onContextMenu = (e) => {
    e.preventDefault()
    setOpen(false)
    setMenuAt({ x: e.clientX, y: e.clientY })
  }

  const toggle = (id) => onChange(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])

  const manager = menuAt && (
    <SelectOptionsPopup strategyId={strategyId} fieldId={field.id} x={menuAt.x} y={menuAt.y} onClose={() => setMenuAt(null)} />
  )

  // ── Plain single checkbox ──────────────────────────────────────────────
  if (items.length === 0) {
    const on = value === true
    const c = boxColor || 'var(--ta-accent)'
    return (
      <>
        <button
          type="button"
          onClick={() => onChange(!on)}
          onContextMenu={onContextMenu}
          className="flex h-full w-full items-center justify-center"
          title={`${field.label} — right-click to add checkbox names / colours`}
        >
          <span
            className="flex h-3 w-3 items-center justify-center rounded-[3px] border transition-colors"
            style={{ borderColor: boxColor || 'var(--ta-slate)', backgroundColor: on ? c : 'transparent' }}
          >
            {on && <Check size={8} color="#fffcf2" strokeWidth={3} />}
          </span>
        </button>
        {manager}
      </>
    )
  }

  // ── Named checkboxes ───────────────────────────────────────────────────
  const checkedItems = items.filter((o) => checked.includes(o.id))
  return (
    <div className="flex h-full w-full items-center justify-center">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onContextMenu={onContextMenu}
        title={checkedItems.length ? checkedItems.map((o) => o.label).join(', ') : `${field.label} — right-click to manage`}
        className="flex h-full w-full flex-wrap content-center items-center justify-center gap-0.5 px-0.5"
      >
        {checkedItems.length === 0 ? (
          <span
            className="flex h-3 w-3 items-center justify-center rounded-[3px] border"
            style={{ borderColor: boxColor || 'var(--ta-slate)', opacity: 0.6 }}
          />
        ) : (
          checkedItems.map((o) => (
            <span
              key={o.id}
              className="flex h-3 w-3 items-center justify-center rounded-[3px]"
              style={{ backgroundColor: o.color }}
            >
              <Check size={8} color="#fffcf2" strokeWidth={3} />
            </span>
          ))
        )}
      </button>

      {manager}

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
              className="ta-glass-popover fixed z-[95] flex flex-col gap-0.5 rounded-lg border p-1.5 shadow-xl"
              style={{
                left: pos.left,
                top: pos.top,
                width: 176,
                transform: pos.flipUp ? 'translateY(-100%)' : undefined,
                backgroundColor: 'var(--ta-surface)',
                borderColor: 'var(--ta-slate)',
                color: 'var(--ta-ink)',
              }}
            >
              <p className="px-1 pb-0.5 text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                Tick what applies · right-click cell to manage
              </p>
              <div className="ta-scroll flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                {items.map((o) => {
                  const on = checked.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(o.id)}
                      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-black/5"
                    >
                      <span
                        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border"
                        style={{ borderColor: o.color, backgroundColor: on ? o.color : 'transparent' }}
                      >
                        {on && <Check size={8} color="#fffcf2" strokeWidth={3} />}
                      </span>
                      <span className="truncate text-[10px] font-medium" style={{ color: o.color, ...optionTextStyle(o) }}>
                        {o.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        getRoot()
      )}
    </div>
  )
}
