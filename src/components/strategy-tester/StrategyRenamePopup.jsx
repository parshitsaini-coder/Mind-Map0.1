import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, Layers, X } from 'lucide-react'

const MAX_LEN = 40

// Right-click popup on a strategy's title: type a new name, see it live in the
// same pill the header uses, Enter to save / Esc to cancel. Portaled into the
// themed root (so --ta-* vars apply) and positioned at the mouse, clamped to
// the viewport.
export default function StrategyRenamePopup({ value, x, y, onSave, onClose }) {
  const [draft, setDraft] = useState(value)
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)
  const inputRef = useRef(null)
  const rootRef = useRef(document.querySelector('[data-ta-theme]') || document.body)

  const next = draft.trim()
  const canSave = next.length > 0 && next !== value

  useLayoutEffect(() => {
    const root = rootRef.current.getBoundingClientRect()
    const W = 240
    const H = popRef.current?.offsetHeight || 150
    const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))
    setPos({ left: left - root.left, top: top - root.top })
  }, [x, y])

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const save = () => {
    if (!canSave) return
    onSave(next)
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
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="ta-glass-popover fixed z-[100] flex w-60 flex-col gap-2 rounded-lg border p-2.5 shadow-xl"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        transformOrigin: 'top left',
        backgroundColor: 'var(--ta-surface)',
        borderColor: 'var(--ta-slate)',
        color: 'var(--ta-ink)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          <Layers size={10} />
          Rename strategy
        </p>
        <button type="button" onClick={onClose} title="Close" style={{ color: 'var(--ta-slate)' }}>
          <X size={10} />
        </button>
      </div>

      <div className="st-rename-field">
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          placeholder="Strategy name"
          className="w-full rounded-md border bg-transparent px-2 py-1 text-[11px] font-semibold outline-none"
          style={{ borderColor: 'var(--tad-border)' }}
        />
        <span className="st-rename-count" data-warn={draft.length >= MAX_LEN - 5 ? '1' : '0'}>
          {draft.length}/{MAX_LEN}
        </span>
      </div>

      <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1" style={{ backgroundColor: 'var(--ta-bg)' }}>
        <span className="text-[7.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)', opacity: 0.8 }}>
          Preview
        </span>
        <span className="st-name st-name-static min-w-0 truncate">
          <span className="st-name-dot" aria-hidden="true" />
          <span className="truncate">{next || 'Strategy name'}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px]" style={{ color: 'var(--ta-slate)', opacity: 0.75 }}>
          Enter to save · Esc to cancel
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="st-rename-btn rounded-md px-2 py-0.5 text-[9.5px] font-semibold"
            style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="st-rename-btn flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[9.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
          >
            <Check size={10} />
            Save
          </button>
        </div>
      </div>
    </motion.div>,
    rootRef.current
  )
}
