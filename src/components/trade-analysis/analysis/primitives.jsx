import { useEffect, useRef, useState } from 'react'
import { motion, useInView, animate as fmAnimate } from 'framer-motion'

// Trade Analysis — Analysis tab shared primitives. Every widget component
// in this folder builds on these instead of hand-rolling its own card/bar/
// gauge markup, so the whole tab stays visually consistent and every color
// used traces back to the same handful of constants (see the master
// prompt's Design tokens section — no ad-hoc hex values in widget files).
//
// Motion system: every card, bar, ring and number in this tab is
// scroll-driven (`whileInView` + `viewport={{ once: false }}`) instead of
// mount-only — widgets replay their reveal animation every time they cross
// back into view, so scrolling up and down keeps the tab feeling alive.

const EASE = [0.16, 1, 0.3, 1]

// Same status tint palette as StatusDropdown.jsx / TradesTable.jsx, kept
// here so every analysis widget references one source instead of
// duplicating magic rgba strings.
export const STATUS_COLOR = {
  Pending: { solid: '#eb5e28', bg: 'rgba(235,94,40,0.14)', text: 'var(--ta-accent)' },
  'Target Hit': { solid: '#5f8a52', bg: 'rgba(95,138,82,0.16)', text: '#4c6f42' },
  'SL Hit': { solid: '#b3503a', bg: 'rgba(179,80,58,0.16)', text: '#9c4a34' },
}

// Same Buy/Sell colors as the Direction badge in TradesTable.jsx.
export const DIRECTION_COLOR = {
  Buy: '#16a34a',
  Sell: '#dc2626',
}

// Counts up from 0 to `value` every time it scrolls into view (not just on
// mount) — `once: false` on the viewport means scrolling the widget out and
// back in replays the count. Accepts a raw number, a formatted string like
// "82%" (the trailing % is auto-detected and re-applied), or a raw number
// plus a custom `formatter` (e.g. money with commas/sign) for exact output.
export function CountUp({ value, decimals = 0, prefix = '', suffix, duration = 1.1, formatter }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.6 })
  const trimmed = typeof value === 'string' ? value.trim() : value
  const autoSuffix = typeof trimmed === 'string' && trimmed.endsWith('%') ? '%' : ''
  const finalSuffix = suffix ?? autoSuffix
  const numeric = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''))
  const isNumeric = Number.isFinite(numeric)
  const [display, setDisplay] = useState(isNumeric ? 0 : null)

  useEffect(() => {
    if (!isInView || !isNumeric) return
    const controls = fmAnimate(0, numeric, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [isInView, numeric, duration, isNumeric])

  if (!isNumeric) return <span ref={ref}>{value}</span>

  const text = formatter ? formatter(display) : `${prefix}${display.toFixed(decimals)}${finalSuffix}`
  return <span ref={ref}>{text}</span>
}

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

// Every card in the Analysis tab — same radius/border/surface treatment as
// the rest of the Trade Analysis feature (Table panel, form panel), plus a
// scroll-triggered fade/scale-up reveal that replays on every pass through
// the viewport, and a gentle hover lift for a pro, tactile feel.
export function Card({ children, className = '', delay = 0, span = '' }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.25 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={{ y: -4, scale: 1.015, transition: { duration: 0.25, ease: EASE } }}
      className={`rounded-2xl border p-3 shadow-sm ${span} ${className}`}
      style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', borderOpacity: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeader({ icon: Icon, title, subtitle, badge }) {
  return (
    <motion.div
      className="mb-2 mt-5 flex items-center gap-1.5 first:mt-0"
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.8 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {Icon && <Icon size={12} style={{ color: 'var(--ta-accent)' }} />}
      <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-ink)' }}>
        {title}
      </span>
      {badge != null && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold text-white"
          style={{ backgroundColor: 'var(--ta-accent)' }}
        >
          {badge}
        </span>
      )}
      {subtitle && (
        <span className="ml-auto text-[9px]" style={{ color: 'var(--ta-slate)' }}>
          {subtitle}
        </span>
      )}
    </motion.div>
  )
}

export function CardTitle({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="mb-2 flex items-center gap-1">
      {Icon && <Icon size={10.5} style={{ color: 'var(--ta-slate)' }} />}
      <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-ink)' }}>
        {title}
      </span>
      {badge != null && (
        <span
          className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
          style={{ backgroundColor: '#9c4a34' }}
        >
          {badge}
        </span>
      )}
      {subtitle && (
        <span className="ml-auto text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>
          {subtitle}
        </span>
      )}
    </div>
  )
}

// A responsive grid wrapper — pass a Tailwind col count string per
// breakpoint via `cols` (default: 1 col mobile, up to 3 on wider layouts).
export function Grid({ children, cols = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' }) {
  return <div className={`grid gap-2 ${cols}`}>{children}</div>
}

// Horizontal bar row: label, a track filled to `pct` of `--ta-accent`
// (or a custom `color`), and a right-aligned value. Used by ~10 widgets.
// The fill replays every time it scrolls into view; the value counts up.
export function HBar({ label, pct, value, color = 'var(--ta-accent)', height = 6 }) {
  const safePct = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-2">
      {label != null && (
        <span className="w-16 shrink-0 truncate text-[9.5px] font-medium" style={{ color: 'var(--ta-ink)' }}>
          {label}
        </span>
      )}
      <div className="h-full flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)', height }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${safePct}%` }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      {value != null && (
        <span className="w-9 shrink-0 text-right text-[9.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
          <CountUp value={value} />
        </span>
      )}
    </div>
  )
}

