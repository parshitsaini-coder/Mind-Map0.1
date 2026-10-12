import { AnimatePresence, motion, useInView, animate as fmAnimate } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { EASE, NEG, NEUTRAL, POS, SPRING, fmtNum, signColor } from './format'

// Trade Analysis — pro Analysis tab shared UI.
//
// Everything here sizes off the --tad-* custom properties set by
// [data-ta-density] in index.css, so the Cozy/Compact/Dense switch in the
// toolbar genuinely re-flows every widget instead of only shrinking a
// couple of headings. No component in this folder hard-codes a font size
// or a padding value.
//
// Tokens and formatters live in ./format so this module exports components
// only, which is what React Fast Refresh needs.

// ---------------------------------------------------------------------
// CountUp — animates a number into view, replaying on each pass
// ---------------------------------------------------------------------

export function CountUp({ value, format = (v) => fmtNum(v, 0), duration = 0.9, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const numeric = Number(value)
  const isNum = Number.isFinite(numeric)
  const [display, setDisplay] = useState(isNum ? 0 : null)

  useEffect(() => {
    if (!inView || !isNum) return undefined
    const controls = fmAnimate(0, numeric, { duration, ease: EASE, onUpdate: setDisplay })
    return () => controls.stop()
  }, [inView, numeric, duration, isNum])

  if (!isNum) {
    return (
      <span ref={ref} className={`ta-num ${className}`}>
        {value == null ? '—' : value}
      </span>
    )
  }
  return (
    <span ref={ref} className={`ta-num ${className}`}>
      {format(display)}
    </span>
  )
}

// ---------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

export function Card({ children, className = '', delay = 0, span = '', onClick, flat = false }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      whileHover={flat ? undefined : { y: -3, transition: { duration: 0.2, ease: EASE } }}
      onClick={onClick}
      className={`ta-pro-card flex min-w-0 flex-col ${span} ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </motion.div>
  )
}

/**
 * Card header. `hint` renders an info dot with a native tooltip — used
 * everywhere a metric has a definition worth stating (profit factor,
 * Ulcer index, SQN) so the dashboard teaches as well as reports.
 */
export function CardHead({ icon: Icon, title, sub, hint, right, badge, badgeColor }) {
  return (
    <div className="mb-1.5 flex min-w-0 items-center gap-1">
      {Icon && <Icon size={11} className="shrink-0" style={{ color: 'var(--ta-accent)' }} />}
      <span
        className="min-w-0 truncate font-bold uppercase tracking-wide"
        style={{ fontSize: 'var(--tad-title)', color: 'var(--ta-ink)' }}
      >
        {title}
      </span>
      {hint && (
        <span title={hint} className="flex shrink-0 cursor-help items-center" style={{ color: 'var(--ta-slate)', opacity: 0.6 }}>
          <Info size={9} />
        </span>
      )}
      {badge != null && (
        <span
          className="shrink-0 rounded-full px-1 py-px font-bold text-white"
          style={{ fontSize: 'var(--tad-micro)', backgroundColor: badgeColor || 'var(--ta-accent)' }}
        >
          {badge}
        </span>
      )}
      {right && <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>}
      {!right && sub && (
        <span className="ml-auto shrink-0 truncate" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

export function SectionTitle({ icon: Icon, title, sub, count }) {
  return (
    <motion.div
      className="mb-1 mt-2 flex items-center gap-1.5 first:mt-0"
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.7 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {Icon && <Icon size={12} style={{ color: 'var(--ta-accent)' }} />}
      <span className="font-bold uppercase tracking-wider" style={{ fontSize: 'var(--tad-title)', color: 'var(--ta-ink)' }}>
        {title}
      </span>
      {count != null && (
        <span
          className="rounded-full px-1.5 py-px font-bold text-white"
          style={{ fontSize: 'var(--tad-micro)', backgroundColor: 'var(--ta-accent)' }}
        >
          {count}
        </span>
      )}
      <span className="h-px flex-1" style={{ backgroundColor: 'var(--tad-border)' }} />
      {sub && (
        <span className="shrink-0" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
          {sub}
        </span>
      )}
    </motion.div>
  )
}

export function Grid({ children, cols = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3', className = '' }) {
  return <div className={`grid ${cols} ${className}`} style={{ gap: 'var(--tad-gap)' }}>{children}</div>
}

// ---------------------------------------------------------------------
// Metric blocks
// ---------------------------------------------------------------------

/** A single labelled figure — the atom every KPI grid is built from. */
export function Metric({ label, value, sub, color, hint, format, raw, big = false, delay = 0 }) {
  const content =
    raw !== undefined ? (
      <CountUp value={raw} format={format || ((v) => fmtNum(v, 0))} />
    ) : (
      <span className="ta-num">{value ?? '—'}</span>
    )
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 0.34, delay, ease: EASE }}
      className="flex min-w-0 flex-col gap-px"
      title={hint}
    >
      <span
        className="truncate font-semibold uppercase tracking-wide"
        style={{ fontSize: 'var(--tad-label)', color: 'var(--ta-slate)' }}
      >
        {label}
      </span>
      <span
        className="truncate font-extrabold leading-tight"
        style={{ fontSize: big ? 'var(--tad-hero)' : 'var(--tad-value)', color: color || 'var(--ta-ink)' }}
      >
        {content}
      </span>
      {sub && (
        <span className="truncate" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)', opacity: 0.85 }}>
          {sub}
        </span>
      )}
    </motion.div>
  )
}

/** Compact key→value row used inside dense stat lists. */
export function StatRow({ label, value, color, hint, strong = false }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 py-px" title={hint}>
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-slate)' }}>
        {label}
      </span>
      <span
        className="ta-num shrink-0 tabular-nums"
        style={{
          fontSize: 'var(--tad-body)',
          fontWeight: strong ? 800 : 700,
          color: color || 'var(--ta-ink)',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

/** Small coloured pill — status, verdict, grade. */
export function Pill({ children, color = 'var(--ta-accent)', bg, icon: Icon, title, className = '' }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-bold ${className}`}
      style={{
        fontSize: 'var(--tad-micro)',
        color,
        backgroundColor: bg || `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {Icon && <Icon size={8} />}
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------

export function Bar({ pct, color = 'var(--ta-accent)', height, delay = 0, track = 'var(--ta-bg)', rounded = true }) {
  const safe = pct == null || !Number.isFinite(pct) ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div
      className={`w-full overflow-hidden ${rounded ? 'rounded-full' : 'rounded-sm'}`}
      style={{ backgroundColor: track, height: height || 5 }}
    >
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${safe}%` }}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ duration: 0.65, delay, ease: EASE }}
        className={`h-full ${rounded ? 'rounded-full' : 'rounded-sm'}`}
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

