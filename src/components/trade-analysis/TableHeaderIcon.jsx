import { motion } from 'framer-motion'
import { useState } from 'react'
import { ToolbarTooltip } from './ToolbarIconButton'

// Icon-only table column header. The column name lives in an animated
// tooltip that appears when the pointer (or keyboard focus) rests on the
// icon — same tooltip the top-bar icon buttons use, so the two feel alike.
//
// Each icon has its own hover "personality" and its own hue; on hover the
// badge fills with that hue, lifts, glows and a light sweeps across it.

const ICON_ANIM = {
  spin: { rest: { rotate: 0 }, hover: { rotate: 360, transition: { duration: 0.7, ease: 'easeInOut' } } },
  swing: { rest: { rotate: 0 }, hover: { rotate: [0, -18, 14, -8, 0], transition: { duration: 0.6 } } },
  bounce: { rest: { y: 0 }, hover: { y: [0, -3.5, 0, -1.5, 0], transition: { duration: 0.6 } } },
  pop: { rest: { scale: 1 }, hover: { scale: [1, 1.35, 1.15], transition: { duration: 0.4 } } },
  pulse: { rest: { scale: 1 }, hover: { scale: [1, 1.25, 1], transition: { duration: 0.8, repeat: Infinity } } },
  tilt: { rest: { rotate: 0, y: 0 }, hover: { rotate: -14, y: -1, transition: { type: 'spring', stiffness: 300, damping: 12 } } },
  stretch: { rest: { scaleY: 1 }, hover: { scaleY: [1, 1.3, 0.9, 1.15, 1], transition: { duration: 0.6 } } },
  flash: { rest: { scale: 1, rotate: 0 }, hover: { scale: [1, 0.8, 1.3, 1], rotate: [0, 0, 8, 0], transition: { duration: 0.45 } } },
  slide: { rest: { x: 0 }, hover: { x: [0, 3, -3, 0], transition: { duration: 0.5 } } },
}

export default function TableHeaderIcon({ icon: Icon, label, hue = '#eb5e28', anim = 'pop', align = 'center', index = 0 }) {
  const [hovered, setHovered] = useState(false)
  const variants = ICON_ANIM[anim] ?? ICON_ANIM.pop

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <motion.span
        tabIndex={0}
        role="img"
        aria-label={label}
        // pop-in on mount, staggered left → right
        initial={{ opacity: 0, scale: 0.4, y: 6 }}
        animate="rest"
        whileHover="hover"
        whileTap={{ scale: 0.9 }}
        variants={{
          rest: {
            opacity: 1,
            scale: 1,
            y: 0,
            backgroundColor: `color-mix(in srgb, ${hue} 14%, transparent)`,
            color: hue,
            boxShadow: `0 0 0 1px color-mix(in srgb, ${hue} 28%, transparent)`,
            transition: { type: 'spring', stiffness: 420, damping: 22, delay: Math.min(index, 14) * 0.035 },
          },
          hover: {
            scale: 1.14,
            y: -2,
            backgroundColor: hue,
            color: '#ffffff',
            boxShadow: `0 6px 16px color-mix(in srgb, ${hue} 55%, transparent), 0 0 0 1px ${hue}`,
            transition: { type: 'spring', stiffness: 460, damping: 20 },
          },
        }}
        className="relative flex h-6 w-6 cursor-default items-center justify-center overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ta-accent)]"
      >
        {/* light sweep */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/2"
          style={{ left: '-60%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.6), transparent)' }}
          variants={{ rest: { x: 0, opacity: 0 }, hover: { x: '320%', opacity: 1, transition: { duration: 0.55, ease: 'easeInOut' } } }}
        />
        <motion.span className="relative flex" variants={variants}>
          <Icon size={13} strokeWidth={2.3} />
        </motion.span>
      </motion.span>

      <ToolbarTooltip show={hovered} label={label} align={align} />
    </span>
  )
}
