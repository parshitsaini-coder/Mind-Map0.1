import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus,
  Image as ImageIcon,
  CheckSquare,
  StickyNote,
  Hash,
  ArrowLeftRight,
  Crosshair,
  Trophy,
  Scale,
  IndianRupee,
  Tag,
  Tags,
  Type,
  Clock,
  Star,
  Link2,
} from 'lucide-react'
import { FIELD_TYPES } from '../../utils/strategyTesterFields'

const ICONS = {
  Image: ImageIcon,
  CheckSquare,
  StickyNote,
  Hash,
  ArrowLeftRight,
  Crosshair,
  Trophy,
  Scale,
  IndianRupee,
  Tag,
  Tags,
  Type,
  Clock,
  Star,
  Link2,
}

// The "+" on a strategy's header — click it, pick what that row needs
// (image, checkbox, notes, number, buy/sell, SL/target, win rate, RRR,
// P&L) and it's added as a new column under that strategy only. Every
// type can be added more than once (e.g. two Number columns for two
// different custom metrics) — rename the column afterwards by clicking
// its label.
export default function AddFieldMenu({ onPick, compact = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState(null)

  // The menu is portaled into the themed overlay root and positioned with
  // fixed coords, so the table's scroll container can't clip it when the +
  // sits at the right edge. It right-aligns / flips up when space runs out.
  const getRoot = () => rootRef.current?.closest('[data-ta-theme]') || document.body

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    const root = getRoot().getBoundingClientRect()
    const W = 176
    const H = Math.min(440, window.innerHeight - 16)
    let left = r.left
    if (left + W > window.innerWidth - 8) left = r.right - W
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    const flipUp = r.bottom + 6 + H > window.innerHeight && r.top > H
    setPos({
      left: left - root.left,
      top: (flipUp ? r.top - 6 : r.bottom + 6) - root.top,
      flipUp,
      alignRight: left !== r.left,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKeyDown)
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.12, rotate: open ? 45 : 90 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        title="Add a field to this strategy"
        onClick={() => setOpen((o) => !o)}
        className={`flex shrink-0 items-center justify-center rounded-full ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}
        style={{ backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }}
      >
        <Plus size={compact ? 10 : 12} />
      </motion.button>

      {createPortal(
      <AnimatePresence>
        {open && pos && (
          <motion.div
            ref={popRef}
            data-st-popover
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 440, damping: 30 }}
            className="ta-glass-popover ta-scroll fixed z-[95] flex max-h-[calc(100vh-16px)] w-44 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1.5 shadow-xl"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.flipUp ? 'translateY(-100%)' : undefined,
              backgroundColor: 'var(--ta-surface)',
              borderColor: 'var(--ta-slate)',
              transformOrigin: `${pos.flipUp ? 'bottom' : 'top'} ${pos.alignRight ? 'right' : 'left'}`,
            }}
          >
            <p className="px-1.5 pb-1 pt-0.5 text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
              Add a field
            </p>
            {FIELD_TYPES.map((f, idx) => {
              const Icon = ICONS[f.icon]
              return (
                <motion.button
                  key={f.type}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.02, duration: 0.12 } }}
                  whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.97 }}
                  title={f.hint}
                  onClick={() => {
                    onPick(f.type, f.label)
                    setOpen(false)
                  }}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] font-medium"
                  style={{ color: 'var(--ta-ink)' }}
                >
                  <Icon size={11} style={{ color: 'var(--ta-accent)' }} />
                  {f.label}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>,
        getRoot()
      )}
    </div>
  )
}
