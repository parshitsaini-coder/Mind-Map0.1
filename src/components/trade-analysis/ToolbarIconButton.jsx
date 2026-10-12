import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

// Icon-only toolbar controls for the Trade Analysis top bar.
//
// Pattern borrowed from the animated-component libraries:
//   • Magic UI "ShimmerButton"  → light sweep across the button on hover
//   • Magic UI "BorderBeam"     → rotating glow border (primary button only)
//   • React Bits blur-in text   → tooltip that fades/blur-scales in
//
// Everything is plain framer-motion (already a dependency) — no new packages.

// ─── Tooltip ────────────────────────────────────────────────────────────
// Dark pill that appears BELOW the control (the top bar hugs the top edge
// of the screen, so above would be clipped). `align="end"` pins it to the
// right edge for controls sitting at the far right of the bar.
export function ToolbarTooltip({ show, label, hint, align = 'center' }) {
  const isEnd = align === 'end'
  const isStart = align === 'start'
  return (
    <AnimatePresence>
      {show && (
        <div
          className={`pointer-events-none absolute top-full z-[90] pt-2 ${
            isEnd ? 'right-0' : isStart ? 'left-0' : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: -6, scale: 0.88, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, scale: 0.92, filter: 'blur(3px)', transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 28, delay: 0.06 }}
            style={{ transformOrigin: isEnd ? 'top right' : isStart ? 'top left' : 'top center' }}
            className="relative whitespace-nowrap rounded-lg px-2.5 py-1.5 text-center shadow-xl"
          >
            <span
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                boxShadow: '0 8px 24px rgba(15,23,42,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            />
            {/* little arrow */}
            <span
              className={`absolute -top-1 h-2 w-2 rotate-45 ${isEnd ? 'right-2.5' : isStart ? 'left-2.5' : 'left-1/2 -ml-1'}`}
              style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            />
            <span className="relative block text-[11px] font-semibold leading-tight text-white">{label}</span>
            {hint && <span className="relative mt-0.5 block text-[9.5px] leading-tight text-slate-300">{hint}</span>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ─── Per-icon hover animations ──────────────────────────────────────────
// Each control gets its own little personality on hover.
const ICON_VARIANTS = {
  share: {
    rest: { scale: 1, rotate: 0 },
    hover: { scale: [1, 1.25, 1.1], rotate: [0, -14, 10, 0], transition: { duration: 0.55 } },
  },
  download: {
    rest: { y: 0 },
    hover: { y: [0, 3, -1, 0], transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } },
  },
  filter: {
    rest: { rotate: 0, scale: 1 },
    hover: { rotate: 90, scale: 1.12, transition: { type: 'spring', stiffness: 320, damping: 14 } },
  },
  gear: {
    rest: { rotate: 0 },
    hover: { rotate: 180, scale: 1.1, transition: { type: 'spring', stiffness: 160, damping: 12 } },
  },
  pop: {
    rest: { scale: 1 },
    hover: { scale: 1.2, transition: { type: 'spring', stiffness: 420, damping: 14 } },
  },
}

const TONES = {
  neutral: {
    background: 'var(--ta-bg)',
    color: 'var(--ta-ink)',
    glow: '0 6px 16px rgba(0,0,0,0.22)',
    shimmer: 'rgba(255,255,255,0.55)',
  },
  dark: {
    background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    color: '#ffffff',
    glow: '0 6px 18px rgba(15,23,42,0.5)',
    shimmer: 'rgba(255,255,255,0.4)',
  },
  accent: {
    background: 'linear-gradient(135deg, var(--ta-accent), color-mix(in srgb, var(--ta-accent) 70%, #000 30%))',
    color: '#fffcf2',
    glow: '0 6px 18px color-mix(in srgb, var(--ta-accent) 55%, transparent)',
    shimmer: 'rgba(255,255,255,0.45)',
  },
}

// ─── Icon button ────────────────────────────────────────────────────────
export default function ToolbarIconButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled = false,
  tone = 'neutral',
  iconAnim = 'pop',
  badge = 0,
  beam = false,
  spin = false,
  align = 'center',
  suppressTooltip = false,
  iconSize = 14,
  size = 26,
}) {
  const [hovered, setHovered] = useState(false)
  const t = TONES[tone] ?? TONES.neutral
  const variants = ICON_VARIANTS[iconAnim] ?? ICON_VARIANTS.pop

  return (
    // Wrapper owns hover/focus so the tooltip still shows on a DISABLED
    // button (browsers swallow pointer events on disabled <button>s) —
    // that's how "Log at least one trade first" gets explained.
    <span
      className="relative flex shrink-0"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        initial="rest"
        animate="rest"
        whileHover={disabled ? undefined : 'hover'}
        whileTap={disabled ? undefined : { scale: 0.86 }}
        variants={{ rest: { scale: 1, y: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }, hover: { scale: 1.12, y: -1.5, boxShadow: t.glow } }}
        transition={{ type: 'spring', stiffness: 480, damping: 22 }}
        className="relative flex items-center justify-center overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ta-accent)] disabled:pointer-events-none disabled:opacity-45"
        style={{ background: t.background, color: t.color, width: size, height: size }}
      >
        {/* Magic UI-style border beam — a soft light orbiting the edge */}
        {beam && !disabled && (
          <>
            <motion.span
              aria-hidden
              className="absolute -inset-[60%]"
              style={{ background: 'conic-gradient(from 0deg, transparent 0 70%, rgba(255,255,255,0.85) 85%, transparent 100%)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
            />
            <span aria-hidden className="absolute inset-[1.5px] rounded-[6px]" style={{ background: t.background }} />
          </>
        )}

        {/* Shimmer sweep on hover */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/2"
          style={{ background: `linear-gradient(100deg, transparent, ${t.shimmer}, transparent)`, left: '-60%' }}
          variants={{ rest: { x: 0, opacity: 0 }, hover: { x: '320%', opacity: 1, transition: { duration: 0.6, ease: 'easeInOut' } } }}
        />

        <motion.span
          className="relative flex"
          variants={spin ? undefined : variants}
          animate={spin ? { rotate: 360 } : undefined}
          transition={spin ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : undefined}
        >
          <Icon size={iconSize} strokeWidth={2.2} />
        </motion.span>
      </motion.button>

      {/* Count badge (e.g. active filters) */}
      <AnimatePresence>
        {badge > 0 && (
          <motion.span
            key={badge}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="pointer-events-none absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[8.5px] font-bold leading-none shadow"
            style={{ backgroundColor: '#ef4444', color: '#fff', boxShadow: '0 0 0 1.5px var(--ta-surface)' }}
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>

      <ToolbarTooltip show={hovered && !suppressTooltip} label={label} hint={hint} align={align} />
    </span>
  )
}

// ─── Segmented icon switch (List / Cards) ───────────────────────────────
// Same sliding accent pill as before, but icon-only with a tooltip per
// segment. `layoutId` must be unique per switch instance.
export function ToolbarIconSwitch({ options, value, onChange, layoutId, align = 'center' }) {
  const [hoveredId, setHoveredId] = useState(null)
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
      style={{ backgroundColor: 'var(--ta-bg)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)' }}
    >
      {options.map((opt, i) => {
        const active = value === opt.id
        const isLast = i === options.length - 1
        return (
          <span
            key={opt.id}
            className="relative flex"
            onPointerEnter={() => setHoveredId(opt.id)}
            onPointerLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(opt.id)}
            onBlur={() => setHoveredId(null)}
          >
            <motion.button
              type="button"
              aria-label={opt.label}
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.86 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="relative flex h-[22px] w-[24px] items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--ta-accent)]"
              style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-md"
                  style={{
                    background: 'linear-gradient(135deg, var(--ta-accent), color-mix(in srgb, var(--ta-accent) 72%, #000 28%))',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--ta-accent) 50%, transparent)',
                  }}
                />
              )}
              <motion.span
                className="relative flex"
                animate={active ? { scale: [0.6, 1.25, 1], rotate: [-20, 8, 0] } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
              >
                <opt.icon size={13} strokeWidth={2.2} />
              </motion.span>
            </motion.button>
            <ToolbarTooltip
              show={hoveredId === opt.id}
              label={opt.label}
              hint={active ? 'Currently selected' : opt.hint}
              align={align === 'end' && isLast ? 'end' : 'center'}
            />
          </span>
        )
      })}
    </div>
  )
}
