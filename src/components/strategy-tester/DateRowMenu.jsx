import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Plus, Trash2, Eraser } from 'lucide-react'

// Right-click on a DATE cell → small menu: add another entry on that date,
// and (for an extra entry) delete it. Same look as WeekdayFilterPopup.
export default function DateRowMenu({ x, y, label, isExtra, onAdd, onDelete, onClear, onClose }) {
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)
  const rootRef = useRef(document.querySelector('[data-ta-theme]') || document.body)

  useLayoutEffect(() => {
    const root = rootRef.current.getBoundingClientRect()
    const W = 176
    const H = popRef.current?.offsetHeight || 120
    const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))
    setPos({ left: left - root.left, top: top - root.top })
  }, [x, y])

  useEffect(() => {
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target)) onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const item = 'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[10px] font-semibold transition-colors hover:bg-black/5'
  const run = (fn) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <motion.div
      ref={popRef}
      data-st-popover
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="ta-glass-popover fixed z-[100] flex w-44 flex-col gap-0.5 rounded-lg border p-1.5 shadow-xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        transformOrigin: 'top left',
        backgroundColor: 'var(--ta-surface)',
        borderColor: 'var(--ta-slate)',
        color: 'var(--ta-ink)',
      }}
    >
      <p className="px-2 pb-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
        {label}
      </p>
      <button type="button" className={item} onClick={run(onAdd)} style={{ color: 'var(--ta-accent)' }}>
        <Plus size={11} strokeWidth={3} /> Add new entry
      </button>
      <button type="button" className={item} onClick={run(onClear)}>
        <Eraser size={11} /> Clear this row
      </button>
      {isExtra && (
        <button type="button" className={item} onClick={run(onDelete)} style={{ color: '#dc2626' }}>
          <Trash2 size={11} /> Delete this entry
        </button>
      )}
    </motion.div>,
    rootRef.current
  )
}
