// Trade Analysis — instrument, timeframe and setup edge analytics.
//
// Where the edge actually lives. Everything here groups the real trade log
// by a real field (instrument, timeframe, direction, instrument type) and
// ranks the groups on numbers that matter — expectancy and profit factor,
// not just how often each one shows up.

import { correlation, mean, stdev, sum } from './stats'
import {
  dayKey,
  hasPnl,
  outcomeOf,
  parseDate,
  pnlOf,
  scorePct,
  sortChrono,
  stockLabel,
} from './tradeAnalyticsPro'

function buildGroup(rows) {
  const withPnl = rows.filter(hasPnl)
  const values = withPnl.map(pnlOf)
  const wins = rows.filter((t) => outcomeOf(t) === 'win')
  const losses = rows.filter((t) => outcomeOf(t) === 'loss')
  const resolved = wins.length + losses.length

  const grossProfit = sum(values.filter((v) => v > 0))
  const grossLoss = Math.abs(sum(values.filter((v) => v < 0)))

  const scores = rows.map(scorePct).filter((v) => v !== null)

  return {
    count: rows.length,
    resolved,
    wins: wins.length,
    losses: losses.length,
    pending: rows.filter((t) => outcomeOf(t) === 'open').length,
    winRate: resolved ? (wins.length / resolved) * 100 : null,
    netPnl: sum(values),
    withPnl: withPnl.length,
    avgPnl: values.length ? sum(values) / values.length : null,
    expectancy: values.length ? sum(values) / values.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    grossProfit,
    grossLoss,
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
    stdev: stdev(values),
    avgScore: scores.length ? mean(scores) : null,
  }
}

function groupBy(trades, keyFn) {
  const map = new Map()
  trades.forEach((t) => {
    const key = keyFn(t)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t)
  })
  return [...map.entries()].map(([key, rows]) => ({ key, ...buildGroup(rows), rows }))
}

export function getInstrumentStats(trades) {
  return groupBy(trades, stockLabel).sort((a, b) => b.count - a.count)
}

export function getTimeframeStats(trades) {
  return groupBy(trades, (t) => t.timeframe || '—').sort((a, b) => b.count - a.count)
}

export function getDirectionStats(trades) {
  return groupBy(trades, (t) => (t.direction === 'Sell' ? 'Sell' : 'Buy'))
}

export function getInstrumentTypeStats(trades) {
  return groupBy(trades, (t) => t.instrumentType || 'Unknown').sort((a, b) => b.count - a.count)
}

/**
 * Composite edge score, 0-100. Blends win rate, expectancy rank and
 * profit factor, then damps the whole thing by sample size — an
 * instrument with 3 trades cannot outrank one with 30 on the same raw
 * numbers, because the confidence isn't comparable.
 */
export function rankEdge(groups) {
  const scored = groups.filter((g) => g.resolved >= 2 || g.withPnl >= 2)
  if (!scored.length) return []

  const expectancies = scored.map((g) => g.expectancy).filter((v) => v != null)
  const maxExp = expectancies.length ? Math.max(...expectancies.map(Math.abs), 1) : 1

  return scored
    .map((g) => {
      const wrScore = g.winRate == null ? 40 : g.winRate
      const expScore = g.expectancy == null ? 40 : ((g.expectancy / maxExp) * 50 + 50)
      const pfScore = g.profitFactor == null ? 45 : Math.min(100, g.profitFactor * 33)
      const raw = wrScore * 0.35 + expScore * 0.4 + pfScore * 0.25
      // Confidence ramps to full weight at 20 observations.
      const confidence = Math.min(1, g.count / 20)
      const score = Math.round(raw * (0.55 + 0.45 * confidence))
      return {
        ...g,
        edgeScore: Math.max(0, Math.min(100, score)),
        confidence: Math.round(confidence * 100),
      }
    })
    .sort((a, b) => b.edgeScore - a.edgeScore)
}

/**
 * Instrument × timeframe P&L grid. Only instruments/timeframes that
 * actually appear are included, so the grid never renders empty columns.
 */
export function getEdgeMatrix(trades, instrumentLimit = 8) {
  const instruments = getInstrumentStats(trades).slice(0, instrumentLimit).map((g) => g.key)
  const timeframes = [...new Set(trades.map((t) => t.timeframe || '—'))]

  const rows = instruments.map((inst) => {
    const cells = timeframes.map((tf) => {
      const subset = trades.filter((t) => stockLabel(t) === inst && (t.timeframe || '—') === tf)
      return { tf, ...buildGroup(subset) }
    })
    return { instrument: inst, cells }
  })

  const allPnl = rows.flatMap((r) => r.cells.map((c) => c.netPnl)).filter((v) => Number.isFinite(v))
  const maxAbs = allPnl.length ? Math.max(...allPnl.map(Math.abs), 1) : 1

  return { instruments, timeframes, rows, maxAbs }
}