// Generic scroll-triggered fill bar for the handful of widgets that build
// their own bar markup (funnel rows, R:R split, age buckets, confidence
// strength) instead of using HBar. Pass `children` to render text centered
// inside the fill (e.g. a percentage badge).
export function AnimatedBar({ pct, color = 'var(--ta-accent)', height = 8, rounded = true, delay = 0, children, trackClassName = '' }) {
  const safePct = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div
      className={`overflow-hidden ${rounded ? 'rounded-full' : ''} ${trackClassName}`}
      style={{ backgroundColor: 'var(--ta-bg)', height }}
    >
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${safePct}%` }}
        viewport={{ once: false, amount: 0.5 }}
        transition={{ duration: 0.75, delay, ease: EASE }}
        className={`flex h-full items-center justify-center ${rounded ? 'rounded-full' : ''}`}
        style={{ backgroundColor: color }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// Small "N / N%" style number block used across KPI/Quick-Stats cards.
// The number itself counts up and pops in with a scroll-triggered scale.
export function Stat({ label, value, sub, accent = false, formatter }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-0.5 text-center"
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, amount: 0.6 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="text-[15px] font-extrabold" style={{ color: accent ? 'var(--ta-accent)' : 'var(--ta-ink)' }}>
        <CountUp value={value} formatter={formatter} />
      </span>
      <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
        {label}
      </span>
      {sub && (
        <span className="text-[7.5px]" style={{ color: 'var(--ta-slate)', opacity: 0.8 }}>
          {sub}
        </span>
      )}
    </motion.div>
  )
}

export function fmtPct(v, digits = 0) {
  return v == null ? '—' : `${v.toFixed(digits)}%`
}

// Placeholder shown inside a card body when there isn't enough data for
// that specific widget yet (Step 16) — keeps every card's shell/header
// visible so the tab doesn't jump around as data starts to arrive.
export function EmptyHint({ children }) {
  return (
    <div className="flex h-16 items-center justify-center text-center text-[9.5px] italic" style={{ color: 'var(--ta-slate)' }}>
      {children}
    </div>
  )
}

// Whole-tab empty state — shown instead of every widget when there are no
// trades logged at all yet.
export function EmptyTab({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-20 text-center">
      {Icon && <Icon size={28} style={{ color: 'var(--ta-slate)', opacity: 0.5 }} />}
      <span className="text-[12px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
        {title}
      </span>
      {subtitle && (
        <span className="max-w-[260px] text-[10px]" style={{ color: 'var(--ta-slate)' }}>
          {subtitle}
        </span>
      )}
    </div>
  )
}

// Semicircle "bear/bull"-style gauge (Market Bias, Step 11). `pct` is
// -100..100; needle position and arc split derive from it. Pure SVG, no
// chart library. The needle sweeps from the Sell rest position every time
// the gauge scrolls into view.
export function SemiGauge({ pct = 0, leftLabel = 'Sell', rightLabel = 'Buy' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: false, amount: 0.5 })
  const clamped = Math.max(-100, Math.min(100, pct || 0))
  const targetAngle = ((clamped + 100) / 200) * 180 // 0..180deg across the arc
  const angle = isInView ? targetAngle : 0
  const rad = (Math.PI * angle) / 180
  const cx = 90
  const cy = 78
  const r = 66
  const needleX = cx - r * Math.cos(rad)
  const needleY = cy - r * Math.sin(rad)

  const arcPoint = (deg) => {
    const a = (Math.PI * deg) / 180
    return [cx - r * Math.cos(a), cy - r * Math.sin(a)]
  }
  const [sx, sy] = arcPoint(0)
  const [ex, ey] = arcPoint(180)

  return (
    <div ref={ref} className="flex flex-col items-center">
      <svg viewBox="0 0 180 92" className="w-full max-w-[220px]">
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          fill="none"
          stroke="var(--ta-bg)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          fill="none"
          stroke="url(#biasGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity={0.85}
        />
        <defs>
          <linearGradient id="biasGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={DIRECTION_COLOR.Sell} />
            <stop offset="50%" stopColor="var(--ta-slate)" />
            <stop offset="100%" stopColor={DIRECTION_COLOR.Buy} />
          </linearGradient>
        </defs>
        <motion.line
          x1={cx}
          y1={cy}
          animate={{ x2: needleX, y2: needleY }}
          transition={{ type: 'spring', stiffness: 90, damping: 15 }}
          stroke="var(--ta-ink)"
          strokeWidth="2"
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill="var(--ta-ink)"
          animate={{ cx: needleX, cy: needleY }}
          transition={{ type: 'spring', stiffness: 90, damping: 15 }}
        />
      </svg>
      <div className="mt-0.5 flex w-full max-w-[220px] items-center justify-between text-[8.5px] font-bold uppercase" style={{ color: 'var(--ta-slate)' }}>
        <span>◀ {leftLabel}</span>
        <span>
          {clamped === 0 ? '0%' : (
            <CountUp value={clamped} formatter={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`} />
          )}
        </span>
        <span>{rightLabel} ▶</span>
      </div>
    </div>
  )
}

// Radial progress ring (Health score, Step 11). `pct` 0..100. The ring
// sweeps in and the center number counts up every time it scrolls into
// view.
export function RingGauge({ pct = 0, size = 64, stroke = 7, centerTop, centerBottom }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ta-bg)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ta-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c - (clamped / 100) * c }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.85, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[14px] font-extrabold leading-none" style={{ color: 'var(--ta-ink)' }}>
          <CountUp value={centerTop} />
        </span>
        {centerBottom && (
          <span className="text-[7px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
            {centerBottom}
          </span>
        )}
      </div>
    </div>
  )
}
