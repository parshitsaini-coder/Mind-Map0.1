import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import SelectOptionsPopup from './SelectOptionsPopup'
import { Tick } from './motionBits'

// Checkbox column. Two modes, decided by whether the column has named
// checkboxes (created via right-click → options popup):
//  • none  → a plain single tick box, coloured with the column's box colour
//  • named → one tick box per named checkbox, shown right in the cell and
//            toggled directly with a click (no popup). Hover a box to see
//            its name; the column header shows the names too.
// Named mode stores an array of ticked option ids; plain mode a boolean.
export default function CheckboxCell({ strategyId, field, value, onChange }) {
  const items = field.options || []
  const boxColor = field.color || null
  const [menuAt, setMenuAt] = useState(null)

  const onContextMenu = (e) => {
    e.preventDefault()
    setMenuAt({ x: e.clientX, y: e.clientY })
  }

  const manager = (
    <AnimatePresence>
      {menuAt && (
        <SelectOptionsPopup strategyId={strategyId} fieldId={field.id} x={menuAt.x} y={menuAt.y} onClose={() => setMenuAt(null)} />
      )}
    </AnimatePresence>
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
          className="st-cb flex h-full w-full items-center justify-center"
          title={`${field.label} — right-click to add checkbox names / colours`}
        >
          <span
            className={`st-box relative flex h-3 w-3 items-center justify-center rounded-[3px] border ${on ? 'is-on' : ''}`}
            style={{ borderColor: boxColor || 'var(--ta-slate)', backgroundColor: on ? c : 'transparent' }}
          >
            <Tick on={on} />
          </span>
        </button>
        {manager}
      </>
    )
  }

  // ── Named checkboxes: direct tick, no popup ────────────────────────────
  const checked = Array.isArray(value) ? value.filter((id) => items.some((o) => o.id === id)) : []
  const toggle = (id) => onChange(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])

  return (
    <div
      className="flex h-full w-full flex-wrap content-center items-center justify-center gap-1 px-0.5"
      onContextMenu={onContextMenu}
    >
      {items.map((o) => {
        const on = checked.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            title={`${o.label} — right-click to manage`}
            className="st-cb flex h-3 w-3 shrink-0 items-center justify-center"
          >
            <span
              className={`st-box relative flex h-3 w-3 items-center justify-center rounded-[3px] border ${on ? 'is-on' : ''}`}
              style={{ borderColor: o.color, backgroundColor: on ? o.color : 'transparent' }}
            >
              <Tick on={on} />
            </span>
          </button>
        )
      })}
      {manager}
    </div>
  )
}
