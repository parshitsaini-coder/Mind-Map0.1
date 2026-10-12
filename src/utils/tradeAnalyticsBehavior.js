// Trade Analysis — behavioural & discipline analytics.
//
// The metrics here are about the trader, not the market: what happens
// after a loss, whether the checklist is doing any work, whether size and
// frequency drift when things go badly. All of it is derived from fields
// the journal already stores (date, createdAt, pnl, status,
// validationRuleIds, validationScore) — nothing is asked of the person
// twice, and nothing is invented.

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

/**
 * Win rate and average P&L split by what happened on the PREVIOUS trade.
 * A big gap between "after a win" and "after a loss" is the clearest
 * numeric fingerprint of tilt — the setup didn't change, the trader did.
 */
export function getSequenceBehavior(trades) {
  const rows = sortChrono(trades)
  const afterWin = []
  const afterLoss = []

  for (let i = 1; i < rows.length; i++) {
    const prev = outcomeOf(rows[i - 1])
    if (prev === 'win') afterWin.push(rows[i])
    else if (prev === 'loss') afterLoss.push(rows[i])
  }

  const summarise = (chunk) => {
    const wins = chunk.filter((t) => outcomeOf(t) === 'win').length
    const losses = chunk.filter((t) => outcomeOf(t) === 'loss').length
    const withPnl = chunk.filter(hasPnl)
    const net = sum(withPnl.map(pnlOf))
    const scores = chunk.map(scorePct).filter((v) => v !== null)
    return {
      count: chunk.length,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
      avgPnl: withPnl.length ? net / withPnl.length : null,
      netPnl: net,
      avgScore: scores.length ? mean(scores) : null,
    }
  }

  const win = summarise(afterWin)
  const loss = summarise(afterLoss)
  const gap = win.winRate != null && loss.winRate != null ? win.winRate - loss.winRate : null

  return {
    afterWin: win,
    afterLoss: loss,
    winRateGap: gap,
    // Fewer than 5 trades on either side isn't a pattern, it's noise.
    reliable: win.count >= 5 && loss.count >= 5,
    verdict:
      gap == null || win.count < 5 || loss.count < 5
        ? 'Needs 5+ trades after both a win and a loss'
        : Math.abs(gap) < 10
          ? 'Steady — outcomes barely move your next trade'
          : gap > 0
            ? 'You trade worse after a loss'
            : 'You trade worse after a win',
  }
}

/**
 * Revenge-trading signal: a trade opened the same day as, or the day
 * after, a loss — and how those trades actually performed against the
 * baseline. The label only sticks if the numbers back it up.
 */
export function getRevengeTrading(trades) {
  const rows = sortChrono(trades)
  const flagged = []

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    if (outcomeOf(prev) !== 'loss') continue
    const gapDays = Math.round((parseDate(rows[i]) - parseDate(prev)) / 86400000)
    if (gapDays <= 1) flagged.push({ trade: rows[i], gapDays, after: prev })
  }

  const flaggedIds = new Set(flagged.map((f) => f.trade.id))
  const others = rows.filter((t) => !flaggedIds.has(t.id))

  const rate = (chunk) => {
    const w = chunk.filter((t) => outcomeOf(t) === 'win').length
    const l = chunk.filter((t) => outcomeOf(t) === 'loss').length
    return w + l ? (w / (w + l)) * 100 : null
  }
  const avg = (chunk) => {
    const withPnl = chunk.filter(hasPnl)
    return withPnl.length ? sum(withPnl.map(pnlOf)) / withPnl.length : null
  }

  const flaggedTrades = flagged.map((f) => f.trade)
  const flaggedWr = rate(flaggedTrades)
  const baselineWr = rate(others)

  return {
    count: flagged.length,
    flagged: flagged.slice(0, 8).map((f) => ({
      id: f.trade.id,
      name: stockLabel(f.trade),
      date: parseDate(f.trade),
      gapDays: f.gapDays,
      outcome: outcomeOf(f.trade),
      pnl: hasPnl(f.trade) ? pnlOf(f.trade) : null,
    })),
    flaggedWinRate: flaggedWr,
    baselineWinRate: baselineWr,
    flaggedAvgPnl: avg(flaggedTrades),
    baselineAvgPnl: avg(others),
    penalty: flaggedWr != null && baselineWr != null ? flaggedWr - baselineWr : null,
    reliable: flagged.length >= 4,
  }
}

