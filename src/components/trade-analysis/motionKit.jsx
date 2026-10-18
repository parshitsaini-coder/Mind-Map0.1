import { useEffect, useState } from 'react'
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion'
import { Check } from 'lucide-react'

// Shared motion primitives for the Trade Analysis popups (Download Report, Share trades).
// Defined at module level on purpose: components declared inside another component's
// render get a new identity each render and would remount (killing their animations).

export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }
export const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } } }
export const SPRING = { type: 'spring', stiffness: 520, damping: 32 }

// Counts smoothly to the new value whenever it changes.
export function AnimatedNumber({ value }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => Math.round(v))
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.5, ease: 'easeOut' })
    return () => c.stop()
  }, [value, mv])
  return <motion.span>{text}</motion.span>
}

// Button with a ripple under the pointer + spring hover/press.
export function Tap({ children, className = '', style, onClick, ripple = 'rgba(255,255,255,0.45)', hover = 1.03, disabled, ...rest }) {
  const [rings, setRings] = useState([])
  const down = (e) => {
    if (disabled) return
    const r = e.currentTarget.getBoundingClientRect()
    const id = Math.random()
    setRings((a) => [...a, { id, x: e.clientX - r.left, y: e.clientY - r.top, d: Math.max(r.width, r.height) * 2.2 }])
    setTimeout(() => setRings((a) => a.filter((x) => x.id !== id)), 650)
  }
  return (
    <motion.button
      type="button"
      onPointerDown={down}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: hover }}
      whileTap={disabled ? {} : { scale: 0.93 }}
      transition={SPRING}
      className={`relative flex items-center justify-center gap-1 overflow-hidden ${className}`}
      style={style}
      {...rest}
    >
      {rings.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none absolute rounded-full"
          style={{ left: r.x, top: r.y, width: r.d, height: r.d, marginLeft: -r.d / 2, marginTop: -r.d / 2, background: ripple }}
          initial={{ scale: 0, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
      <span className="contents">{children}</span>
    </motion.button>
  )
}

// Multi-select chip: fills with a spring, a check pops in.
export function Chip({ active, onClick, children, color = 'var(--ta-accent)' }) {
  return (
    <Tap
      onClick={onClick}
      hover={1.04}
      ripple="rgba(128,128,128,0.25)"
      className="rounded-lg border py-1.5 text-[10px] font-semibold"
      style={{ borderColor: active ? color : 'var(--ta-slate)', color: active ? '#fffcf2' : 'var(--ta-ink)' }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-[7px]"
        initial={false}
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.6 }}
        transition={SPRING}
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 72%, #000 28%))` }}
      />
      <span className="relative z-10 flex items-center gap-1">
        <AnimatePresence initial={false}>
          {active && (
            <motion.span initial={{ width: 0, opacity: 0, scale: 0 }} animate={{ width: 10, opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0 }} transition={SPRING} className="flex overflow-hidden">
              <Check size={10} strokeWidth={3.2} />
            </motion.span>
          )}
        </AnimatePresence>
        {children}
      </span>
    </Tap>
  )
}

export function SectionLabel({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--ta-slate)' }}>
        {Icon && <Icon size={10} style={{ color: 'var(--ta-accent)' }} />}
        {children}
      </span>
      {right}
    </div>
  )
}
