// Trade Analysis — Pro analytics engine.
//
// Companion to tradeAnalytics.js. Where that file answers "how many, how
// often, which one", this one answers "is this edge real, and what is it
// costing me". Every export is a pure function of the caller's own trade
// array — no store reads, no fetches, no sample data, no placeholder
// numbers. If a statistic can't be computed honestly from what the person
// actually logged, it returns null and the widget renders "—".
//
// ── Currency rule (important) ─────────────────────────────────────────
// Equity trades settle in ₹ and Forex/Commodity trades settle in $ (see
// utils/currency.js). Adding those into one number is meaningless, so
// every money-denominated metric here expects a SINGLE currency group's
// trades. Callers use splitTradesByCurrency() first. Count-based and
// rate-based metrics (win rate, streaks, day-of-week frequency) are
// currency-agnostic and safely take the whole list.
//
// ── Vocabulary ────────────────────────────────────────────────────────
//   resolved  — status is 'Target Hit' or 'SL Hit'
//   win/loss  — by P&L sign where a P&L exists, otherwise by status
//   R         — one unit of risk. The trade form doesn't capture a stop
//               price, so R is estimated as the average absolute loss
//               (see rUnitFor). That's a real, data-derived proxy and is
//               labelled as an estimate everywhere it surfaces.

import {
  clean,
  correlation,
  downsideDeviation,
  histogram,
  kurtosis,
  linearTrend,
  mean,
  median,
  normalCdf,
  percentile,
  quartiles,
  safeDiv,
  seededRandom,
  skewness,
  stdev,
  sum,
} from './stats'

// ---------------------------------------------------------------------
// Shared predicates & accessors (kept byte-compatible with
// tradeAnalytics.js so both engines agree on what a "win" is)
// ---------------------------------------------------------------------

export const isResolved = (t) => t.status === 'Target Hit' || t.status === 'SL Hit'
export const isPending = (t) => !t.status || t.status === 'Pending'
export const isTargetHit = (t) => t.status === 'Target Hit'
export const isSlHit = (t) => t.status === 'SL Hit'

export const hasPnl = (t) =>
  t.pnl !== undefined && t.pnl !== null && t.pnl !== '' && Number.isFinite(Number(t.pnl))
export const pnlOf = (t) => Number(t.pnl)

export const stockLabel = (t) => t.instrumentName || t.pair || 'Unknown'

/**
 * Outcome of a trade as a single word. P&L is the source of truth when
 * it's logged (a "Target Hit" that netted -200 after costs is a loss);
 * status is the fallback for trades with no P&L yet.
 */
export function outcomeOf(t) {
  if (hasPnl(t)) {
    const v = pnlOf(t)
    if (v > 0) return 'win'
    if (v < 0) return 'loss'
    return 'flat'
  }
  if (isTargetHit(t)) return 'win'
  if (isSlHit(t)) return 'loss'
  return 'open'
}

export const scorePct = (t) => {
  const s = t.validationScore
  if (!s || !s.total) return null
  return (s.checked / s.total) * 100
}

const DAY_MS = 24 * 60 * 60 * 1000