/**
 * Overtrading: days with an unusually high trade count, measured against
 * the person's own median active day rather than a hard-coded number —
 * three trades is a quiet day for a scalper and a frenzy for a swing
 * trader.
 */
export function getOvertrading(trades) {
  const byDay = new Map()
  sortChrono(trades).forEach((t) => {
    const key = dayKey(parseDate(t))
    if (!byDay.has(key)) byDay.set(key, { key, date: parseDate(t), trades: [], pnl: 0, withPnl: 0 })
    const row = byDay.get(key)
    row.trades.push(t)
    if (hasPnl(t)) {
      row.pnl += pnlOf(t)
      row.withPnl += 1
    }
  })

  const days = [...byDay.values()]
  if (days.length < 4) return { available: false, days: days.length }

  const counts = days.map((d) => d.trades.length)
  const avgCount = mean(counts)
  const sd = stdev(counts) || 0
  // One standard deviation above the personal average, floored at 3 so a
  // very regular trader doesn't get flagged for a second trade.
  const threshold = Math.max(3, Math.ceil(avgCount + sd))

  const heavy = days.filter((d) => d.trades.length >= threshold)
  const normal = days.filter((d) => d.trades.length < threshold)

  const dayPnl = (list) => {
    const withPnl = list.filter((d) => d.withPnl > 0)
    return withPnl.length ? mean(withPnl.map((d) => d.pnl)) : null
  }

  return {
    available: true,
    threshold,
    avgPerActiveDay: avgCount,
    heavyDays: heavy.length,
    totalActiveDays: days.length,
    heavyDayAvgPnl: dayPnl(heavy),
    normalDayAvgPnl: dayPnl(normal),
    worstHeavyDay: heavy.length ? [...heavy].sort((a, b) => a.pnl - b.pnl)[0] : null,
    heavyList: [...heavy]
      .sort((a, b) => b.trades.length - a.trades.length)
      .slice(0, 6)
      .map((d) => ({ key: d.key, date: d.date, count: d.trades.length, pnl: d.withPnl ? d.pnl : null })),
  }
}

/**
 * Does ticking more boxes actually lead to better trades? Correlates each
 * trade's checklist score against its outcome (1 = win, 0 = loss) and
 * against its P&L. This is the single most valuable thing the validation
 * system can tell someone, and until now the app never asked it.
 */
export function getDisciplineImpact(trades) {
  const scored = trades.filter((t) => scorePct(t) !== null)
  const resolved = scored.filter((t) => ['win', 'loss'].includes(outcomeOf(t)))

  if (resolved.length < 5) {
    return { available: false, sampleSize: resolved.length, avgScore: scored.length ? mean(scored.map(scorePct)) : null }
  }

  const scores = resolved.map(scorePct)
  const outcomes = resolved.map((t) => (outcomeOf(t) === 'win' ? 1 : 0))
  const outcomeCorr = correlation(scores, outcomes)

  const withPnl = scored.filter(hasPnl)
  const pnlCorr = withPnl.length >= 5 ? correlation(withPnl.map(scorePct), withPnl.map(pnlOf)) : null

  // Split at the median score so the comparison is balanced by design.
  const sortedScores = [...scores].sort((a, b) => a - b)
  const cut = sortedScores[Math.floor(sortedScores.length / 2)]
  const high = resolved.filter((t) => scorePct(t) >= cut)
  const low = resolved.filter((t) => scorePct(t) < cut)

  const wr = (chunk) => {
    const w = chunk.filter((t) => outcomeOf(t) === 'win').length
    return chunk.length ? (w / chunk.length) * 100 : null
  }

  return {
    available: true,
    sampleSize: resolved.length,
    avgScore: mean(scores),
    outcomeCorr,
    pnlCorr,
    cut,
    highScoreWinRate: wr(high),
    lowScoreWinRate: wr(low),
    highCount: high.length,
    lowCount: low.length,
    lift: wr(high) != null && wr(low) != null ? wr(high) - wr(low) : null,
    verdict:
      outcomeCorr == null
        ? 'Not enough scored trades yet'
        : outcomeCorr > 0.25
          ? 'Your checklist is working — higher scores win more'
          : outcomeCorr < -0.25
            ? 'Higher-scored trades are losing more — the rules may need a rethink'
            : 'No clear link between checklist score and outcome yet',
  }
}

