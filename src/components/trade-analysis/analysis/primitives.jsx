import { motion } from 'framer-motion'

// Trade Analysis — Analysis tab shared primitives. Every widget component
// in this folder builds on these instead of hand-rolling its own card/bar/
// gauge markup, so the whole tab stays visually consistent and every color
// used traces back to the same handful of constants (see the master
// prompt's Design tokens section — no ad-hoc hex values in widget files).

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

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// Every card in the Analysis tab — same radius/border/surface treatment as
// the rest of the Trade Analysis feature (Table panel, form panel), plus a
// staggered fade-up mount so the tab doesn't feel like a static dump next
// to the Table view's animated rows (Step 16).
export function Card({ children, className = '', delay = 0, span = '' }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.22, delay, ease: 'easeOut' }}
      className={`rounded-2xl border p-3 shadow-sm ${span} ${className}`}
      style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', borderOpacity: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeader({ icon: Icon, title, subtitle, badge }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-1.5 first:mt-0">
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
    </div>
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
          animate={{ width: `${safePct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      {value != null && (
        <span className="w-9 shrink-0 text-right text-[9.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
          {value}
        </span>
      )}
    </div>
  )
}

// Small "N / N%" style number block used across KPI/Quick-Stats cards.
export function Stat({ label, value, sub, accent = false }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[15px] font-extrabold" style={{ color: accent ? 'var(--ta-accent)' : 'var(--ta-ink)' }}>
        {value}
      </span>
      <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
        {label}
      </span>
      {sub && (
        <span className="text-[7.5px]" style={{ color: 'var(--ta-slate)', opacity: 0.8 }}>
          {sub}
        </span>
      )}
    </div>
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
// chart library.
export function SemiGauge({ pct = 0, leftLabel = 'Sell', rightLabel = 'Buy' }) {
  const clamped = Math.max(-100, Math.min(100, pct || 0))
  const angle = ((clamped + 100) / 200) * 180 // 0..180deg across the arc
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
    <div className="flex flex-col items-center">
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
        <motion.circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill="var(--ta-ink)"
          initial={false}
          animate={{ cx: needleX, cy: needleY }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--ta-ink)" strokeWidth="2" />
      </svg>
      <div className="mt-0.5 flex w-full max-w-[220px] items-center justify-between text-[8.5px] font-bold uppercase" style={{ color: 'var(--ta-slate)' }}>
        <span>◀ {leftLabel}</span>
        <span>{clamped === 0 ? '0%' : `${clamped > 0 ? '+' : ''}${Math.round(clamped)}%`}</span>
        <span>{rightLabel} ▶</span>
      </div>
    </div>
  )
}

// Radial progress ring (Health score, Step 11). `pct` 0..100.
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
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[14px] font-extrabold leading-none" style={{ color: 'var(--ta-ink)' }}>
          {centerTop}
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
