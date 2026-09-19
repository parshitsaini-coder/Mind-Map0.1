import { motion, useInView } from 'framer-motion'
import { useId, useMemo, useRef, useState } from 'react'
import { EASE, NEG, POS, fmtNum, signColor } from './format'

// Trade Analysis — SVG chart primitives.
//
// Hand-built rather than pulled from a chart library, for three reasons:
// the whole tab runs on --ta-* theme variables that a library would fight,
// every chart here needs a scroll-triggered reveal that replays, and
// adding a charting dependency for a dozen small widgets would cost more
// bundle weight than the entire Analysis tab.
//
// Every chart takes already-computed data. None of them derive anything —
// if a chart looks wrong, the bug is in utils/, not here.

const PAD = { l: 4, r: 4, t: 6, b: 4 }

/** Maps a value range onto a pixel range, guarding a zero-width domain. */
function scaler(min, max, from, to) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const mid = (from + to) / 2
    return () => mid
  }
  return (v) => from + ((v - min) / (max - min)) * (to - from)
}

/** Catmull-Rom → cubic Bézier. Smooths a polyline without overshooting. */
function smoothPath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

// ---------------------------------------------------------------------
// Equity curve — line + area fill + high-water mark + hover readout
// ---------------------------------------------------------------------

/**
 * `points` is the array from getEquityCurve(): { index, equity, peak,
 * drawdown, date, trade }. Shows the running balance against its own
 * high-water mark, with the area under water tinted red.
 */