/** Label + bar + value in one row. The workhorse of the whole dashboard. */
export function BarRow({ label, pct, value, color = 'var(--ta-accent)', labelWidth = 62, valueWidth = 46, delay = 0, title }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      {label != null && (
        <span
          className="shrink-0 truncate font-medium"
          style={{ width: labelWidth, fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}
        >
          {label}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Bar pct={pct} color={color} delay={delay} />
      </div>
      {value != null && (
        <span
          className="ta-num shrink-0 text-right font-semibold"
          style={{ width: valueWidth, fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

/**
 * Diverging bar — negative values grow left from a centre line, positive
 * grow right. The only honest way to chart P&L, where sign is the point.
 */
export function DivergingBar({ value, maxAbs, label, display, height = 8, delay = 0 }) {
  const v = Number(value) || 0
  const max = Math.max(Math.abs(maxAbs) || 1, 1)
  const pct = Math.min(50, (Math.abs(v) / max) * 50)
  const positive = v > 0
  return (
    <div className="flex items-center gap-1.5">
      {label != null && (
        <span className="w-12 shrink-0 truncate" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
          {label}
        </span>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-sm" style={{ height, backgroundColor: 'var(--ta-bg)' }}>
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ backgroundColor: 'var(--tad-border-strong)' }} />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.6, delay, ease: EASE }}
          className="absolute inset-y-0"
          style={{
            backgroundColor: v === 0 ? NEUTRAL : positive ? POS : NEG,
            left: positive ? '50%' : undefined,
            right: positive ? undefined : '50%',
            borderRadius: positive ? '0 3px 3px 0' : '3px 0 0 3px',
          }}
        />
      </div>
      {display != null && (
        <span
          className="ta-num w-14 shrink-0 text-right font-semibold"
          style={{ fontSize: 'var(--tad-micro)', color: signColor(v) }}
        >
          {display}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------

export function Empty({ children, height = 52 }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg px-2 text-center italic"
      style={{
        minHeight: height,
        fontSize: 'var(--tad-micro)',
        color: 'var(--ta-slate)',
        backgroundColor: 'color-mix(in srgb, var(--ta-bg) 55%, transparent)',
        border: '1px dashed var(--tad-border)',
      }}
    >
      {children}
    </div>
  )
}

export function NeedsMore({ have, need, what = 'trades' }) {
  return (
    <Empty>
      {have} of {need} {what} — this needs {need - have} more before the number means anything.
    </Empty>
  )
}

// ---------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------

/** Segmented control with a spring-animated selection pill. */
export function Segmented({ options, value, onChange, size = 'sm', layoutId }) {
  // useId rather than a random string: the pill's layoutId must be stable
  // across renders or framer-motion animates it from nowhere each time.
  const autoId = useId()
  const id = layoutId || `seg-${autoId.replace(/:/g, '')}`
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
      style={{ backgroundColor: 'var(--ta-bg)', border: '1px solid var(--tad-border)' }}
    >
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <motion.button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={opt.title || opt.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            transition={SPRING}
            className="relative flex items-center gap-0.5 rounded-full font-semibold"
            style={{
              padding: size === 'xs' ? '1px 6px' : '2px 8px',
              fontSize: size === 'xs' ? 'var(--tad-micro)' : 'var(--tad-label)',
              color: active ? '#fffcf2' : 'var(--ta-ink)',
            }}
          >
            {active && (
              <motion.span
                layoutId={id}
                transition={SPRING}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            {opt.icon && (
              <span className="relative flex">
                <opt.icon size={size === 'xs' ? 8 : 9} />
              </span>
            )}
            <span className="relative whitespace-nowrap">{opt.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function MiniButton({ children, onClick, icon: Icon, active, disabled, title, tone = 'default' }) {
  const bg =
    tone === 'danger'
      ? 'rgba(220,38,38,0.12)'
      : active
        ? 'var(--ta-accent)'
        : 'var(--ta-bg)'
  const fg = tone === 'danger' ? NEG : active ? '#fffcf2' : 'var(--ta-ink)'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={disabled ? undefined : { scale: 1.05, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={SPRING}
      className="inline-flex shrink-0 items-center gap-1 rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        padding: '2.5px 7px',
        fontSize: 'var(--tad-label)',
        backgroundColor: bg,
        color: fg,
        border: '1px solid var(--tad-border)',
      }}
    >
      {Icon && <Icon size={9} />}
      {children}
    </motion.button>
  )
}

/** Labelled numeric input for the tool cards. */
export function Field({ label, value, onChange, placeholder, suffix, prefix, type = 'number', step, hint, disabled }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5" title={hint}>
      <span
        className="truncate font-semibold uppercase tracking-wide"
        style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
      >
        {label}
      </span>
      <div className="relative flex items-center">
        {prefix && (
          <span
            className="pointer-events-none absolute left-1.5 font-semibold"
            style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          step={step}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="ta-tool-input"
          style={{ paddingLeft: prefix ? 16 : undefined, paddingRight: suffix ? 20 : undefined }}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-1.5 font-semibold"
            style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

export function SelectField({ label, value, onChange, options, hint }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5" title={hint}>
      <span
        className="truncate font-semibold uppercase tracking-wide"
        style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
      >
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ta-tool-input" style={{ cursor: 'pointer' }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Inline error banner for a calculator with invalid inputs. */
export function ToolError({ children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={String(children)}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="rounded-md px-1.5 py-1"
        style={{
          fontSize: 'var(--tad-micro)',
          color: '#b45309',
          backgroundColor: 'rgba(217,119,6,0.12)',
          border: '1px solid rgba(217,119,6,0.3)',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Result strip under a calculator — the answer, made unmissable. */
export function ToolResult({ items, columns = 'grid-cols-2 sm:grid-cols-4' }) {
  return (
    <div
      className={`grid ${columns} rounded-lg`}
      style={{
        gap: 'var(--tad-gap)',
        padding: 'var(--tad-pad)',
        backgroundColor: 'color-mix(in srgb, var(--ta-accent) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--ta-accent) 25%, transparent)',
      }}
    >
      {items.map((it, i) => (
        <Metric
          key={it.label}
          label={it.label}
          value={it.value}
          raw={it.raw}
          format={it.format}
          sub={it.sub}
          color={it.color}
          hint={it.hint}
          big={it.big}
          delay={i * 0.03}
        />
      ))}
    </div>
  )
}

/**
 * Scroll container with a visible border, styled thin scrollbar, and a
 * fade at the bottom edge that disappears once you reach the end — so a
 * cut-off list always looks cut off rather than finished.
 */
export function ScrollBox({ children, maxHeight = 180, className = '', horizontal = false }) {
  const ref = useRef(null)
  const [atEnd, setAtEnd] = useState(true)
  const [scrollable, setScrollable] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const check = () => {
      const canScroll = horizontal ? el.scrollWidth > el.clientWidth + 2 : el.scrollHeight > el.clientHeight + 2
      setScrollable(canScroll)
      const end = horizontal
        ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 3
        : el.scrollTop + el.clientHeight >= el.scrollHeight - 3
      setAtEnd(end)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [horizontal, children])

  return (
    <div className="relative min-w-0">
      <div
        ref={ref}
        className={`ta-scroll ${horizontal ? 'ta-scroll-x' : 'overflow-y-auto'} ${className}`}
        style={horizontal ? undefined : { maxHeight }}
      >
        {children}
      </div>
      <AnimatePresence>
        {scrollable && !atEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute"
            style={
              horizontal
                ? {
                    top: 0, bottom: 0, right: 0, width: 26,
                    background: 'linear-gradient(to left, var(--ta-surface), transparent)',
                  }
                : {
                    left: 0, right: 0, bottom: 0, height: 20,
                    background: 'linear-gradient(to top, var(--ta-surface), transparent)',
                  }
            }
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Wraps a wide table/matrix so it scrolls sideways instead of clipping. */
export function TableScroll({ children, maxHeight = 240 }) {
  return (
    <div
      className="ta-scroll min-w-0 overflow-auto rounded-lg"
      style={{ maxHeight, border: '1px solid var(--tad-border)' }}
    >
      {children}
    </div>
  )
}

/** Verdict line — one plain-English sentence under a chart. */
export function Verdict({ children, tone = 'info' }) {
  const color = tone === 'good' ? POS : tone === 'bad' ? NEG : tone === 'warn' ? '#d97706' : 'var(--ta-slate)'
  if (!children) return null
  return (
    <motion.p
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-1 leading-snug"
      style={{ fontSize: 'var(--tad-micro)', color }}
    >
      {children}
    </motion.p>
  )
}
