import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { GripVertical, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import {
  CARD_GRID_COLS,
  CARD_MAX_H,
  CARD_MIN_H,
  DEFAULT_CARD_W,
  FIELD_HEADER_COLORS,
  resolveCardFields,
} from '../../utils/strategyTesterFields'
import FieldCell from './FieldCell'
import { EASE_OUT } from './motionBits'

const GAP = 4 // px — matches the real card grid
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Turns the resolved [{ field, w, h }] list back into the storable layout.
const toLayout = (items) => ({
  order: items.map((i) => i.field.id),
  dims: Object.fromEntries(
    items.map((i) => [i.field.id, { w: i.w, ...(i.h ? { h: i.h } : {}) }])
  ),
})

// One draggable / resizable field tile inside the preview card.
function Tile({ item, index, tileRefs, gridRef, dragging, resizing, onDragStart, onDrag, onDragEnd, onResize, onResizeEnd, onResetSize }) {
  const { field, w, h } = item
  const controls = useDragControls()
  const [c1] = FIELD_HEADER_COLORS[field.type] || ['#64748b']
  const isDragging = dragging === field.id
  const isResizing = resizing === field.id

  // Edge / corner resize. Width snaps to whole grid columns; height is free
  // (px). Everything is written to local state while dragging (smooth, no
  // store churn) and committed once on release.
  const startResize = (e, axis) => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const tile = tileRefs.current.get(field.id)
    const gridW = gridRef.current.getBoundingClientRect().width
    const step = (gridW - GAP * (CARD_GRID_COLS - 1)) / CARD_GRID_COLS + GAP
    const startX = e.clientX
    const startY = e.clientY
    const startW = w
    const startH = h || Math.round(tile.getBoundingClientRect().height)
    document.body.style.userSelect = 'none'
    onResize(field.id, { w, h }, true)

    const move = (ev) => {
      const nextW = axis === 'y' ? startW : clamp(startW + Math.round((ev.clientX - startX) / step), 1, CARD_GRID_COLS)
      const nextH = axis === 'x' ? h : clamp(Math.round(startH + ev.clientY - startY), CARD_MIN_H, CARD_MAX_H)
      onResize(field.id, { w: nextW, h: nextH }, false)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''
      onResizeEnd()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const handleCls = 'absolute z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100'

  return (
    <motion.div
      ref={(el) => {
        if (el) tileRefs.current.set(field.id, el)
        else tileRefs.current.delete(field.id)
      }}
      layout={!isResizing}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => onDragStart(field.id)}
      onDrag={(e) => onDrag(field.id, e.clientX, e.clientY)}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.05, boxShadow: '0 10px 24px rgba(0,0,0,0.28)' }}
      className="group relative flex flex-col overflow-visible rounded-md border px-1 pb-1 pt-0.5"
      style={{
        gridColumn: `span ${w}`,
        height: h || undefined,
        minHeight: CARD_MIN_H,
        zIndex: isDragging ? 30 : isResizing ? 20 : 1,
        backgroundColor: 'var(--ta-surface)',
        borderColor: isDragging || isResizing ? 'var(--ta-accent)' : 'var(--tad-border)',
        borderStyle: isDragging ? 'dashed' : 'solid',
      }}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            controls.start(e)
          }}
          title="Drag to move"
          className="flex shrink-0 cursor-grab touch-none rounded p-[1px] active:cursor-grabbing"
          style={{ color: 'var(--ta-slate)' }}
        >
          <GripVertical size={10} />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-[7.5px] font-bold uppercase tracking-wide" style={{ color: c1 }}>
          {field.label}
        </span>
        <span className="w-[10px] shrink-0" />
      </div>
      <div className="pointer-events-none flex min-h-0 flex-1 items-center justify-center">
        <FieldCell strategyId="__preview__" field={field} dk="__preview__" rowLabel="" value={undefined} />
      </div>

      {(isResizing || isDragging) && (
        <span
          className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-full px-1.5 py-[1px] text-[8px] font-bold"
          style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
        >
          {isDragging ? `#${index + 1}` : `${w} col${w > 1 ? 's' : ''}${h ? ` · ${h}px` : ''}`}
        </span>
      )}

      {/* right edge — width */}
      <div
        onPointerDown={(e) => startResize(e, 'x')}
        onDoubleClick={() => onResetSize(field, 'x')}
        title="Drag to change width · double-click to reset"
        className={`${handleCls} -right-1 top-1 bottom-1 w-2 cursor-ew-resize touch-none`}
      >
        <span className="h-4 w-[3px] rounded-full" style={{ backgroundColor: 'var(--ta-accent)' }} />
      </div>
      {/* bottom edge — height */}
      <div
        onPointerDown={(e) => startResize(e, 'y')}
        onDoubleClick={() => onResetSize(field, 'y')}
        title="Drag to change height · double-click to reset"
        className={`${handleCls} -bottom-1 left-1 right-1 h-2 cursor-ns-resize touch-none`}
      >
        <span className="h-[3px] w-4 rounded-full" style={{ backgroundColor: 'var(--ta-accent)' }} />
      </div>
      {/* corner — both */}
      <div
        onPointerDown={(e) => startResize(e, 'xy')}
        onDoubleClick={() => {
          onResetSize(field, 'x')
          onResetSize(field, 'y')
        }}
        title="Drag to resize · double-click to reset"
        className={`${handleCls} -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize touch-none`}
      >
        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: 'var(--ta-accent)' }} />
      </div>
    </motion.div>
  )
}