export function EquityCurve({ points, height, symbol = '', showPeak = true, showDrawdown = true, formatValue }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.25 })
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState(null)

  const W = 320
  const H = 100

  const geom = useMemo(() => {
    if (!points || points.length < 2) return null
    const equities = points.map((p) => p.equity)
    const peaks = points.map((p) => p.peak)
    const lo = Math.min(...equities, 0)
    const hi = Math.max(...peaks, 0)
    const pad = (hi - lo) * 0.08 || 1
    const x = scaler(0, points.length - 1, PAD.l, W - PAD.r)
    const y = scaler(lo - pad, hi + pad, H - PAD.b, PAD.t)
    const line = points.map((p, i) => [x(i), y(p.equity)])
    const peakLine = points.map((p, i) => [x(i), y(p.peak)])
    return { x, y, line, peakLine, zeroY: y(0), lo, hi }
  }, [points])

  if (!geom) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center italic"
        style={{ height: height || 'var(--tad-chart-h)', fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
      >
        Two or more trades with a P&amp;L are needed to draw a curve.
      </div>
    )
  }

  const path = smoothPath(geom.line)
  const areaPath = `${path} L ${geom.line[geom.line.length - 1][0]} ${geom.zeroY} L ${geom.line[0][0]} ${geom.zeroY} Z`
  const last = points[points.length - 1]
  const positive = last.equity >= 0

  const onMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const rel = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((rel - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1))
    const clamped = Math.max(0, Math.min(points.length - 1, idx))
    setHover({ ...points[clamped], i: clamped })
  }

  const fmt = formatValue || ((v) => `${v < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(v)).toLocaleString('en-IN')}`)

  return (
    <div ref={ref} className="relative w-full" style={{ height: height || 'var(--tad-chart-h)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`eq-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={positive ? POS : NEG} stopOpacity="0.34" />
            <stop offset="100%" stopColor={positive ? POS : NEG} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Break-even line — the only gridline that carries meaning here. */}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={geom.zeroY}
          y2={geom.zeroY}
          stroke="var(--tad-border-strong)"
          strokeWidth="0.7"
          strokeDasharray="3 3"
        />

        {showDrawdown && (
          <motion.path
            d={areaPath}
            fill={`url(#eq-${gid})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
          />
        )}

        {showPeak && (
          <motion.path
            d={smoothPath(geom.peakLine)}
            fill="none"
            stroke="var(--ta-slate)"
            strokeWidth="0.8"
            strokeDasharray="2.5 2.5"
            opacity={0.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        )}

        <motion.path
          d={path}
          fill="none"
          stroke={positive ? POS : NEG}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.05, ease: EASE }}
        />

        {hover && (
          <g>
            <line
              x1={geom.x(hover.i)}
              x2={geom.x(hover.i)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="var(--ta-accent)"
              strokeWidth="0.7"
              opacity={0.6}
            />
            <circle cx={geom.x(hover.i)} cy={geom.y(hover.equity)} r="2.6" fill="var(--ta-accent)" stroke="var(--ta-surface)" strokeWidth="1" />
          </g>
        )}
      </svg>

      {/* Readout floats above the chart rather than inside the SVG so its
          text never inherits the non-uniform preserveAspectRatio scale. */}
      <div className="pointer-events-none absolute left-0 top-0 flex w-full items-start justify-between px-0.5">
        <span
          className="ta-num rounded px-1 font-bold"
          style={{ fontSize: 'var(--tad-micro)', color: signColor(last.equity), backgroundColor: 'color-mix(in srgb, var(--ta-surface) 80%, transparent)' }}
        >
          {fmt(last.equity)}
        </span>
        {hover && (
          <span
            className="ta-num rounded px-1 text-right font-semibold"
            style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-ink)', backgroundColor: 'color-mix(in srgb, var(--ta-surface) 88%, transparent)' }}
          >
            #{hover.index} · {fmt(hover.equity)}
            {hover.drawdown < 0 ? ` · dd ${fmt(hover.drawdown)}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Underwater (drawdown) chart
// ---------------------------------------------------------------------

export function UnderwaterChart({ points, height, symbol = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.3 })
  const gid = useId().replace(/:/g, '')
  const W = 320
  const H = 70

  if (!points || points.length < 2) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center italic"
        style={{ height: height || 72, fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
      >
        Not enough trades to map time spent under water.
      </div>
    )
  }

  const draws = points.map((p) => p.drawdown) // all <= 0
  const worst = Math.min(...draws, -1)
  const x = scaler(0, points.length - 1, PAD.l, W - PAD.r)
  const y = scaler(worst, 0, H - PAD.b, PAD.t)
  const line = points.map((p, i) => [x(i), y(p.drawdown)])
  const path = smoothPath(line)
  const area = `${path} L ${line[line.length - 1][0]} ${y(0)} L ${line[0][0]} ${y(0)} Z`

  return (
    <div ref={ref} className="w-full" style={{ height: height || 72 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`uw-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEG} stopOpacity="0.08" />
            <stop offset="100%" stopColor={NEG} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--tad-border-strong)" strokeWidth="0.7" />
        <motion.path
          d={area}
          fill={`url(#uw-${gid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke={NEG}
          strokeWidth="1.2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="flex justify-between px-0.5" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        <span>Worst: <span className="ta-num" style={{ color: NEG }}>{symbol}{Math.abs(Math.round(worst)).toLocaleString('en-IN')}</span></span>
        <span>{points.filter((p) => p.drawdown < 0).length} of {points.length - 1} trades under water</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Column chart — signed bars with optional labels
// ---------------------------------------------------------------------

export function ColumnChart({ data, height, symbol = '', signed = true, valueKey = 'value', labelKey = 'label', color, compact = true }) {
  const ref = useRef(null)
  const rows = data || []
  if (!rows.length) {
    return (
      <div ref={ref} className="flex items-center justify-center italic" style={{ height: height || 'var(--tad-chart-h)', fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        Nothing to chart yet.
      </div>
    )
  }

  const values = rows.map((r) => Number(r[valueKey]) || 0)
  const maxAbs = Math.max(...values.map(Math.abs), 1)
  const hasNegative = signed && values.some((v) => v < 0)

  const fmt = (v) => {
    if (!symbol) return fmtNum(v, 0)
    const abs = Math.abs(v)
    const body = compact && abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : Math.round(abs).toLocaleString('en-IN')
    return `${v < 0 ? '-' : ''}${symbol}${body}`
  }

  return (
    <div ref={ref} className="flex w-full flex-col" style={{ height: height || 'var(--tad-chart-h)' }}>
      <div className="flex min-h-0 flex-1 items-stretch gap-[2px]">
        {rows.map((row, i) => {
          const v = Number(row[valueKey]) || 0
          const pct = (Math.abs(v) / maxAbs) * 100
          const positive = v >= 0
          const barColor = color || (signed ? (v === 0 ? 'var(--ta-slate)' : positive ? POS : NEG) : 'var(--ta-accent)')
          return (
            <div key={row.key || row[labelKey] || i} className="flex min-w-0 flex-1 flex-col" title={`${row[labelKey]}: ${fmt(v)}`}>
              <div className={`flex min-h-0 flex-1 flex-col ${hasNegative ? '' : 'justify-end'}`}>
                {hasNegative && (
                  <div className="flex flex-1 items-end">
                    {positive && (
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${pct}%` }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.55, delay: i * 0.02, ease: EASE }}
                        className="w-full rounded-t-[2px]"
                        style={{ backgroundColor: barColor }}
                      />
                    )}
                  </div>
                )}
                {!hasNegative && (
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${pct}%` }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 0.55, delay: i * 0.02, ease: EASE }}
                    className="w-full rounded-t-[2px]"
                    style={{ backgroundColor: barColor }}
                  />
                )}
                {hasNegative && (
                  <>
                    <div className="h-px w-full shrink-0" style={{ backgroundColor: 'var(--tad-border-strong)' }} />
                    <div className="flex flex-1 items-start">
                      {!positive && (
                        <motion.div
                          initial={{ height: 0 }}
                          whileInView={{ height: `${pct}%` }}
                          viewport={{ once: false, amount: 0.3 }}
                          transition={{ duration: 0.55, delay: i * 0.02, ease: EASE }}
                          className="w-full rounded-b-[2px]"
                          style={{ backgroundColor: barColor }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-0.5 flex gap-[2px]">
        {rows.map((row, i) => (
          <span
            key={row.key || row[labelKey] || i}
            className="min-w-0 flex-1 truncate text-center"
            style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}
          >
            {row[labelKey]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------

export function Histogram({ bins, symbol = '', height, highlightZero = true }) {
  if (!bins || !bins.length) {
    return (
      <div className="flex items-center justify-center italic" style={{ height: height || 90, fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        Not enough results to shape a distribution.
      </div>
    )
  }
  const max = Math.max(...bins.map((b) => b.count), 1)
  return (
    <div className="w-full">
      <div className="flex items-end gap-[2px]" style={{ height: height || 90 }}>
        {bins.map((b, i) => {
          const isLoss = b.mid < 0
          return (
            <div
              key={`${b.from}-${i}`}
              className="flex min-w-0 flex-1 items-end"
              style={{ height: '100%' }}
              title={`${symbol}${Math.round(b.from).toLocaleString('en-IN')} to ${symbol}${Math.round(b.to).toLocaleString('en-IN')}: ${b.count} trade${b.count === 1 ? '' : 's'}`}
            >
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${(b.count / max) * 100}%` }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.025, ease: EASE }}
                className="w-full rounded-t-[2px]"
                style={{ backgroundColor: highlightZero ? (isLoss ? NEG : POS) : 'var(--ta-accent)', minHeight: b.count ? 2 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-0.5 flex justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        <span className="ta-num">{symbol}{Math.round(bins[0].from).toLocaleString('en-IN')}</span>
        <span className="ta-num">{symbol}{Math.round(bins[bins.length - 1].to).toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------

export function Donut({ segments, size = 68, stroke = 9, centerTop, centerBottom, centerColor }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const total = segments.reduce((a, s) => a + (s.value || 0), 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  // Each arc starts where the previous one ended, so the offsets are a
  // running total. Built with reduce rather than a mutated counter to keep
  // the render pure.
  const arcs = segments
    .filter((s) => s.value > 0)
    .reduce((acc, s) => {
      const dash = (total ? s.value / total : 0) * c
      const previous = acc[acc.length - 1]
      const offset = previous ? previous.offset + previous.dash : 0
      acc.push({ ...s, dash, offset })
      return acc
    }, [])

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ta-bg)" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <motion.circle
            key={a.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${c - a.dash}`}
            initial={{ strokeDashoffset: -a.offset, opacity: 0 }}
            animate={{ strokeDashoffset: -a.offset, opacity: inView ? 1 : 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
          >
            <title>{`${a.label}: ${a.value}`}</title>
          </motion.circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="ta-num font-extrabold leading-none" style={{ fontSize: 'var(--tad-value)', color: centerColor || 'var(--ta-ink)' }}>
          {centerTop}
        </span>
        {centerBottom && (
          <span className="font-semibold" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            {centerBottom}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Radial gauge
// ---------------------------------------------------------------------

export function Gauge({ pct, size = 66, stroke = 7, centerTop, centerBottom, color = 'var(--ta-accent)' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct || 0))
  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ta-bg)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - (clamped / 100) * c : c }}
          transition={{ duration: 0.85, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="ta-num font-extrabold leading-none" style={{ fontSize: 'var(--tad-value)', color: 'var(--ta-ink)' }}>
          {centerTop}
        </span>
        {centerBottom && (
          <span className="font-semibold" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            {centerBottom}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------

export function Sparkline({ values, height = 26, color, showArea = true, baseline = null }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.4 })
  const gid = useId().replace(/:/g, '')
  const W = 100
  const H = 28

  if (!values || values.length < 2) return <div ref={ref} style={{ height }} />

  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = scaler(0, values.length - 1, 1, W - 1)
  const y = scaler(lo, hi, H - 2, 2)
  const pts = values.map((v, i) => [x(i), y(v)])
  const path = smoothPath(pts)
  const trendUp = values[values.length - 1] >= values[0]
  const stroke = color || (trendUp ? POS : NEG)
  const baseY = baseline != null && baseline >= lo && baseline <= hi ? y(baseline) : null

  return (
    <div ref={ref} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {baseY != null && (
          <line x1="0" x2={W} y1={baseY} y2={baseY} stroke="var(--tad-border-strong)" strokeWidth="0.6" strokeDasharray="2 2" />
        )}
        {showArea && (
          <motion.path
            d={`${path} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`}
            fill={`url(#sp-${gid})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          />
        )}
        <motion.path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------
// Heatmap grid
// ---------------------------------------------------------------------

/**
 * Generic cell grid. `cells` is a 2-D array; `valueOf` extracts the number
 * that drives the tint, `render` supplies the cell's text. Diverging mode
 * colours negatives red and positives green from a shared midpoint.
 */
export function HeatGrid({ rows, columns, cells, valueOf, render, title, diverging = true, cellMin = 26 }) {
  const values = cells.flat().map(valueOf).filter((v) => v != null && Number.isFinite(v))
  const maxAbs = values.length ? Math.max(...values.map(Math.abs), 1) : 1
  const max = values.length ? Math.max(...values, 1) : 1

  const tint = (v) => {
    if (v == null || !Number.isFinite(v) || v === 0) return 'var(--ta-bg)'
    if (diverging) {
      const intensity = Math.min(1, Math.abs(v) / maxAbs)
      const base = v > 0 ? '22,163,74' : '220,38,38'
      return `rgba(${base},${0.12 + intensity * 0.62})`
    }
    const intensity = Math.min(1, v / max)
    return `color-mix(in srgb, var(--ta-accent) ${Math.round(12 + intensity * 70)}%, transparent)`
  }

  return (
    <div className="ta-scroll ta-scroll-x min-w-0">
      <table className="ta-table" style={{ minWidth: columns.length * cellMin + 70 }}>
        <thead>
          <tr>
            <th style={{ minWidth: 62 }}>{title || ''}</th>
            {columns.map((c) => (
              <th key={c} className="text-center" style={{ minWidth: cellMin }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rowLabel, ri) => (
            <tr key={rowLabel}>
              <td className="truncate font-semibold" style={{ maxWidth: 72 }} title={rowLabel}>
                {rowLabel}
              </td>
              {columns.map((c, ci) => {
                const cell = cells[ri]?.[ci]
                const v = cell ? valueOf(cell) : null
                return (
                  <motion.td
                    key={c}
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: false, amount: 0.2 }}
                    transition={{ duration: 0.3, delay: (ri * columns.length + ci) * 0.008, ease: EASE }}
                    whileHover={{ scale: 1.12, zIndex: 2 }}
                    className="ta-num text-center font-semibold"
                    style={{ backgroundColor: tint(v) }}
                    title={cell ? render(cell, true) : undefined}
                  >
                    {cell ? render(cell, false) : '·'}
                  </motion.td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------
// Box plot
// ---------------------------------------------------------------------

export function BoxPlot({ box, symbol = '', height = 44 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.4 })
  if (!box) {
    return (
      <div className="flex items-center justify-center italic" style={{ height, fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        Four or more results are needed for quartiles.
      </div>
    )
  }
  const W = 320
  const lo = Math.min(box.min, box.lowerFence)
  const hi = Math.max(box.max, box.upperFence)
  const x = scaler(lo, hi, 6, W - 6)
  const mid = height / 2
  const boxH = height * 0.44

  const money = (v) => `${v < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(v)).toLocaleString('en-IN')}`

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {/* Whiskers */}
        <motion.line
          x1={x(box.min)} x2={x(box.max)} y1={mid} y2={mid}
          stroke="var(--ta-slate)" strokeWidth="1"
          initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }}
        />
        <line x1={x(box.min)} x2={x(box.min)} y1={mid - 6} y2={mid + 6} stroke="var(--ta-slate)" strokeWidth="1" />
        <line x1={x(box.max)} x2={x(box.max)} y1={mid - 6} y2={mid + 6} stroke="var(--ta-slate)" strokeWidth="1" />
        {/* Zero reference */}
        {lo < 0 && hi > 0 && (
          <line x1={x(0)} x2={x(0)} y1={2} y2={height - 2} stroke="var(--tad-border-strong)" strokeWidth="0.8" strokeDasharray="2 2" />
        )}
        {/* IQR box */}
        <motion.rect
          x={x(box.q1)}
          y={mid - boxH / 2}
          width={Math.max(2, x(box.q3) - x(box.q1))}
          height={boxH}
          rx="2"
          fill="color-mix(in srgb, var(--ta-accent) 22%, transparent)"
          stroke="var(--ta-accent)"
          strokeWidth="1"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: inView ? 1 : 0 }}
          style={{ transformOrigin: `${x(box.median)}px center` }}
          transition={{ duration: 0.55, delay: 0.2, ease: EASE }}
        />
        {/* Median */}
        <line x1={x(box.median)} x2={x(box.median)} y1={mid - boxH / 2} y2={mid + boxH / 2} stroke="var(--ta-ink)" strokeWidth="1.6" />
      </svg>
      <div className="flex justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        <span className="ta-num">{money(box.min)}</span>
        <span className="ta-num font-semibold" style={{ color: 'var(--ta-ink)' }}>med {money(box.median)}</span>
        <span className="ta-num">{money(box.max)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Monte Carlo fan chart
// ---------------------------------------------------------------------

/**
 * Draws the sampled simulation paths faintly behind the median path, with
 * the actual result overlaid so "where did I land inside my own
 * distribution" is answerable at a glance.
 */
export function FanChart({ paths, median, actual, symbol = '', height, startValue = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.25 })
  const W = 320
  const H = 100

  if (!paths || !paths.length) {
    return (
      <div ref={ref} className="flex items-center justify-center italic" style={{ height: height || 'var(--tad-chart-h)', fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        Run the simulation to see the outcome range.
      </div>
    )
  }

  const steps = Math.max(...paths.map((p) => p.length))
  const all = paths.flat()
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const x = scaler(0, steps - 1, PAD.l, W - PAD.r)
  const y = scaler(lo, hi, H - PAD.b, PAD.t)

  const toPath = (p) => p.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const money = (v) => {
    const abs = Math.abs(v)
    const body = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : Math.round(abs).toLocaleString('en-IN')
    return `${v < 0 ? '-' : ''}${symbol}${body}`
  }

  return (
    <div ref={ref} className="w-full" style={{ height: height || 'var(--tad-chart-h)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        {startValue >= lo && startValue <= hi && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(startValue)} y2={y(startValue)} stroke="var(--tad-border-strong)" strokeWidth="0.7" strokeDasharray="3 3" />
        )}
        {paths.map((p, i) => (
          <motion.path
            key={i}
            d={toPath(p)}
            fill="none"
            stroke={p[p.length - 1] >= startValue ? POS : NEG}
            strokeWidth="0.6"
            opacity={0.18}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: 0.9, delay: i * 0.012, ease: EASE }}
          />
        ))}
        {median != null && median >= lo && median <= hi && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(median)} y2={y(median)} stroke="var(--ta-accent)" strokeWidth="1.3" />
        )}
        {actual != null && actual >= lo && actual <= hi && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(actual)} y2={y(actual)} stroke="var(--ta-ink)" strokeWidth="1.1" strokeDasharray="4 2" />
        )}
      </svg>
      <div className="flex flex-wrap justify-between gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: 'var(--ta-accent)' }} />
          Median {median != null && <span className="ta-num font-semibold" style={{ color: 'var(--ta-ink)' }}>{money(median)}</span>}
        </span>
        {actual != null && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: 'var(--ta-ink)' }} />
            Actual <span className="ta-num font-semibold" style={{ color: 'var(--ta-ink)' }}>{money(actual)}</span>
          </span>
        )}
        <span>{paths.length} sampled paths</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Stacked proportion bar
// ---------------------------------------------------------------------

export function StackedBar({ segments, height = 9, showLabels = true }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0)
  if (!total) return null
  return (
    <div className="w-full">
      <div className="flex w-full overflow-hidden rounded-full" style={{ height, backgroundColor: 'var(--ta-bg)' }}>
        {segments.map((s, i) =>
          s.value > 0 ? (
            <motion.div
              key={s.label}
              initial={{ width: 0 }}
              whileInView={{ width: `${(s.value / total) * 100}%` }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
              style={{ backgroundColor: s.color }}
              title={`${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(1)}%)`}
            />
          ) : null
        )}
      </div>
      {showLabels && (
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-px">
          {segments.filter((s) => s.value > 0).map((s) => (
            <span key={s.label} className="flex items-center gap-0.5" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label} <span className="ta-num font-semibold" style={{ color: 'var(--ta-ink)' }}>{s.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Scatter plot
// ---------------------------------------------------------------------

export function Scatter({ points, xLabel, yLabel, height, colorOf, trendLine = true }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.3 })
  const W = 320
  const H = 110

  if (!points || points.length < 3) {
    return (
      <div ref={ref} className="flex items-center justify-center italic" style={{ height: height || 'var(--tad-chart-h)', fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        Three or more points are needed to plot a relationship.
      </div>
    )
  }

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys, 0)
  const yMax = Math.max(...ys, 0)
  const sx = scaler(xMin, xMax, 12, W - 6)
  const sy = scaler(yMin, yMax, H - 12, 6)

  // Least-squares fit drawn across the visible x range.
  let trend = null
  if (trendLine && points.length >= 4) {
    const n = points.length
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
    }
    if (den !== 0) {
      const slope = num / den
      const intercept = my - slope * mx
      trend = {
        x1: sx(xMin), y1: sy(slope * xMin + intercept),
        x2: sx(xMax), y2: sy(slope * xMax + intercept),
        slope,
      }
    }
  }

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: height || 'var(--tad-chart-h)' }}>
        {yMin < 0 && yMax > 0 && (
          <line x1="12" x2={W - 6} y1={sy(0)} y2={sy(0)} stroke="var(--tad-border-strong)" strokeWidth="0.7" strokeDasharray="3 3" />
        )}
        {trend && (
          <motion.line
            x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2}
            stroke="var(--ta-accent)" strokeWidth="1.2" opacity={0.75}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
          />
        )}
        {points.map((p, i) => (
          <motion.circle
            key={p.id || i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r="2.4"
            fill={colorOf ? colorOf(p) : signColor(p.y)}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: inView ? 0.85 : 0, scale: inView ? 1 : 0 }}
            transition={{ duration: 0.3, delay: i * 0.012, ease: EASE }}
          >
            <title>{p.title || `${p.x}, ${p.y}`}</title>
          </motion.circle>
        ))}
      </svg>
      <div className="flex justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
    </div>
  )
}