/**
 * Finds the checklist score threshold that would have produced the best
 * win rate, subject to leaving a usable number of trades behind. Returns
 * the full curve so the widget can draw it, not just the winner.
 */
export function getThresholdCurve(trades) {
  const resolved = trades.filter((t) => scorePct(t) !== null && ['win', 'loss'].includes(outcomeOf(t)))
  if (resolved.length < 6) return { available: false, sampleSize: resolved.length, curve: [] }

  const curve = []
  for (let cut = 0; cut <= 100; cut += 10) {
    const kept = resolved.filter((t) => scorePct(t) >= cut)
    const wins = kept.filter((t) => outcomeOf(t) === 'win').length
    const withPnl = kept.filter(hasPnl)
    curve.push({
      cut,
      kept: kept.length,
      keptPct: (kept.length / resolved.length) * 100,
      winRate: kept.length ? (wins / kept.length) * 100 : null,
      netPnl: sum(withPnl.map(pnlOf)),
      expectancy: withPnl.length ? sum(withPnl.map(pnlOf)) / withPnl.length : null,
    })
  }

  // Best threshold that still keeps at least a third of the trades —
  // a 100% win rate on the two remaining trades is not a strategy.
  const viable = curve.filter((c) => c.keptPct >= 33 && c.winRate != null)
  const best = viable.length ? [...viable].sort((a, b) => b.winRate - a.winRate)[0] : null
  const baseline = curve[0]

  return {
    available: true,
    sampleSize: resolved.length,
    curve,
    best,
    baseline,
    gain: best && baseline?.winRate != null ? best.winRate - baseline.winRate : null,
  }
}

/**
 * Per-rule effectiveness. For each validation rule: win rate on trades
 * where it was ticked vs trades where it wasn't, and the difference
 * ("lift"). A rule with a negative lift is either wrong or is being
 * ticked as a formality — both worth knowing.
 */
export function getRuleEffectiveness(trades, validationRules, validationCategories = []) {
  const resolved = trades.filter((t) => ['win', 'loss'].includes(outcomeOf(t)))
  const catById = new Map(validationCategories.map((c) => [c.id, c.name]))

  const rows = validationRules.map((rule) => {
    const withRule = resolved.filter((t) => (t.validationRuleIds || []).includes(rule.id))
    const withoutRule = resolved.filter((t) => !(t.validationRuleIds || []).includes(rule.id))

    const wr = (chunk) => {
      const w = chunk.filter((t) => outcomeOf(t) === 'win').length
      return chunk.length ? (w / chunk.length) * 100 : null
    }
    const avgPnl = (chunk) => {
      const p = chunk.filter(hasPnl)
      return p.length ? sum(p.map(pnlOf)) / p.length : null
    }

    const a = wr(withRule)
    const b = wr(withoutRule)

    return {
      id: rule.id,
      label: rule.label,
      category: catById.get(rule.categoryId) || 'Uncategorised',
      active: rule.active,
      usedCount: withRule.length,
      usedPct: resolved.length ? (withRule.length / resolved.length) * 100 : 0,
      winRateWith: a,
      winRateWithout: b,
      lift: a != null && b != null ? a - b : null,
      avgPnlWith: avgPnl(withRule),
      avgPnlWithout: avgPnl(withoutRule),
      // 5 observations on each side is the floor for saying anything.
      reliable: withRule.length >= 5 && withoutRule.length >= 5,
    }
  })

  const ranked = [...rows].sort((a, b) => (b.lift ?? -999) - (a.lift ?? -999))
  const reliable = ranked.filter((r) => r.reliable)

  return {
    rows: ranked,
    best: reliable.slice(0, 5),
    worst: reliable.slice(-5).reverse(),
    reliableCount: reliable.length,
    resolvedCount: resolved.length,
    // Rules nobody ever ticks are dead weight in the checklist.
    unused: rows.filter((r) => r.usedCount === 0 && r.active),
  }
}

/**
 * Discipline score, 0-100. Blends checklist adherence, how consistently
 * it's applied (low variance in scores), and how often trades get logged
 * without any score at all.
 */
