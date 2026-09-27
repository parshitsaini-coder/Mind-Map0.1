import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Palette } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { TRADE_THEMES } from '../../theme/tradeAnalysisThemes'

// Same popover/palette as Trade Analysis's ThemePicker, pointed at
// strategyTesterStore instead — kept as its own small file rather than a
// shared prop-driven component so each feature's store stays the single
// source of truth for its own theme with zero indirection.
export default function StrategyTesterThemePicker() {
  const theme = useStrategyTesterStore((s) => s.theme)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.03 }}
        title="Theme"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-black/5"
        style={{ color: 'var(--ta-ink)' }}
      >
        <Palette size={12} />
        <span className="flex items-center gap-0.5 rounded-full border p-0.5" style={{ borderColor: 'var(--ta-slate)', opacity: 0.6 }}>
          {['surface', 'accent', 'ink'].map((key) => (
            <span
              key={key}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: (TRADE_THEMES.find((t) => t.id === theme) || TRADE_THEMES[0]).colors[key] }}
            />
          ))}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="ta-glass-popover absolute left-0 top-full z-[70] mt-1.5 flex max-h-[70vh] w-48 flex-col gap-1 overflow-y-auto rounded-lg border p-1.5 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', transformOrigin: 'top left' }}
          >
            <p className="px-1.5 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
              Color theme
            </p>
            {TRADE_THEMES.map((t, idx) => {
              const active = t.id === theme
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.025, duration: 0.12 } }}
                  whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    useStrategyTesterStore.getState().setTheme(t.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors"
                  style={{ color: 'var(--ta-ink)' }}
                >
                  <span className="flex shrink-0 items-center -space-x-1">
                    {['bg', 'surface', 'accent', 'ink'].map((key) => (
                      <span
                        key={key}
                        className="h-3.5 w-3.5 rounded-full border"
                        style={{ backgroundColor: t.colors[key], borderColor: 'rgba(0,0,0,0.15)' }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 text-[10px] font-medium">{t.name}</span>
                  {active && <Check size={12} style={{ color: t.colors.accent }} />}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