// "Adjust card" popup — shows one day card as a live preview where every
// field tile can be dragged to a new spot and resized (columns snap, height is
// free). The layout applies to every day card of that strategy.
export default function CardAdjustPopup({ strategies, onClose }) {
  const cardCols = useStrategyTesterStore((s) => s.cardCols) || 0
  const [activeId, setActiveId] = useState(strategies[0]?.id)
  const active = strategies.find((s) => s.id === activeId) || strategies[0]

  const [items, setItems] = useState(() => (active ? resolveCardFields(active) : []))
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const tileRefs = useRef(new Map())
  const gridRef = useRef(null)
  const lastSwap = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Re-read the strategy whenever the tab changes (or fields are added
  // elsewhere while the popup is open).
  useEffect(() => {
    if (active) setItems(resolveCardFields(active))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const commit = useCallback(
    (list) => {
      if (active) useStrategyTesterStore.getState().setCardLayout(active.id, toLayout(list))
    },
    [active]
  )

  const onResize = (id, next, start) => {
    if (start) {
      setResizing(id)
      return
    }
    setItems((list) => list.map((it) => (it.field.id === id ? { ...it, w: next.w, h: next.h ?? it.h } : it)))
  }
  const onResizeEnd = () => {
    setResizing(null)
    commit(itemsRef.current)
  }
  const onResetSize = (field, axis) => {
    const next = itemsRef.current.map((it) =>
      it.field.id !== field.id
        ? it
        : { ...it, ...(axis === 'x' ? { w: DEFAULT_CARD_W[field.type] || 2 } : { h: null }) }
    )
    setItems(next)
    commit(next)
  }

  // Move the dragged tile to the slot of whichever tile the pointer is over.
  const onDrag = (id, x, y) => {
    const now = performance.now()
    if (now - lastSwap.current < 140) return
    let targetId = null
    tileRefs.current.forEach((el, tid) => {
      if (tid === id) return
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) targetId = tid
    })
    if (!targetId) return
    setItems((list) => {
      const from = list.findIndex((i) => i.field.id === id)
      const to = list.findIndex((i) => i.field.id === targetId)
      if (from < 0 || to < 0 || from === to) return list
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    lastSwap.current = now
  }
  const onDragEnd = () => {
    setDragging(null)
    commit(itemsRef.current)
  }

  const reset = () => {
    if (!active) return
    useStrategyTesterStore.getState().resetCardLayout(active.id)
    setItems(resolveCardFields({ ...active, cardLayout: undefined }))
  }

  const colOptions = useMemo(() => [0, 1, 2, 3, 4], [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.14, ease: EASE_OUT } }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col gap-2 overflow-hidden rounded-xl border p-3 shadow-2xl"
        style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
      >
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={12} style={{ color: 'var(--ta-accent)' }} />
          <span className="flex-1 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
            Adjust card
          </span>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-black/5" style={{ color: 'var(--ta-slate)' }}>
            <X size={13} />
          </button>
        </div>

        <p className="text-[9px] leading-snug" style={{ color: 'var(--ta-slate)' }}>
          Drag <GripVertical size={9} className="inline" /> to move a field anywhere. Drag its right edge, bottom edge or corner to
          resize (width snaps to columns). Double-click a handle to reset. Applies to every day card.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {strategies.length > 1 && (
            <div className="flex flex-wrap items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
              {strategies.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setActiveId(st.id)}
                  className="relative rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                  style={{ color: st.id === active?.id ? '#fffcf2' : 'var(--ta-ink)' }}
                >
                  {st.id === active?.id && (
                    <motion.span
                      layoutId="st-adjust-strategy-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: 'var(--ta-accent)' }}
                    />
                  )}
                  <span className="relative">{st.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
              Cards per row
            </span>
            <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
              {colOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => useStrategyTesterStore.getState().setCardCols(n)}
                  className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                  style={{
                    backgroundColor: cardCols === n ? 'var(--ta-accent)' : 'transparent',
                    color: cardCols === n ? '#fffcf2' : 'var(--ta-ink)',
                  }}
                >
                  {n === 0 ? 'Auto' : n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2 pl-1 pr-2 pt-3">
          <div className="rounded-lg border p-1.5" style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)' }}>
            <div className="mb-1 truncate text-[10px] font-bold" style={{ color: 'var(--ta-ink)' }}>
              {active?.name}
            </div>
            <div
              ref={gridRef}
              className="grid"
              style={{ gridTemplateColumns: `repeat(${CARD_GRID_COLS}, minmax(0, 1fr))`, gap: GAP }}
            >
              {items.map((item, i) => (
                <Tile
                  key={item.field.id}
                  item={item}
                  index={i}
                  tileRefs={tileRefs}
                  gridRef={gridRef}
                  dragging={dragging}
                  resizing={resizing}
                  onDragStart={setDragging}
                  onDrag={onDrag}
                  onDragEnd={onDragEnd}
                  onResize={onResize}
                  onResizeEnd={onResizeEnd}
                  onResetSize={onResetSize}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={reset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium"
            style={{ color: 'var(--ta-slate)' }}
          >
            <RotateCcw size={10} /> Reset layout
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="rounded-md px-3 py-1 text-[10.5px] font-semibold"
            style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
          >
            Done
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