export function getDisciplineScore(trades) {
  if (!trades.length) return { score: null, grade: null }
  const scores = trades.map(scorePct).filter((v) => v !== null)
  const coverage = (scores.length / trades.length) * 100
  const avg = scores.length ? mean(scores) : 0
  const sd = scores.length > 1 ? stdev(scores) : 0
  // Lower spread = more consistent process. 40 points of spread is the
  // point where consistency credit runs out entirely.
  const consistency = Math.max(0, 100 - (sd || 0) * 2.5)

  const score = Math.round(avg * 0.5 + coverage * 0.25 + consistency * 0.25)
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'E'

  return {
    score,
    grade,
    avgScore: scores.length ? avg : null,
    coverage,
    consistency,
    scoredCount: scores.length,
    unscoredCount: trades.length - scores.length,
    spread: sd,
  }
}

/**
 * Risk-size drift — whether position value creeps up after wins or after
 * losses. Uses `price` as the size proxy (the form's one numeric size
 * field), normalised per instrument so a ₹3,200 stock and a $4,400 gold
 * quote don't get compared directly.
 */
export function getSizeDrift(trades) {
  const rows = sortChrono(trades).filter((t) => Number.isFinite(Number(t.price)) && Number(t.price) > 0)
  if (rows.length < 6) return { available: false, sampleSize: rows.length }

  // Normalise each price against the median price for that instrument.
  const byInstrument = new Map()
  rows.forEach((t) => {
    const k = stockLabel(t)
    if (!byInstrument.has(k)) byInstrument.set(k, [])
    byInstrument.get(k).push(Number(t.price))
  })
  const medians = new Map(
    [...byInstrument.entries()].map(([k, list]) => {
      const sorted = [...list].sort((a, b) => a - b)
      return [k, sorted[Math.floor(sorted.length / 2)]]
    })
  )

  const normalised = rows.map((t) => ({
    trade: t,
    rel: Number(t.price) / (medians.get(stockLabel(t)) || Number(t.price)),
  }))

  const afterWin = []
  const afterLoss = []
  for (let i = 1; i < normalised.length; i++) {
    const prev = outcomeOf(normalised[i - 1].trade)
    if (prev === 'win') afterWin.push(normalised[i].rel)
    else if (prev === 'loss') afterLoss.push(normalised[i].rel)
  }

  return {
    available: afterWin.length >= 3 && afterLoss.length >= 3,
    sampleSize: rows.length,
    relAfterWin: afterWin.length ? mean(afterWin) : null,
    relAfterLoss: afterLoss.length ? mean(afterLoss) : null,
    overallSpread: stdev(normalised.map((n) => n.rel)),
    afterWinCount: afterWin.length,
    afterLossCount: afterLoss.length,
  }
}

/**
 * Keyword frequency from trade notes, split by outcome. Words that show
 * up far more often in losers than winners are the trader's own tells,
 * written in their own words.
 */
const STOP_WORDS = new Set(
  ('a an the and or but if then than that this these those i me my we our you your it its is was were be been being ' +
    'of in on at to for from with by as so do did does not no yes very just also too much many more most some any ' +
    'there here up down out over under again once about into after before while during because until when where ' +
    'which who whom what how why all both each few other such only own same s t can will would should could may ' +
    'might must got get went had has have trade traded trading entry exit took take taken setup')
    .split(' ')
)

export function getNotesKeywords(trades, limit = 18) {
  const counts = new Map()
  let notesCount = 0

  trades.forEach((t) => {
    const text = (t.notes || '').toLowerCase()
    if (!text.trim()) return
    notesCount += 1
    const outcome = outcomeOf(t)
    const seen = new Set()
    text
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
      .forEach((w) => {
        if (seen.has(w)) return // count each word once per note
        seen.add(w)
        if (!counts.has(w)) counts.set(w, { word: w, total: 0, wins: 0, losses: 0, pnl: 0, withPnl: 0 })
        const row = counts.get(w)
        row.total += 1
        if (outcome === 'win') row.wins += 1
        if (outcome === 'loss') row.losses += 1
        if (hasPnl(t)) {
          row.pnl += pnlOf(t)
          row.withPnl += 1
        }
      })
  })

  const rows = [...counts.values()]
    .filter((r) => r.total >= 2)
    .map((r) => ({
      ...r,
      winRate: r.wins + r.losses ? (r.wins / (r.wins + r.losses)) * 100 : null,
      avgPnl: r.withPnl ? r.pnl / r.withPnl : null,
    }))
    .sort((a, b) => b.total - a.total)

  return { rows: rows.slice(0, limit), notesCount, uniqueWords: counts.size }
}