/** Direction × timeframe grid — does the long side work on one TF only? */
export function getDirectionMatrix(trades) {
  const timeframes = [...new Set(trades.map((t) => t.timeframe || '—'))]
  const rows = timeframes.map((tf) => {
    const scoped = trades.filter((t) => (t.timeframe || '—') === tf)
    return {
      tf,
      buy: buildGroup(scoped.filter((t) => t.direction !== 'Sell')),
      sell: buildGroup(scoped.filter((t) => t.direction === 'Sell')),
      total: scoped.length,
    }
  })
  return rows.sort((a, b) => b.total - a.total)
}

/**
 * Concentration — how much of the book sits in a handful of names.
 * Uses the Herfindahl-Hirschman index (sum of squared shares), the same
 * measure regulators use for market concentration. Above ~0.25 means
 * heavily concentrated.
 */
export function getConcentration(trades) {
  const groups = getInstrumentStats(trades)
  const total = trades.length
  if (!total) return { hhi: null, effectiveCount: null, top: [], diversificationScore: null }

  const shares = groups.map((g) => g.count / total)
  const hhi = sum(shares.map((s) => s * s))
  // Inverse HHI = "effective number of instruments" actually being traded.
  const effectiveCount = hhi > 0 ? 1 / hhi : null

  const diversificationScore = Math.round(
    Math.max(0, Math.min(100, ((effectiveCount || 1) / Math.min(groups.length || 1, 10)) * 100))
  )

  return {
    hhi,
    effectiveCount,
    uniqueCount: groups.length,
    diversificationScore,
    top: groups.slice(0, 5).map((g) => ({ name: g.key, count: g.count, sharePct: (g.count / total) * 100, netPnl: g.netPnl })),
    verdict:
      hhi == null
        ? null
        : hhi > 0.35
          ? 'Highly concentrated — most trades sit in one or two names'
          : hhi > 0.18
            ? 'Moderately concentrated'
            : 'Well spread across instruments',
  }
}

/**
 * Daily P&L correlation between the instruments traded most often. Needs
 * days where both were traded — with a sparse journal most pairs return
 * null, which is the correct answer rather than a fabricated 0.
 */
export function getInstrumentCorrelation(trades, limit = 6) {
  const top = getInstrumentStats(trades)
    .filter((g) => g.withPnl >= 3)
    .slice(0, limit)
    .map((g) => g.key)

  if (top.length < 2) return { instruments: top, matrix: [], available: false }

  // Daily net P&L series per instrument, aligned on the union of dates.
  const dates = [...new Set(sortChrono(trades).filter(hasPnl).map((t) => dayKey(parseDate(t))))].sort()
  const seriesFor = (name) => {
    const byDay = new Map()
    trades
      .filter((t) => stockLabel(t) === name && hasPnl(t))
      .forEach((t) => {
        const k = dayKey(parseDate(t))
        byDay.set(k, (byDay.get(k) || 0) + pnlOf(t))
      })
    return { byDay, dates: new Set(byDay.keys()) }
  }

  const series = new Map(top.map((n) => [n, seriesFor(n)]))

  const matrix = top.map((a) =>
    top.map((b) => {
      if (a === b) return { a, b, r: 1, overlap: series.get(a).dates.size }
      const sa = series.get(a)
      const sb = series.get(b)
      const shared = dates.filter((d) => sa.dates.has(d) && sb.dates.has(d))
      if (shared.length < 3) return { a, b, r: null, overlap: shared.length }
      return {
        a,
        b,
        r: correlation(shared.map((d) => sa.byDay.get(d)), shared.map((d) => sb.byDay.get(d))),
        overlap: shared.length,
      }
    })
  )

  return { instruments: top, matrix, available: true }
}

/** Best and worst performers, guarded by a minimum sample. */
export function getPerformerSpotlight(trades, minTrades = 3) {
  const groups = getInstrumentStats(trades).filter((g) => g.count >= minTrades && g.withPnl > 0)
  if (!groups.length) return { best: null, worst: null, mostTraded: null, available: false }
  const byNet = [...groups].sort((a, b) => b.netPnl - a.netPnl)
  const byCount = [...groups].sort((a, b) => b.count - a.count)
  return {
    available: true,
    best: byNet[0],
    worst: byNet[byNet.length - 1],
    mostTraded: byCount[0],
    minTrades,
  }
}
