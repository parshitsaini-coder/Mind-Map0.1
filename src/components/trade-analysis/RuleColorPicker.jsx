import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Palette, Plus, RotateCcw, X } from 'lucide-react'

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

// User-added custom colors — kept in localStorage (not the cloud-synced
// trade store) since this is a lightweight, per-browser UI preference,
// shared by every rule's color picker so a color added once shows up
// everywhere. Capped at 10 so the "Your colors" row never wraps past two
// lines.
const CUSTOM_COLORS_KEY = 'ta-rule-custom-colors'
const MAX_CUSTOM_COLORS = 10

const loadCustomColors = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((h) => typeof h === 'string') : []
  } catch {
    return []
  }
}
const saveCustomColors = (colors) => {
  try {
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — custom colors
    // just won't persist across sessions; the picker still works.
  }
}

const isValidHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
const normalizeHex = (v) => (v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v.toLowerCase())
const PANEL_W = 214
const GAP = 8
const EDGE = 8

// Pro-styled replacement for the native `<input type="color">` swatch —
// same trigger circle, but opens a designed, animated popover: a preset
// grid with spring pop-in + hover/tap feedback, a live-preview custom hex
// field, and a clear action.
//
// Rendered through a portal into document.body with viewport-measured
// `position: fixed` coordinates (computed from the trigger's own
// getBoundingClientRect, then corrected once the panel's real size is
// known) rather than being `position: absolute` inside the row. The rule
// rows animate with framer-motion's `layout` prop, which puts a CSS
// transform on them — and a transformed ancestor becomes the containing
// block for any absolutely-positioned element inside it, so the old
// in-flow popover could land anchored to the wrong box and spill outside
// the modal. Going through a portal sidesteps that entirely: the panel is
// always positioned against the real, current screen location of the
// button that opened it, and is never clipped by a row's or list's
// overflow.
export default function RuleColorPicker({ value, onChange, title = 'Custom row color' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null) // { top, left, anchorTop, anchorBottom } in viewport px
  const [hexDraft, setHexDraft] = useState(value || '')
  const [customColors, setCustomColors] = useState([])
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => setHexDraft(value || ''), [value, open])
  // Re-read from localStorage each time the panel opens, so a color added
  // via one rule's picker shows up immediately in another's.
  useEffect(() => {
    if (open) setCustomColors(loadCustomColors())
  }, [open])

  // Pass 1 (runs the instant `open` flips true): place the panel below
  // the button, right-aligned to it, clamped so it never starts off the
  // left/right edge of the viewport. This is what's visible for the very
  // first paint, using only the trigger's rect (the panel has no size to
  // measure yet).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.min(Math.max(rect.right - PANEL_W, EDGE), window.innerWidth - PANEL_W - EDGE)
    setCoords({ top: rect.bottom + GAP, left, anchorTop: rect.top, anchorBottom: rect.bottom })
  }, [open])

  // Pass 2 (runs right after the panel itself has mounted and has a real
  // height): if it would run past the bottom of the viewport, flip it to
  // open upward from the trigger instead, using the panel's *actual*
  // measured height rather than a guessed estimate.
  useLayoutEffect(() => {
    if (!open || !coords || !panelRef.current) return
    const panelH = panelRef.current.offsetHeight
    if (coords.top + panelH > window.innerHeight - EDGE && coords.anchorTop - panelH - GAP > EDGE) {
      const flippedTop = coords.anchorTop - panelH - GAP
      if (flippedTop !== coords.top) setCoords((c) => ({ ...c, top: flippedTop }))
    }
    // Re-run whenever the panel's horizontal slot changes, or its content
    // (and therefore height) changes — e.g. the "Your colors" row
    // appearing after adding a custom swatch — but not on every coords
    // write, to avoid looping between the two possible positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coords?.left, customColors.length])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    const onReflow = () => setOpen(false) // scroll/resize while open — just close, simplest and safest
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  const commitHex = (v) => {
    if (isValidHex(v)) onChange(normalizeHex(v))
  }

  // Saves the current hex draft as a reusable swatch (skips exact dupes
  // already in the preset row or the custom row), applies it immediately,
  // and persists it so it survives closing/reopening the picker.
  const addCustomColor = () => {
    const hex = hexDraft.trim()
    if (!isValidHex(hex)) return
    const norm = normalizeHex(hex)
    onChange(norm)
    if (PRESETS.includes(norm) || customColors.includes(norm)) return
    const next = [norm, ...customColors].slice(0, MAX_CUSTOM_COLORS)
    setCustomColors(next)
    saveCustomColors(next)
  }

  const removeCustomColor = (hex) => {
    const next = customColors.filter((c) => c !== hex)
    setCustomColors(next)
    saveCustomColors(next)
  }

  const openUpward = coords ? coords.top < coords.anchorTop : false

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
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

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 460, damping: 30 }}
              style={{
                backgroundColor: 'var(--ta-surface)',
                borderColor: 'var(--ta-slate)',
                transformOrigin: openUpward ? 'bottom right' : 'top right',
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: PANEL_W,
              }}
              className="ta-glass-popover z-[95] rounded-xl border p-3 shadow-2xl"
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
                  anything the presets don't cover. The + button saves it
                  as a reusable swatch in "Your colors" below. */}
              <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
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
                <motion.button
                  type="button"
                  whileHover={{ scale: isValidHex(hexDraft) ? 1.08 : 1 }}
                  whileTap={{ scale: isValidHex(hexDraft) ? 0.9 : 1 }}
                  onClick={addCustomColor}
                  disabled={!isValidHex(hexDraft)}
                  title="Add to your colors"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ backgroundColor: 'var(--ta-accent)' }}
                >
                  <Plus size={13} />
                </motion.button>
              </div>

              {/* Your colors — custom swatches the user has saved, kept
                  across sessions (localStorage) and shared by every rule's
                  picker. Hover a swatch to reveal its remove button. */}
              {customColors.length > 0 && (
                <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--ta-slate)' }}>
                  <p className="mb-1.5 text-[8.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                    Your colors
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {customColors.map((hex) => {
                      const active = value?.toLowerCase() === hex
                      return (
                        <div key={hex} className="group relative">
                          <motion.button
                            type="button"
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCustomColor(hex)
                            }}
                            title="Remove"
                            className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-slate-700 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                          >
                            <X size={8} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
