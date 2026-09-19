// Trade Analysis — time, session and seasonality analytics.
//
// Answers "when do I actually make money?". Everything derives from two
// real fields already on every trade: `date` (the trade date the person
// picked) and `createdAt` (the millisecond timestamp the row was logged).
// Hour-of-day and session stats read `createdAt`, which is the closest
// honest proxy for entry time the current form captures — so anything
// built on it is labelled "logged at" rather than pretending to be a
// broker-accurate fill time.

import { mean, sum } from './stats'
import {
  dayKey,
  groupPnlBy,
  hasPnl,
  monthKey,
  outcomeOf,
  parseDate,
  pnlOf,
  sortChrono,
  weekKey,
} from './tradeAnalyticsPro'

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const emptyBucket = (label) => ({ label, trades: 0, wins: 0, losses: 0, pnl: 0, withPnl: 0 })

function finalise(bucket) {
  const resolved = bucket.wins + bucket.losses
  return {
    ...bucket,
    winRate: resolved ? (bucket.wins / resolved) * 100 : null,
    avgPnl: bucket.withPnl ? bucket.pnl / bucket.withPnl : null,
    expectancy: bucket.withPnl ? bucket.pnl / bucket.withPnl : null,
  }
}

function tally(bucket, t) {
  bucket.trades += 1
  const o = outcomeOf(t)
  if (o === 'win') bucket.wins += 1
  if (o === 'loss') bucket.losses += 1
  if (hasPnl(t)) {
    bucket.pnl += pnlOf(t)
    bucket.withPnl += 1
  }
}

/** Monday-first weekday breakdown with P&L, win rate and expectancy. */
export function getDayOfWeekStats(trades) {
  const buckets = DOW_LABELS.map(emptyBucket)
  trades.forEach((t) => {
    const d = parseDate(t)
    tally(buckets[(d.getDay() + 6) % 7], t)
  })
  return buckets.map(finalise)
}

/** Calendar-month seasonality across every year in the log. */
export function getMonthOfYearStats(trades) {
  const buckets = MONTH_LABELS.map(emptyBucket)
  trades.forEach((t) => tally(buckets[parseDate(t).getMonth()], t))
  return buckets.map(finalise)
}

/**
 * Hour-of-day from `createdAt`. Only hours that actually contain a trade
 * are returned, so a swing trader who logs in two evening slots doesn't
 * get 22 empty columns.
 */
export function getHourOfDayStats(trades) {
  const map = new Map()
  trades.forEach((t) => {
    if (!t.createdAt) return
    const h = new Date(t.createdAt).getHours()
    if (!map.has(h)) map.set(h, emptyBucket(`${String(h).padStart(2, '0')}:00`))
    tally(map.get(h), t)
  })
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([hour, b]) => ({ hour, ...finalise(b) }))
}

/**
 * Trading sessions in IST, which is the timezone the person is logging
 * from. Boundaries are the standard session opens converted to IST:
 *   Sydney  05:30–08:00   Tokyo   05:30–11:30
 *   London  12:30–17:30   (overlaps Tokyo close)
 *   New York 18:30–23:30  (overlaps London until 21:30)
 * Anything outside those is "Off-session", which for a day trader is
 * itself a useful signal.
 */
const SESSIONS = [
  { id: 'tokyo', label: 'Tokyo', from: 5.5, to: 11.5 },
  { id: 'london', label: 'London', from: 12.5, to: 17.5 },
  { id: 'overlap', label: 'LDN×NY', from: 18.5, to: 21.5 },
  { id: 'newyork', label: 'New York', from: 21.5, to: 23.5 },
]

export function getSessionStats(trades) {
  const buckets = new Map(SESSIONS.map((s) => [s.id, { ...emptyBucket(s.label), id: s.id, from: s.from, to: s.to }]))
  buckets.set('off', { ...emptyBucket('Off-session'), id: 'off', from: null, to: null })

  trades.forEach((t) => {
    if (!t.createdAt) {
      tally(buckets.get('off'), t)
      return
    }
    const d = new Date(t.createdAt)
    const hours = d.getHours() + d.getMinutes() / 60
    const hit = SESSIONS.find((s) => hours >= s.from && hours < s.to)
    tally(buckets.get(hit ? hit.id : 'off'), t)
  })

  return [...buckets.values()].map(finalise).filter((b) => b.trades > 0)
}

/** Trading cadence — gaps between trades, busiest day, weekly rhythm. */
export function getCadenceStats(trades) {
  const rows = sortChrono(trades)
  if (rows.length < 2) {
    return { avgGapDays: null, maxGapDays: null, tradesPerWeek: null, activeDays: rows.length ? 1 : 0, busiestDay: null, spanDays: 0 }
  }

  const gaps = []
  for (let i = 1; i < rows.length; i++) {
    const a = parseDate(rows[i - 1])
    const b = parseDate(rows[i])
    gaps.push(Math.max(0, Math.round((b - a) / 86400000)))
  }

  const byDay = groupPnlBy(rows, dayKey)
  const busiest = [...byDay].sort((a, b) => b.trades - a.trades)[0] || null

  const first = parseDate(rows[0])
  const last = parseDate(rows[rows.length - 1])
  const spanDays = Math.max(1, Math.round((last - first) / 86400000) + 1)

  return {
    avgGapDays: mean(gaps),
    maxGapDays: Math.max(...gaps),
    tradesPerWeek: (rows.length / spanDays) * 7,
    activeDays: byDay.length,
    busiestDay: busiest,
    spanDays,
    firstDate: first,
    lastDate: last,
  }
}

