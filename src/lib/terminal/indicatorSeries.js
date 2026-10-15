// Turns an indicator's value array into chart points. Pure → unit-tested.
//   values  — one entry per candle (number | null)
//   times   — candle times (unix s, real time)
//   shift   — plot this many bars later (+, e.g. Ichimoku cloud) or earlier (−)
//   offset  — added to every time (the chart displays local time)
// null AFTER the first real value becomes a whitespace point so the line breaks
// there instead of joining across the gap. Leading nulls are dropped.
export function toSeriesData(values, times, tfSec, { shift = 0, offset = 0, hist = null } = {}) {
  const out = []
  const n = times.length
  let started = false
  for (let i = 0; i < values.length && i < n; i++) {
    const j = i + shift
    if (j < 0) continue
    const t = (j < n ? times[j] : times[n - 1] + (j - (n - 1)) * tfSec) + offset
    const v = values[i]
    if (v == null || !Number.isFinite(v)) {
      if (started) out.push({ time: t })
      continue
    }
    started = true
    out.push(hist ? { time: t, value: v, color: v >= 0 ? hist.up : hist.down } : { time: t, value: v })
  }
  return out
}

export const lastValue = (values) => {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null && Number.isFinite(values[i])) return values[i]
  return null
}

// Compact number format for legends: more decimals for small values.
export const fmtIndicator = (v) => (v == null ? '—' : Math.abs(v) >= 100 ? v.toFixed(2) : Math.abs(v) >= 1 ? v.toFixed(3) : v.toFixed(5))
