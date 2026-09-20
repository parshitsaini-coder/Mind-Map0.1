import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Palette, RotateCcw } from 'lucide-react'

// Curated preset palette — a full spectrum sweep at a consistent
// saturation/lightness (Tailwind's -400 step) so every swatch reads as
// equally "vivid" next to its neighbors, plus the app's own brand accent
// pinned at the end so it's always one click away.
const PRESETS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635',
  '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8',
  '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9',
  '#f472b6', '#fb7185', '#94a3b8', '#78716c', '#eb5e28',
]

const isValidHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
const PANEL_HEIGHT_ESTIMATE = 260

// Pro-styled replacement for the native `<input type="color">` swatch —
// same trigger circle, but opens a designed, animated popover: a preset
// grid with spring pop-in + hover/tap feedback, a live-preview custom hex
// field, and a clear action. Used for the per-rule "custom row color" dot
// in ValidationSettingsPanel.
export default function RuleColorPicker({ value, onChange, title = 'Custom row color' }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [hexDraft, setHexDraft] = useState(value || '')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => setHexDraft(value || ''), [value, open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggleOpen = () => {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen
      if (willOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setDropUp(spaceBelow < PANEL_HEIGHT_ESTIMATE && rect.top > spaceBelow)
      }
      return willOpen
    })
  }

  const commitHex = (v) => {
    if (isValidHex(v)) onChange(v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
        style={{
          background: value
            ? undefined
            : 'conic-gradient(from 0deg, var(--ta-accent), #e57373, #ba68c8, #64b5f6, #81c784, var(--ta-accent))',
          backgroundColor: value || undefined,
          border: value ? '1px solid var(--ta-slate)' : 'none',
          boxShadow: open ? '0 0 0 2px var(--ta-surface), 0 0 0 3.5px var(--ta-accent)' : 'none',
        }}
        title={title}
      >
        {!value && (
          <span className="pointer-events-none h-3 w-3 rounded-full border border-white/70" style={{ backgroundColor: 'var(--ta-surface)' }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            style={{
              backgroundColor: 'var(--ta-surface)',
              borderColor: 'var(--ta-slate)',
              transformOrigin: dropUp ? 'bottom right' : 'top right',
            }}
            className={`ta-glass-popover absolute right-0 ${
              dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
            } z-40 w-[214px] rounded-xl border p-3 shadow-2xl`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                <Palette size={12} style={{ color: 'var(--ta-accent)' }} />
                Row color
              </p>
              {value && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onChange(null)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium"
                  style={{ color: 'var(--ta-slate)' }}
                  title="Clear color"
                >
                  <RotateCcw size={10} />
                  Clear
                </motion.button>
              )}
            </div>

            {/* Preset swatch grid — springs in with a light stagger so the
                panel feels considered rather than instant/flat. */}
            <div className="grid grid-cols-5 gap-1.5">
              {PRESETS.map((hex, i) => {
                const active = value?.toLowerCase() === hex
                return (
                  <motion.button
                    key={hex}
                    type="button"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.012, type: 'spring', stiffness: 480, damping: 22 }}
                    whileHover={{ scale: 1.16 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onChange(hex)}
                    className="relative flex h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: hex,
                      boxShadow: active
                        ? `0 0 0 2px var(--ta-surface), 0 0 0 3.5px ${hex}`
                        : '0 1px 2px rgba(0,0,0,0.18)',
                    }}
                    title={hex}
                  >
                    {active && <Check size={11} color="#fff" strokeWidth={3} />}
                  </motion.button>
                )
              })}
            </div>

            {/* Custom hex — live swatch preview + free-form input, for
                anything the presets don't cover. */}
            <div className="mt-3 flex items-center gap-2 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
              <span
                className="h-6 w-6 shrink-0 rounded-full border"
                style={{ backgroundColor: isValidHex(hexDraft) ? hexDraft : 'transparent', borderColor: 'var(--ta-slate)' }}
              />
              <input
                type="text"
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => commitHex(e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && commitHex(e.currentTarget.value.trim())}
                placeholder="#eb5e28"
                maxLength={7}
                className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-[10.5px] outline-none focus:ring-1"
                style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