/**
 * Holding period. `date` is entry; `updatedAt` is when the status was last
 * changed, which for a resolved trade is when the outcome was recorded.
 * That's a real measured duration for trades the person closed out in the
 * app — trades never updated after creation are skipped rather than
 * counted as zero-day holds.
 */
export function getHoldingPeriodStats(trades) {
  const rows = trades
    .filter((t) => t.status === 'Target Hit' || t.status === 'SL Hit')
    .filter((t) => t.updatedAt && t.createdAt && t.updatedAt - t.createdAt > 60000)
    .map((t) => ({
      id: t.id,
      days: (t.updatedAt - t.createdAt) / 86400000,
      outcome: outcomeOf(t),
      pnl: hasPnl(t) ? pnlOf(t) : null,
    }))

  if (!rows.length) return { available: false, sampleSize: 0 }

  const winDurations = rows.filter((r) => r.outcome === 'win').map((r) => r.days)
  const lossDurations = rows.filter((r) => r.outcome === 'loss').map((r) => r.days)

  return {
    available: true,
    sampleSize: rows.length,
    avgDays: mean(rows.map((r) => r.days)),
    avgWinDays: winDurations.length ? mean(winDurations) : null,
    avgLossDays: lossDurations.length ? mean(lossDurations) : null,
    longest: Math.max(...rows.map((r) => r.days)),
    shortest: Math.min(...rows.map((r) => r.days)),
    // Cutting winners early while letting losers run is the classic
    // pattern — this is the one line that exposes it.
    holdsLosersLonger: winDurations.length && lossDurations.length ? mean(lossDurations) > mean(winDurations) : null,
  }
}

/** Month-by-month table with cumulative running total — the classic journal view. */
export function getMonthlyTable(trades, monthsBack = 12) {
  const rows = groupPnlBy(trades, monthKey).sort((a, b) => a.key.localeCompare(b.key))
  let cumulative = 0
  const out = rows.map((r) => {
    cumulative += r.pnl
    const resolved = r.wins + r.losses
    return {
      ...r,
      label: r.date.toLocaleDateString(undefined, { year: '2-digit', month: 'short' }),
      winRate: resolved ? (r.wins / resolved) * 100 : null,
      cumulative,
    }
  })
  return out.slice(-monthsBack)
}

/** Week-by-week table, same shape as the monthly one. */
export function getWeeklyTable(trades, weeksBack = 12) {
  const rows = groupPnlBy(trades, weekKey).sort((a, b) => a.key.localeCompare(b.key))
  let cumulative = 0
  const out = rows.map((r) => {
    cumulative += r.pnl
    const resolved = r.wins + r.losses
    return {
      ...r,
      label: r.key.replace(/^\d{2}/, ''),
      winRate: resolved ? (r.wins / resolved) * 100 : null,
      cumulative,
    }
  })
  return out.slice(-weeksBack)
}

/**
 * Day × hour grid for a "when am I active" heatmap. Cells hold both count
 * and net P&L so the same grid can be coloured either way.
 */
export function getTimeHeatmap(trades) {
  const grid = DOW_LABELS.map((label) => ({
    label,
    cells: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, pnl: 0, wins: 0, losses: 0 })),
  }))
  let max = 0
  trades.forEach((t) => {
    if (!t.createdAt) return
    const d = new Date(t.createdAt)
    const row = grid[(d.getDay() + 6) % 7]
    const cell = row.cells[d.getHours()]
    cell.count += 1
    if (hasPnl(t)) cell.pnl += pnlOf(t)
    const o = outcomeOf(t)
    if (o === 'win') cell.wins += 1
    if (o === 'loss') cell.losses += 1
    max = Math.max(max, cell.count)
  })
  // Trim to the hours that actually contain activity so the grid isn't
  // 24 columns of empty squares on a narrow screen.
  const activeHours = []
  for (let h = 0; h < 24; h++) {
    if (grid.some((row) => row.cells[h].count > 0)) activeHours.push(h)
  }
  return { grid, max, activeHours }
}

/** Compares any two date ranges over the same trade log. */
export function comparePeriods(trades, rangeA, rangeB) {
  const inRange = (t, range) => {
    if (!range || !range.from || !range.to) return false
    const d = parseDate(t)
    return d >= range.from && d <= range.to
  }
  const build = (range) => {
    const scoped = trades.filter((t) => inRange(t, range))
    const withPnl = scoped.filter(hasPnl)
    const wins = scoped.filter((t) => outcomeOf(t) === 'win').length
    const losses = scoped.filter((t) => outcomeOf(t) === 'loss').length
    const netPnl = sum(withPnl.map(pnlOf))
    return {
      count: scoped.length,
      wins,
      losses,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
      netPnl,
      avgPnl: withPnl.length ? netPnl / withPnl.length : null,
      withPnl: withPnl.length,
    }
  }
  const a = build(rangeA)
  const b = build(rangeB)
  const delta = (x, y) => (x == null || y == null ? null : y - x)
  return {
    a,
    b,
    deltaCount: b.count - a.count,
    deltaWinRate: delta(a.winRate, b.winRate),
    deltaNetPnl: delta(a.netPnl, b.netPnl),
    deltaAvgPnl: delta(a.avgPnl, b.avgPnl),
  }
}

export { DOW_LABELS, MONTH_LABELS }