export function parseDate(t) {
  if (t.date) {
    const d = new Date(`${t.date}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(t.createdAt || Date.now())
}

export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** ISO week key, e.g. "2026-W38". Weeks start Monday. */
export function weekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / DAY_MS + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function dayDiff(from, to = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / DAY_MS)
}

/**
 * Chronological order — trade date first, then createdAt as the
 * tie-breaker for several trades logged on the same day. Every sequential
 * metric (equity curve, streaks, drawdown, after-a-loss behaviour) depends
 * on this being stable, so it's defined once here.
 */
export function sortChrono(trades) {
  return [...trades].sort(
    (a, b) => parseDate(a) - parseDate(b) || (a.createdAt || 0) - (b.createdAt || 0)
  )
}

/** Just the P&L numbers, chronologically, for trades that have one. */
export function pnlSeries(trades) {
  return sortChrono(trades).filter(hasPnl).map(pnlOf)
}

// ---------------------------------------------------------------------
// 1. Core performance — the numbers a prop firm would ask for first
// ---------------------------------------------------------------------

/**
 * Gross profit, gross loss, profit factor, expectancy, payoff ratio and
 * the win/loss averages they're built from. Single currency group only.
 */
export function getPerformance(trades) {
  const withPnl = trades.filter(hasPnl)
  const values = withPnl.map(pnlOf)
  const wins = values.filter((v) => v > 0)
  const losses = values.filter((v) => v < 0)
  const flats = values.filter((v) => v === 0)

  const grossProfit = sum(wins)
  const grossLoss = Math.abs(sum(losses))
  const netPnl = grossProfit - grossLoss

  const avgWin = wins.length ? grossProfit / wins.length : null
  const avgLoss = losses.length ? grossLoss / losses.length : null

  // Profit factor: gross profit per unit of gross loss. Undefined with no
  // losses at all — reporting "Infinity" would read as a flawless system
  // when it actually means "not enough downside data yet".
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null

  const n = values.length
  const winRate = n ? wins.length / n : null
  const lossRate = n ? losses.length / n : null

  // Expectancy — average currency won per trade taken, the single most
  // useful number for deciding whether to keep trading a system.
  const expectancy = n ? netPnl / n : null

  // Payoff (reward/risk realised): how many rupees/dollars an average
  // winner brings back per one an average loser costs.
  const payoffRatio = avgWin != null && avgLoss ? avgWin / avgLoss : null

  // SQN (Van Tharp): expectancy divided by the standard deviation of
  // trade results, scaled by √n. Below 1.6 is usually "hard to trade";
  // above 2.5 is a strong system. Needs 2+ results to have a stdev.
  const sd = stdev(values)
  const sqn = sd && n >= 2 ? (expectancy / sd) * Math.sqrt(n) : null

  return {
    tradesWithPnl: n,
    grossProfit,
    grossLoss,
    netPnl,
    winCount: wins.length,
    lossCount: losses.length,
    flatCount: flats.length,
    winRate: winRate == null ? null : winRate * 100,
    lossRate: lossRate == null ? null : lossRate * 100,
    avgWin,
    avgLoss,
    largestWin: wins.length ? Math.max(...wins) : null,
    largestLoss: losses.length ? -Math.max(...losses.map(Math.abs)) : null,
    medianPnl: n ? median(values) : null,
    profitFactor,
    expectancy,
    payoffRatio,
    sqn,
    stdev: sd,
  }
}

/**
 * One R = the average absolute loss actually taken. With no losses logged
 * yet there's no risk unit to speak of, so this returns null and every
 * R-denominated readout falls back to "—".
 */
export function rUnitFor(trades) {
  const losses = trades.filter(hasPnl).map(pnlOf).filter((v) => v < 0)
  if (!losses.length) return null
  return Math.abs(mean(losses))
}

/** Expectancy expressed in R rather than currency. */
export function getExpectancyR(trades) {
  const r = rUnitFor(trades)
  const { expectancy } = getPerformance(trades)
  if (r == null || expectancy == null || r === 0) return null
  return expectancy / r
}

/** Every trade's P&L converted to R multiples, chronologically. */
export function getRMultiples(trades) {
  const r = rUnitFor(trades)
  if (!r) return []
  return sortChrono(trades)
    .filter(hasPnl)
    .map((t) => ({ id: t.id, name: stockLabel(t), date: parseDate(t), r: pnlOf(t) / r, pnl: pnlOf(t) }))
}

// ---------------------------------------------------------------------
// 2. Equity curve, high-water mark and drawdown
// ---------------------------------------------------------------------

/**
 * Cumulative P&L after each trade, plus the running peak. This is the
 * spine of the whole risk section — drawdown, recovery factor, Ulcer
 * index and the Monte Carlo bands all read from it.
 */
export function getEquityCurve(trades) {
  const rows = sortChrono(trades).filter(hasPnl)
  let equity = 0
  let peak = 0
  const points = [{ index: 0, equity: 0, peak: 0, drawdown: 0, date: null, trade: null }]
  rows.forEach((t, i) => {
    equity += pnlOf(t)
    if (equity > peak) peak = equity
    points.push({
      index: i + 1,
      equity,
      peak,
      drawdown: equity - peak, // <= 0
      date: parseDate(t),
      trade: t,
    })
  })
  return points
}

/**
 * Max drawdown in currency and as a percentage of the peak it fell from,
 * plus how long it lasted and whether it has recovered. Percentage is
 * null while the peak is still 0 or negative — "down 140% of a ₹0 peak"
 * is not a number worth showing anyone.
 */
export function getDrawdownStats(trades) {
  const curve = getEquityCurve(trades)
  if (curve.length < 2) {
    return {
      maxDrawdown: null,
      maxDrawdownPct: null,
      currentDrawdown: null,
      currentDrawdownPct: null,
      longestDrawdownTrades: 0,
      recoveryFactor: null,
      ulcerIndex: null,
      newHighs: 0,
      inDrawdown: false,
      troughIndex: null,
      recovered: null,
      curve,
    }
  }

  let maxDd = 0
  let troughIndex = null
  let peakAtTrough = 0

  // Absolute and percentage drawdown are tracked as two independent
  // maxima, because they genuinely can peak at different trades. Equity
  // running 100 → 50 → 250 → 200 has an absolute worst of 50 twice over,
  // but the first one is a 50% fall from a ₹100 peak and the second is a
  // 20% fall from a ₹250 peak. Deriving one from the other would report
  // whichever tie happened to come first, which is arbitrary.
  let maxDdPct = null
  let pctTroughIndex = null

  // Longest stretch spent below a prior peak, counted in trades.
  let longest = 0
  let runStart = null

  let newHighs = 0
  let lastPeak = 0

  const squaredPctDraws = []

  curve.forEach((p, i) => {
    if (i > 0 && p.peak > lastPeak) newHighs += 1
    lastPeak = p.peak

    const dd = p.peak - p.equity // >= 0
    if (dd > maxDd) {
      maxDd = dd
      troughIndex = i
      peakAtTrough = p.peak
    }
    if (dd > 0) {
      if (runStart === null) runStart = i
      longest = Math.max(longest, i - runStart + 1)
    } else {
      runStart = null
    }
    if (p.peak > 0) {
      const ddPct = (dd / p.peak) * 100
      squaredPctDraws.push(ddPct ** 2)
      if (maxDdPct == null || ddPct > maxDdPct) {
        maxDdPct = ddPct
        pctTroughIndex = i
      }
    }
  })

  if (maxDdPct === 0) maxDdPct = 0

  const last = curve[curve.length - 1]
  const currentDd = last.peak - last.equity
  const currentDdPct = last.peak > 0 && currentDd > 0 ? (currentDd / last.peak) * 100 : currentDd > 0 ? null : 0

  // Ulcer index — RMS of percentage drawdown. Unlike max drawdown it
  // punishes long shallow pain as well as one sharp drop.
  const ulcerIndex = squaredPctDraws.length ? Math.sqrt(mean(squaredPctDraws)) : null

  const netPnl = last.equity
  const recoveryFactor = maxDd > 0 ? netPnl / maxDd : null

  // Did equity make a new high after the worst trough?
  let recovered = null
  if (troughIndex != null) {
    recovered = curve.slice(troughIndex).some((p) => p.equity >= peakAtTrough)
  }

  return {
    maxDrawdown: maxDd > 0 ? -maxDd : 0,
    maxDrawdownPct: maxDdPct,
    currentDrawdown: currentDd > 0 ? -currentDd : 0,
    currentDrawdownPct: currentDdPct,
    longestDrawdownTrades: longest,
    recoveryFactor,
    ulcerIndex,
    newHighs,
    inDrawdown: currentDd > 0,
    troughIndex,
    pctTroughIndex,
    peakAtTrough,
    recovered,
    curve,
  }
}

// ---------------------------------------------------------------------
// 3. Risk-adjusted ratios & tail statistics
// ---------------------------------------------------------------------

/**
 * Per-trade risk ratios. These are computed on the trade-return series
 * rather than annualised: a journal has no fixed period length, and
 * annualising 30 discretionary trades would invent precision that isn't
 * there. Interpreted as "reward per unit of result volatility".
 */
export function getRiskRatios(trades) {
  const values = pnlSeries(trades)
  const n = values.length
  if (n < 2) {
    return {
      sharpe: null, sortino: null, calmar: null, omega: null,
      gainToPain: null, tailRatio: null, var95: null, cvar95: null,
      downsideDev: null, skew: null, kurt: null, stdev: null, sampleSize: n,
    }
  }

  const m = mean(values)
  const sd = stdev(values)
  const dd = downsideDeviation(values, 0)

  const sharpe = sd ? m / sd : null
  const sortino = dd ? m / dd : null

  const { maxDrawdown } = getDrawdownStats(trades)
  const netPnl = sum(values)
  const calmar = maxDrawdown && maxDrawdown < 0 ? netPnl / Math.abs(maxDrawdown) : null

  // Omega at a zero threshold: total gains divided by total losses. Same
  // inputs as profit factor but kept separate because it's read against a
  // threshold that a future version could make adjustable.
  const gains = sum(values.filter((v) => v > 0))
  const pains = Math.abs(sum(values.filter((v) => v < 0)))
  const omega = pains > 0 ? gains / pains : null
  const gainToPain = pains > 0 ? netPnl / pains : null

  // Tail ratio — the size of the right tail against the left tail. Above
  // 1 means the best days outrun the worst ones.
  const p95 = percentile(values, 95)
  const p5 = percentile(values, 5)
  const tailRatio = p5 != null && p5 !== 0 ? Math.abs(p95 / p5) : null

  // Historical VaR/CVaR at 95%: the loss the worst 5% of trades exceed,
  // and the average loss once you're in that 5%.
  const var95 = percentile(values, 5)
  const tail = values.filter((v) => v <= var95)
  const cvar95 = tail.length ? mean(tail) : null

  return {
    sharpe,
    sortino,
    calmar,
    omega,
    gainToPain,
    tailRatio,
    var95,
    cvar95,
    downsideDev: dd,
    skew: skewness(values),
    kurt: kurtosis(values),
    stdev: sd,
    sampleSize: n,
  }
}

/**
 * Kelly fraction — the bet size that maximises long-run growth given the
 * realised win rate and payoff ratio. Real traders size well below this
 * (half-Kelly or less), so the half-Kelly figure is returned alongside.
 * Negative means the edge is currently negative: the optimal size is zero.
 */
export function getKelly(trades) {
  const { winRate, payoffRatio, winCount, lossCount } = getPerformance(trades)
  if (winRate == null || payoffRatio == null || !payoffRatio) {
    return { kellyPct: null, halfKellyPct: null, winRate, payoffRatio, sampleSize: winCount + lossCount }
  }
  const w = winRate / 100
  const b = payoffRatio
  const kelly = w - (1 - w) / b
  return {
    kellyPct: kelly * 100,
    halfKellyPct: (kelly / 2) * 100,
    winRate,
    payoffRatio,
    sampleSize: winCount + lossCount,
  }
}

/**
 * Risk of ruin under the realised win rate and payoff, for a given number
 * of risk units of capital. Uses the standard sequential-gambling
 * approximation; with a positive edge it decays geometrically in units.
 */
export function getRiskOfRuin(trades, capitalUnits = 20) {
  const { winRate, payoffRatio } = getPerformance(trades)
  if (winRate == null || payoffRatio == null || !payoffRatio) {
    return { riskOfRuinPct: null, edge: null, capitalUnits }
  }
  const w = winRate / 100
  const l = 1 - w
  const b = payoffRatio
  const edge = w * b - l
  if (edge <= 0) return { riskOfRuinPct: 100, edge, capitalUnits }
  // Solve a^b·w + a^-1·l = 1 numerically for the ruin ratio a ∈ (0,1).
  let lo = 0
  let hi = 1
  for (let i = 0; i < 80; i++) {
    const a = (lo + hi) / 2
    const f = w * a ** b + l / a - 1
    if (f > 0) lo = a
    else hi = a
  }
  const a = (lo + hi) / 2
  const ruin = Math.pow(a, capitalUnits)
  return { riskOfRuinPct: Math.min(100, Math.max(0, ruin * 100)), edge, capitalUnits }
}

/**
 * Wald-Wolfowitz runs test on the win/loss sequence. |Z| > 1.96 means the
 * streaks are unlikely to be chance: positive Z = results alternate more
 * than random (mean reversion), negative Z = they clump (real streaks).
 * This is the honest way to answer "am I actually on a hot streak?".
 */
export function getZScore(trades) {
  const seq = sortChrono(trades)
    .map(outcomeOf)
    .filter((o) => o === 'win' || o === 'loss')
  const n = seq.length
  if (n < 10) return { z: null, runs: null, sampleSize: n, verdict: 'Needs 10+ resolved trades' }

  const wins = seq.filter((o) => o === 'win').length
  const losses = n - wins
  if (!wins || !losses) return { z: null, runs: null, sampleSize: n, verdict: 'All outcomes the same so far' }

  let runs = 1
  for (let i = 1; i < n; i++) if (seq[i] !== seq[i - 1]) runs += 1

  const expected = (2 * wins * losses) / n + 1
  const variance = (2 * wins * losses * (2 * wins * losses - n)) / (n * n * (n - 1))
  if (variance <= 0) return { z: null, runs, sampleSize: n, verdict: 'Not enough variation' }
  const z = (runs - expected) / Math.sqrt(variance)

  const verdict =
    Math.abs(z) < 1.96
      ? 'Streaks look like chance'
      : z < 0
        ? 'Results clump — streaks are real'
        : 'Results alternate more than chance'

  return { z, runs, expectedRuns: expected, sampleSize: n, verdict, pValue: 2 * (1 - normalCdf(Math.abs(z))) }
}

// ---------------------------------------------------------------------
// 4. Streaks & consistency
// ---------------------------------------------------------------------

export function getStreakStats(trades) {
  const seq = sortChrono(trades)
    .map((t) => ({ outcome: outcomeOf(t), trade: t }))
    .filter((r) => r.outcome === 'win' || r.outcome === 'loss')

  if (!seq.length) {
    return {
      current: 0, currentType: null, maxWin: 0, maxLoss: 0,
      avgWinStreak: null, avgLossStreak: null, runs: [], sampleSize: 0,
    }
  }

  const runs = []
  let type = seq[0].outcome
  let len = 0
  seq.forEach((r) => {
    if (r.outcome === type) {
      len += 1
    } else {
      runs.push({ type, length: len })
      type = r.outcome
      len = 1
    }
  })
  runs.push({ type, length: len })

  const winRuns = runs.filter((r) => r.type === 'win').map((r) => r.length)
  const lossRuns = runs.filter((r) => r.type === 'loss').map((r) => r.length)
  const lastRun = runs[runs.length - 1]

  return {
    current: lastRun.length,
    currentType: lastRun.type,
    maxWin: winRuns.length ? Math.max(...winRuns) : 0,
    maxLoss: lossRuns.length ? Math.max(...lossRuns) : 0,
    avgWinStreak: winRuns.length ? mean(winRuns) : null,
    avgLossStreak: lossRuns.length ? mean(lossRuns) : null,
    runs,
    sampleSize: seq.length,
  }
}

/** Groups P&L into calendar buckets — the input to every period view. */
export function groupPnlBy(trades, keyFn) {
  const map = new Map()
  sortChrono(trades).forEach((t) => {
    const d = parseDate(t)
    const key = keyFn(d)
    if (!map.has(key)) map.set(key, { key, date: d, pnl: 0, trades: 0, wins: 0, losses: 0, withPnl: 0 })
    const row = map.get(key)
    row.trades += 1
    const o = outcomeOf(t)
    if (o === 'win') row.wins += 1
    if (o === 'loss') row.losses += 1
    if (hasPnl(t)) {
      row.pnl += pnlOf(t)
      row.withPnl += 1
    }
  })
  return [...map.values()]
}

/**
 * Consistency: how evenly profit arrives. A system that made everything in
 * one month is a different animal from one that grinds it out — same net,
 * very different confidence. Score is 0-100, higher = steadier.
 */
export function getConsistency(trades) {
  const byMonth = groupPnlBy(trades, monthKey).filter((m) => m.withPnl > 0)
  const byWeek = groupPnlBy(trades, weekKey).filter((w) => w.withPnl > 0)
  const byDay = groupPnlBy(trades, dayKey).filter((d) => d.withPnl > 0)

  const pctPositive = (rows) => (rows.length ? (rows.filter((r) => r.pnl > 0).length / rows.length) * 100 : null)

  const monthly = byMonth.map((m) => m.pnl)
  const m = mean(monthly)
  const sd = stdev(monthly)
  // Coefficient of variation on monthly P&L, inverted into a 0-100 score.
  const cv = sd != null && m && m !== 0 ? Math.abs(sd / m) : null
  const score = cv == null ? null : Math.round(Math.max(0, Math.min(100, 100 / (1 + cv))))

  // How much of total profit came from the single best month — a high
  // number means the record leans on one lucky stretch.
  const totalProfit = sum(monthly.filter((v) => v > 0))
  const bestMonth = monthly.length ? Math.max(...monthly) : null
  const topMonthShare = totalProfit > 0 && bestMonth > 0 ? (bestMonth / totalProfit) * 100 : null

  return {
    score,
    cv,
    profitableMonthsPct: pctPositive(byMonth),
    profitableWeeksPct: pctPositive(byWeek),
    profitableDaysPct: pctPositive(byDay),
    monthCount: byMonth.length,
    weekCount: byWeek.length,
    dayCount: byDay.length,
    topMonthShare,
    byMonth,
    byWeek,
    byDay,
  }
}

/** Best and worst single day / week / month by net P&L. */
export function getPeriodExtremes(trades) {
  const pick = (rows) => {
    const scoped = rows.filter((r) => r.withPnl > 0)
    if (!scoped.length) return { best: null, worst: null }
    const sorted = [...scoped].sort((a, b) => b.pnl - a.pnl)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }
  return {
    day: pick(groupPnlBy(trades, dayKey)),
    week: pick(groupPnlBy(trades, weekKey)),
    month: pick(groupPnlBy(trades, monthKey)),
  }
}

// ---------------------------------------------------------------------
// 5. Rolling windows & edge decay
// ---------------------------------------------------------------------

/** Rolling win rate and rolling net P&L over a sliding window of trades. */
export function getRollingMetrics(trades, window = 10) {
  const rows = sortChrono(trades)
  if (rows.length < window) return []
  const out = []
  for (let i = window - 1; i < rows.length; i++) {
    const slice = rows.slice(i - window + 1, i + 1)
    const outcomes = slice.map(outcomeOf)
    const wins = outcomes.filter((o) => o === 'win').length
    const losses = outcomes.filter((o) => o === 'loss').length
    const resolved = wins + losses
    const pnl = slice.filter(hasPnl).reduce((a, t) => a + pnlOf(t), 0)
    out.push({
      index: i + 1,
      date: parseDate(rows[i]),
      winRate: resolved ? (wins / resolved) * 100 : null,
      pnl,
      label: stockLabel(rows[i]),
    })
  }
  return out
}

/**
 * Edge decay — splits the log in half chronologically and compares. If the
 * second half is materially worse, the edge is fading (or the market
 * regime changed) and that's worth knowing before scaling size up.
 */
export function getEdgeDecay(trades) {
  const rows = sortChrono(trades)
  if (rows.length < 8) return { available: false, sampleSize: rows.length }
  const mid = Math.floor(rows.length / 2)
  const first = rows.slice(0, mid)
  const second = rows.slice(mid)

  const summarise = (chunk) => {
    const perf = getPerformance(chunk)
    return {
      count: chunk.length,
      winRate: perf.winRate,
      expectancy: perf.expectancy,
      profitFactor: perf.profitFactor,
      netPnl: perf.netPnl,
      from: chunk.length ? parseDate(chunk[0]) : null,
      to: chunk.length ? parseDate(chunk[chunk.length - 1]) : null,
    }
  }

  const a = summarise(first)
  const b = summarise(second)
  const delta = (x, y) => (x == null || y == null ? null : y - x)

  // Slope of per-trade P&L over time — a second, independent read on the
  // same question that doesn't depend on where the halfway point falls.
  const slope = linearTrend(rows.filter(hasPnl).map(pnlOf))

  return {
    available: true,
    first: a,
    second: b,
    winRateDelta: delta(a.winRate, b.winRate),
    expectancyDelta: delta(a.expectancy, b.expectancy),
    profitFactorDelta: delta(a.profitFactor, b.profitFactor),
    slope: slope ? slope.slope : null,
    verdict:
      delta(a.expectancy, b.expectancy) == null
        ? 'Not enough P&L logged to compare halves'
        : delta(a.expectancy, b.expectancy) > 0
          ? 'Improving — the recent half is stronger'
          : delta(a.expectancy, b.expectancy) < 0
            ? 'Fading — the recent half is weaker'
            : 'Flat across both halves',
    sampleSize: rows.length,
  }
}

// ---------------------------------------------------------------------
// 6. Distribution shapes
// ---------------------------------------------------------------------

export function getPnlDistribution(trades, bins = 12) {
  const values = pnlSeries(trades)
  return { bins: histogram(values, bins), values, box: quartiles(values) }
}

export function getRDistribution(trades) {
  const rs = getRMultiples(trades).map((r) => r.r)
  if (!rs.length) return { buckets: [], sampleSize: 0 }
  // Open-ended outer buckets carry `null` bounds rather than ±Infinity —
  // an Infinity that leaks into a label or a chart scale renders as
  // "Infinity" on screen, and there's no reason to risk it.
  const edges = [-3, -2, -1, 0, 1, 2, 3]
  const labels = ['< -3R', '-3 to -2R', '-2 to -1R', '-1 to 0R', '0 to 1R', '1 to 2R', '2 to 3R', '> 3R']
  const buckets = labels.map((label, i) => ({
    label,
    from: i === 0 ? null : edges[i - 1],
    to: i === labels.length - 1 ? null : edges[i],
    count: 0,
  }))
  rs.forEach((r) => {
    let idx = edges.findIndex((e) => r <= e)
    if (idx === -1) idx = labels.length - 1
    buckets[idx].count += 1
  })
  return { buckets, sampleSize: rs.length, avgR: mean(rs), bestR: Math.max(...rs), worstR: Math.min(...rs) }
}

/** Trades sitting outside the Tukey fences — the ones skewing every average. */
export function getOutliers(trades) {
  const withPnl = sortChrono(trades).filter(hasPnl)
  const values = withPnl.map(pnlOf)
  const box = quartiles(values)
  if (!box) return { outliers: [], box: null, sampleSize: values.length }
  const outliers = withPnl
    .filter((t) => pnlOf(t) < box.lowerFence || pnlOf(t) > box.upperFence)
    .map((t) => ({
      id: t.id,
      name: stockLabel(t),
      pnl: pnlOf(t),
      date: parseDate(t),
      side: pnlOf(t) > box.upperFence ? 'high' : 'low',
    }))
  // What the record looks like with those trades removed — the honest
  // "is this edge real or was it one lucky Tuesday" check.
  const trimmed = withPnl.filter((t) => pnlOf(t) >= box.lowerFence && pnlOf(t) <= box.upperFence)
  return {
    outliers,
    box,
    sampleSize: values.length,
    netWithout: sum(trimmed.map(pnlOf)),
    netWith: sum(values),
    expectancyWithout: trimmed.length ? sum(trimmed.map(pnlOf)) / trimmed.length : null,
  }
}

/** Cumulative distribution — share of trades at or below each P&L level. */
export function getCdf(trades, points = 24) {
  const values = pnlSeries(trades).sort((a, b) => a - b)
  if (values.length < 2) return []
  const out = []
  for (let i = 0; i < points; i++) {
    const p = (i / (points - 1)) * 100
    out.push({ pct: p, value: percentile(values, p) })
  }
  return out
}

// ---------------------------------------------------------------------
// 7. Monte Carlo — bootstrap resampling of the person's own trades
// ---------------------------------------------------------------------

/**
 * Reshuffles the ACTUAL logged P&L values thousands of times to ask: given
 * this exact set of results, how much did sequence luck matter? Nothing is
 * invented — every simulated trade is one the person really took, just in
 * a different order (sampled with replacement).
 *
 * Returns percentile bands of the final equity, the drawdown distribution,
 * and the probability of finishing profitable.
 */
export function runMonteCarlo(trades, { runs = 1000, horizon = null, seed = 20260919 } = {}) {
  const values = pnlSeries(trades)
  if (values.length < 5) return { available: false, sampleSize: values.length }

  const steps = horizon || values.length
  const rand = seededRandom(seed)
  const finals = []
  const maxDraws = []
  let profitable = 0

  // A handful of full paths are kept for the fan chart; keeping all 1000
  // would be megabytes of arrays for no visual gain.
  const keptPaths = []
  const keepEvery = Math.max(1, Math.floor(runs / 40))

  for (let r = 0; r < runs; r++) {
    let equity = 0
    let peak = 0
    let maxDd = 0
    const path = r % keepEvery === 0 ? [0] : null
    for (let s = 0; s < steps; s++) {
      const pick = values[Math.floor(rand() * values.length)]
      equity += pick
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > maxDd) maxDd = dd
      if (path) path.push(equity)
    }
    finals.push(equity)
    maxDraws.push(maxDd)
    if (equity > 0) profitable += 1
    if (path) keptPaths.push(path)
  }

  const band = (p) => percentile(finals, p)

  return {
    available: true,
    runs,
    steps,
    sampleSize: values.length,
    finals,
    paths: keptPaths,
    p5: band(5),
    p25: band(25),
    median: band(50),
    p75: band(75),
    p95: band(95),
    mean: mean(finals),
    best: Math.max(...finals),
    worst: Math.min(...finals),
    probProfitablePct: (profitable / runs) * 100,
    medianMaxDrawdown: median(maxDraws),
    worstMaxDrawdown: Math.max(...maxDraws),
    p95MaxDrawdown: percentile(maxDraws, 95),
    actualFinal: sum(values),
  }
}

// ---------------------------------------------------------------------
// 8. "What if" — removing the extremes
// ---------------------------------------------------------------------

/**
 * Recomputes the headline numbers with the best N and worst N trades
 * dropped. Answers the two questions every review should ask: "would I
 * still be green without my luckiest trades?" and "how much did my worst
 * mistakes actually cost?"
 */
export function getWhatIf(trades, n = 3) {
  const withPnl = trades.filter(hasPnl)
  if (withPnl.length <= n * 2) return { available: false, sampleSize: withPnl.length }
  const sorted = [...withPnl].sort((a, b) => pnlOf(b) - pnlOf(a))
  const topN = sorted.slice(0, n)
  const bottomN = sorted.slice(-n)
  const topIds = new Set(topN.map((t) => t.id))
  const bottomIds = new Set(bottomN.map((t) => t.id))

  const base = getPerformance(withPnl)
  const noBest = getPerformance(withPnl.filter((t) => !topIds.has(t.id)))
  const noWorst = getPerformance(withPnl.filter((t) => !bottomIds.has(t.id)))
  const noBoth = getPerformance(withPnl.filter((t) => !topIds.has(t.id) && !bottomIds.has(t.id)))

  return {
    available: true,
    n,
    sampleSize: withPnl.length,
    base,
    noBest,
    noWorst,
    noBoth,
    topTrades: topN.map((t) => ({ id: t.id, name: stockLabel(t), pnl: pnlOf(t), date: parseDate(t) })),
    bottomTrades: bottomN.map((t) => ({ id: t.id, name: stockLabel(t), pnl: pnlOf(t), date: parseDate(t) })),
    stillProfitableWithoutBest: noBest.netPnl > 0,
  }
}

export { correlation, mean, median, percentile, safeDiv, stdev, sum, clean }
