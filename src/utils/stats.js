// Trade Analysis — shared statistical primitives.
//
// Every function here is pure and defensive: it takes a plain array of
// finite numbers and returns `null` rather than NaN/Infinity when there
// isn't enough data to answer honestly. That matters because the Analysis
// tab renders real numbers from a real (often tiny) trade log — a brand
// new journal with three trades must show "—" for Sharpe ratio, not a
// confident-looking 4.82 derived from two data points.
//
// Nothing here knows what a trade is. Trade-shaped logic lives in
// tradeAnalyticsPro.js; this file is the math underneath it.

/** Keeps only finite numbers — strips null/undefined/''/NaN/Infinity. */
export function clean(values) {
  const out = []
  for (const v of values) {
    const n = Number(v)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export function sum(values) {
  let total = 0
  for (const v of values) total += v
  return total
}

export function mean(values) {
  if (!values.length) return null
  return sum(values) / values.length
}

/** Sample standard deviation (n-1). Needs >= 2 points to mean anything. */
export function stdev(values) {
  if (values.length < 2) return null
  const m = mean(values)
  const variance = sum(values.map((v) => (v - m) ** 2)) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Population standard deviation (n) — used where the sample IS the population. */
export function stdevPop(values) {
  if (!values.length) return null
  const m = mean(values)
  return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / values.length)
}

/**
 * Downside deviation against a minimum acceptable return (MAR).
 * Only observations BELOW the MAR contribute, which is what separates
 * Sortino from Sharpe: upside volatility isn't punished.
 */
export function downsideDeviation(values, mar = 0) {
  if (values.length < 2) return null
  const squares = values.map((v) => (v < mar ? (v - mar) ** 2 : 0))
  return Math.sqrt(sum(squares) / (values.length - 1))
}

/**
 * Linear-interpolated percentile (the same method NumPy and Excel's
 * PERCENTILE.INC use), so a 95% VaR on 40 trades lands between the two
 * neighbouring observations instead of snapping to one of them.
 * `p` is 0..100.
 */
export function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low)
}

export function median(values) {
  return percentile(values, 50)
}

/** Quartiles + interquartile range — the numbers behind a box plot. */
export function quartiles(values) {
  if (values.length < 4) return null
  const q1 = percentile(values, 25)
  const q2 = percentile(values, 50)
  const q3 = percentile(values, 75)
  const iqr = q3 - q1
  return {
    min: Math.min(...values),
    q1,
    median: q2,
    q3,
    max: Math.max(...values),
    iqr,
    // Tukey fences — anything past these is flagged as an outlier.
    lowerFence: q1 - 1.5 * iqr,
    upperFence: q3 + 1.5 * iqr,
  }
}

/**
 * Sample skewness (Fisher-Pearson, bias-corrected G1). Positive means a
 * long right tail — for a trade log that reads as "a few big winners
 * carry the account", which is a genuinely different edge profile from a
 * symmetric one even at the same win rate.
 */
export function skewness(values) {
  const n = values.length
  if (n < 3) return null
  const m = mean(values)
  const s = stdev(values)
  if (!s) return null
  const g1 = sum(values.map((v) => ((v - m) / s) ** 3)) / n
  return Math.sqrt(n * (n - 1)) / (n - 2) * g1
}

/**
 * Sample excess kurtosis (G2). 0 = normal-ish tails. High positive values
 * mean fat tails: rare trades far larger than the rest, so position
 * sizing off the average is understating the real risk.
 */
export function kurtosis(values) {
  const n = values.length
  if (n < 4) return null
  const m = mean(values)
  const s = stdev(values)
  if (!s) return null
  const g2 = sum(values.map((v) => ((v - m) / s) ** 4)) / n - 3
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6)
}

/** Pearson correlation coefficient between two equal-length series. */
export function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const a = xs.slice(0, n)
  const b = ys.slice(0, n)
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma
    const y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  const den = Math.sqrt(da * db)
  if (!den) return null
  return num / den
}

/** Least-squares slope + intercept of y against its own index (0,1,2…). */
export function linearTrend(values) {
  const n = values.length
  if (n < 2) return null
  const xs = values.map((_, i) => i)
  const mx = mean(xs)
  const my = mean(values)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (!den) return null
  const slope = num / den
  return { slope, intercept: my - slope * mx }
}

/**
 * Buckets values into `binCount` equal-width bins across their own range.
 * Returns [{ from, to, count, mid }] — the shape a histogram widget wants.
 */
export function histogram(values, binCount = 12) {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ from: min, to: max, mid: min, count: values.length }]
  }
  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    mid: min + (i + 0.5) * width,
    count: 0,
  }))
  for (const v of values) {
    // Last bin is inclusive on its upper edge so `max` isn't dropped.
    let idx = Math.floor((v - min) / width)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count += 1
  }
  return bins
}

/**
 * Standard normal CDF via Abramowitz & Stegun 7.1.26 — good to ~1e-7,
 * far more precision than any display here needs. Used by the risk-of-ruin
 * and z-score readouts so neither has to ship a lookup table.
 */
export function normalCdf(z) {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/**
 * Mulberry32 — a tiny seeded PRNG. Monte Carlo runs use this instead of
 * Math.random so the same trade log + same seed always produces the same
 * simulation. A result you can't reproduce is a result you can't act on.
 */
export function seededRandom(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/** Safe division — returns null instead of Infinity/NaN on a zero divisor. */
export function safeDiv(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}
