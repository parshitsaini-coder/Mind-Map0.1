// Trade Analysis — the insights engine.
//
// Reads every other analytics module and writes plain-English findings
// about this specific trade log. Each insight carries the numbers it was
// derived from, so nothing here is a vague platitude — if it says the
// checklist is working it can point at the win-rate gap that proves it.
//
// Rules this engine holds itself to:
//   1. Never fire on thin data. Every check has a minimum sample size and
//      stays silent below it. Silence is more useful than a confident
//      conclusion drawn from four trades.
//   2. Never invent a number. Every value in a message comes from a real
//      computed statistic.
//   3. Lead with what's actionable, not what's flattering.

import {
  getConsistency, getDrawdownStats, getEdgeDecay, getKelly, getOutliers, getPerformance, getRiskRatios, getStreakStats, getWhatIf, getZScore, hasPnl, parseDate, isPending, stockLabel,
} from './tradeAnalyticsPro'
import {
  getDisciplineImpact, getDisciplineScore, getOvertrading, getRevengeTrading, getRuleEffectiveness, getSequenceBehavior, getThresholdCurve,
} from './tradeAnalyticsBehavior'
import { getConcentration, getPerformerSpotlight } from './tradeAnalyticsEdge'
import { getCadenceStats, getDayOfWeekStats, getHoldingPeriodStats, getSessionStats } from './tradeAnalyticsTime'
import { splitTradesByCurrency } from './currency'

const SEVERITY_ORDER = { critical: 0, warning: 1, opportunity: 2, positive: 3, info: 4 }

const money = (v, symbol) => {
  if (v == null) return '—'
  const n = Math.round(v)
  return `${n < 0 ? '-' : ''}${symbol}${Math.abs(n).toLocaleString('en-IN')}`
}

const pct = (v, d = 0) => (v == null ? '—' : `${v.toFixed(d)}%`)

/**
 * Builds the insight list. `groupLabel`/`symbol` describe which currency
 * group the money-denominated trades belong to, because an insight that
 * says "you're down ₹4,200" must never be computed from a mixed list.
 */
function currencyInsights(trades, symbol, groupLabel) {
  const out = []
  const withPnl = trades.filter(hasPnl)
  if (withPnl.length < 3) return out

  const perf = getPerformance(trades)
  const dd = getDrawdownStats(trades)
  const ratios = getRiskRatios(trades)
  const kelly = getKelly(trades)
  const whatIf = getWhatIf(trades, Math.max(1, Math.floor(withPnl.length / 10)))
  const outliers = getOutliers(trades)
  const consistency = getConsistency(trades)
  const decay = getEdgeDecay(trades)

  // ── Profit factor ────────────────────────────────────────────────
  if (perf.profitFactor != null && withPnl.length >= 8) {
    if (perf.profitFactor < 1) {
      out.push({
        id: `pf-neg-${groupLabel}`,
        severity: 'critical',
        title: `${groupLabel}: losing more than you win`,
        body: `Profit factor is ${perf.profitFactor.toFixed(2)} across ${withPnl.length} trades — ${money(perf.grossProfit, symbol)} won against ${money(perf.grossLoss, symbol)} lost. Anything under 1.00 means the system gives back more than it takes.`,
        metric: perf.profitFactor.toFixed(2),
        metricLabel: 'Profit factor',
      })
    } else if (perf.profitFactor >= 1.75) {
      out.push({
        id: `pf-good-${groupLabel}`,
        severity: 'positive',
        title: `${groupLabel}: profit factor is holding up`,
        body: `${perf.profitFactor.toFixed(2)} over ${withPnl.length} trades — every ${symbol}1 lost is matched by ${symbol}${perf.profitFactor.toFixed(2)} won. Expectancy is ${money(perf.expectancy, symbol)} per trade.`,
        metric: perf.profitFactor.toFixed(2),
        metricLabel: 'Profit factor',
      })
    }
  }

  // ── Payoff vs win rate tension ───────────────────────────────────
  if (perf.payoffRatio != null && perf.winRate != null && withPnl.length >= 10) {
    if (perf.winRate >= 55 && perf.payoffRatio < 0.8) {
      out.push({
        id: `payoff-${groupLabel}`,
        severity: 'warning',
        title: `${groupLabel}: winning often, but small`,
        body: `You win ${pct(perf.winRate)} of the time yet the average winner (${money(perf.avgWin, symbol)}) is smaller than the average loser (${money(perf.avgLoss, symbol)}). One bad run erases a long streak of small wins.`,
        metric: perf.payoffRatio.toFixed(2),
        metricLabel: 'Payoff ratio',
      })
    } else if (perf.winRate < 45 && perf.payoffRatio >= 1.8) {
      out.push({
        id: `payoff-low-wr-${groupLabel}`,
        severity: 'info',
        title: `${groupLabel}: low win rate, big winners`,
        body: `A ${pct(perf.winRate)} win rate works here because winners run ${perf.payoffRatio.toFixed(2)}× bigger than losers. The risk is cutting a winner short — that ratio is what the whole edge rests on.`,
        metric: perf.payoffRatio.toFixed(2),
        metricLabel: 'Payoff ratio',
      })
    }
  }

  // ── Drawdown ─────────────────────────────────────────────────────
  if (dd.maxDrawdown != null && dd.maxDrawdown < 0 && perf.netPnl !== 0) {
    const ddSize = Math.abs(dd.maxDrawdown)
    if (perf.netPnl > 0 && ddSize > perf.netPnl) {
      out.push({
        id: `dd-deep-${groupLabel}`,
        severity: 'warning',
        title: `${groupLabel}: drawdown is larger than the profit`,
        body: `The worst peak-to-trough fall was ${money(dd.maxDrawdown, symbol)} while net profit stands at ${money(perf.netPnl, symbol)}. Recovery factor of ${dd.recoveryFactor?.toFixed(2) ?? '—'} means the account works hard to stand still.`,
        metric: money(dd.maxDrawdown, symbol),
        metricLabel: 'Max drawdown',
      })
    }
    if (dd.inDrawdown && dd.currentDrawdown < 0) {
      out.push({
        id: `dd-now-${groupLabel}`,
        severity: 'info',
        title: `${groupLabel}: currently below the high-water mark`,
        body: `Down ${money(dd.currentDrawdown, symbol)} from the peak${dd.currentDrawdownPct != null ? ` (${pct(dd.currentDrawdownPct, 1)})` : ''}. The longest stretch under water so far ran ${dd.longestDrawdownTrades} trades.`,
        metric: money(dd.currentDrawdown, symbol),
        metricLabel: 'Current drawdown',
      })
    }
  }

  // ── Outlier dependence ───────────────────────────────────────────
  if (outliers.outliers.length && outliers.netWith != null && outliers.netWithout != null) {
    const highs = outliers.outliers.filter((o) => o.side === 'high')
    if (highs.length && outliers.netWith > 0 && outliers.netWithout <= 0) {
      out.push({
        id: `outlier-${groupLabel}`,
        severity: 'warning',
        title: `${groupLabel}: the record leans on ${highs.length} outlier${highs.length > 1 ? 's' : ''}`,
        body: `Strip out the statistically extreme trades and ${money(outliers.netWith, symbol)} of profit becomes ${money(outliers.netWithout, symbol)}. The base system isn't carrying itself yet.`,
        metric: `${highs.length}`,
        metricLabel: 'Outlier wins',
      })
    }
  }

  // ── Best-trade dependence ────────────────────────────────────────
  if (whatIf.available && whatIf.base.netPnl > 0 && !whatIf.stillProfitableWithoutBest) {
    out.push({
      id: `whatif-${groupLabel}`,
      severity: 'warning',
      title: `${groupLabel}: profit rests on the top ${whatIf.n} trade${whatIf.n > 1 ? 's' : ''}`,
      body: `Remove them and ${money(whatIf.base.netPnl, symbol)} turns into ${money(whatIf.noBest.netPnl, symbol)}. Worth checking whether those trades were repeatable setups or one-offs.`,
      metric: money(whatIf.noBest.netPnl, symbol),
      metricLabel: 'Without top trades',
    })
  }

  // ── Risk-adjusted quality ────────────────────────────────────────
  if (ratios.sharpe != null && ratios.sampleSize >= 15) {
    if (ratios.sharpe < 0.1 && perf.netPnl > 0) {
      out.push({
        id: `sharpe-${groupLabel}`,
        severity: 'info',
        title: `${groupLabel}: returns are noisy relative to their size`,
        body: `Per-trade Sharpe is ${ratios.sharpe.toFixed(2)} — results swing far more than they trend. Sizing down usually improves the ride more than it costs in profit.`,
        metric: ratios.sharpe.toFixed(2),
        metricLabel: 'Sharpe (per trade)',
      })
    } else if (ratios.sharpe >= 0.4) {
      out.push({
        id: `sharpe-good-${groupLabel}`,
        severity: 'positive',
        title: `${groupLabel}: steady risk-adjusted returns`,
        body: `Per-trade Sharpe of ${ratios.sharpe.toFixed(2)} with a Sortino of ${ratios.sortino?.toFixed(2) ?? '—'} — the downside is well contained relative to the average result.`,
        metric: ratios.sharpe.toFixed(2),
        metricLabel: 'Sharpe (per trade)',
      })
    }
  }

  // ── Fat tails ────────────────────────────────────────────────────
  if (ratios.kurt != null && ratios.kurt > 3 && ratios.sampleSize >= 20) {
    out.push({
      id: `kurt-${groupLabel}`,
      severity: 'info',
      title: `${groupLabel}: results have fat tails`,
      body: `Excess kurtosis of ${ratios.kurt.toFixed(1)} means rare trades land far outside the normal range. Position sizing off the average understates what a bad one can do — the worst 5% averages ${money(ratios.cvar95, symbol)}.`,
      metric: ratios.kurt.toFixed(1),
      metricLabel: 'Excess kurtosis',
    })
  }

  // ── Position sizing vs Kelly ─────────────────────────────────────
  if (kelly.kellyPct != null && kelly.sampleSize >= 20) {
    if (kelly.kellyPct <= 0) {
      out.push({
        id: `kelly-neg-${groupLabel}`,
        severity: 'critical',
        title: `${groupLabel}: no mathematical edge yet`,
        body: `With a ${pct(kelly.winRate)} win rate and a ${kelly.payoffRatio?.toFixed(2)} payoff, the Kelly fraction is negative — the optimal bet size for this system as it stands is zero. Paper-trade the changes before sizing back up.`,
        metric: pct(kelly.kellyPct, 1),
        metricLabel: 'Kelly fraction',
      })
    } else if (kelly.kellyPct > 0) {
      out.push({
        id: `kelly-${groupLabel}`,
        severity: 'opportunity',
        title: `${groupLabel}: edge supports ${pct(kelly.halfKellyPct, 1)} risk per trade`,
        body: `Full Kelly on this record is ${pct(kelly.kellyPct, 1)}; half-Kelly (${pct(kelly.halfKellyPct, 1)}) is the practical ceiling most traders use, since Kelly assumes the win rate holds exactly.`,
        metric: pct(kelly.halfKellyPct, 1),
        metricLabel: 'Half-Kelly risk',
      })
    }
  }

  // ── Consistency ──────────────────────────────────────────────────
  if (consistency.topMonthShare != null && consistency.monthCount >= 3 && consistency.topMonthShare > 70) {
    out.push({
      id: `consistency-${groupLabel}`,
      severity: 'warning',
      title: `${groupLabel}: one month is doing the heavy lifting`,
      body: `${pct(consistency.topMonthShare)} of all profit came from a single month across ${consistency.monthCount} months traded. Only ${pct(consistency.profitableMonthsPct)} of months finished green.`,
      metric: pct(consistency.topMonthShare),
      metricLabel: 'Best month share',
    })
  }

  // ── Edge decay ───────────────────────────────────────────────────
  if (decay.available && decay.expectancyDelta != null && Math.abs(decay.expectancyDelta) > 1) {
    const worse = decay.expectancyDelta < 0
    out.push({
      id: `decay-${groupLabel}`,
      severity: worse ? 'warning' : 'positive',
      title: `${groupLabel}: ${worse ? 'edge is fading' : 'edge is improving'}`,
      body: `Expectancy moved from ${money(decay.first.expectancy, symbol)} in the first ${decay.first.count} trades to ${money(decay.second.expectancy, symbol)} in the most recent ${decay.second.count}. Win rate went ${pct(decay.first.winRate)} → ${pct(decay.second.winRate)}.`,
      metric: money(decay.expectancyDelta, symbol),
      metricLabel: 'Expectancy change',
    })
  }

  return out
}

/** Insights that don't depend on currency — counts, timing, discipline. */
function behaviourInsights(trades, validationRules, validationCategories) {
  const out = []

  const streaks = getStreakStats(trades)
  const seq = getSequenceBehavior(trades)
  const revenge = getRevengeTrading(trades)
  const over = getOvertrading(trades)
  const discipline = getDisciplineImpact(trades)
  const disciplineScore = getDisciplineScore(trades)
  const threshold = getThresholdCurve(trades)
  const z = getZScore(trades)
  const concentration = getConcentration(trades)
  const spotlight = getPerformerSpotlight(trades)
  const dow = getDayOfWeekStats(trades)
  const sessions = getSessionStats(trades)
  const cadence = getCadenceStats(trades)
  const holding = getHoldingPeriodStats(trades)
  const rules = getRuleEffectiveness(trades, validationRules, validationCategories)

  // ── Loss streak ──────────────────────────────────────────────────
  if (streaks.currentType === 'loss' && streaks.current >= 3) {
    out.push({
      id: 'streak-loss',
      severity: 'critical',
      title: `${streaks.current} losses in a row right now`,
      body: `The longest losing run on record is ${streaks.maxLoss}. Most trading plans call for a size reduction or a pause at this point — the setups rarely change as fast as the results do.`,
      metric: `${streaks.current}`,
      metricLabel: 'Current loss streak',
    })
  } else if (streaks.currentType === 'win' && streaks.current >= 4) {
    out.push({
      id: 'streak-win',
      severity: 'info',
      title: `${streaks.current} wins in a row`,
      body: `Best run so far is ${streaks.maxWin}. Streaks are where sizing discipline usually slips — the run says nothing about the next trade's odds.`,
      metric: `${streaks.current}`,
      metricLabel: 'Current win streak',
    })
  }

  // ── Streak randomness ────────────────────────────────────────────
  if (z.z != null && Math.abs(z.z) >= 1.96) {
    out.push({
      id: 'z-score',
      severity: 'info',
      title: z.z < 0 ? 'Your results genuinely clump' : 'Your results alternate more than chance',
      body: `${z.runs} runs observed against ${z.expectedRuns?.toFixed(1)} expected across ${z.sampleSize} resolved trades (Z = ${z.z.toFixed(2)}). ${z.z < 0 ? 'Wins follow wins and losses follow losses more than randomness predicts — treating streaks as real is justified here.' : 'Outcomes flip more often than randomness predicts.'}`,
      metric: z.z.toFixed(2),
      metricLabel: 'Runs-test Z',
    })
  }

  // ── Tilt ─────────────────────────────────────────────────────────
  if (seq.reliable && seq.winRateGap != null && Math.abs(seq.winRateGap) >= 15) {
    out.push({
      id: 'tilt',
      severity: seq.winRateGap > 0 ? 'warning' : 'info',
      title: seq.winRateGap > 0 ? 'Your next trade suffers after a loss' : 'Your next trade suffers after a win',
      body: `Win rate is ${pct(seq.afterWin.winRate)} after a win (${seq.afterWin.count} trades) versus ${pct(seq.afterLoss.winRate)} after a loss (${seq.afterLoss.count} trades) — a ${Math.abs(seq.winRateGap).toFixed(0)} point gap on the same setups.`,
      metric: `${Math.abs(seq.winRateGap).toFixed(0)}pt`,
      metricLabel: 'Win-rate gap',
    })
  }

  // ── Revenge trading ──────────────────────────────────────────────
  if (revenge.reliable && revenge.penalty != null && revenge.penalty < -10) {
    out.push({
      id: 'revenge',
      severity: 'warning',
      title: `Quick re-entries after a loss are costing you`,
      body: `${revenge.count} trades were opened within a day of a loss. They win ${pct(revenge.flaggedWinRate)} of the time against ${pct(revenge.baselineWinRate)} for everything else — a ${Math.abs(revenge.penalty).toFixed(0)} point penalty.`,
      metric: `${revenge.count}`,
      metricLabel: 'Quick re-entries',
    })
  }

  // ── Overtrading ──────────────────────────────────────────────────
  if (over.available && over.heavyDays > 0 && over.heavyDayAvgPnl != null && over.normalDayAvgPnl != null) {
    if (over.heavyDayAvgPnl < over.normalDayAvgPnl) {
      out.push({
        id: 'overtrading',
        severity: 'warning',
        title: `Busy days perform worse than quiet ones`,
        body: `${over.heavyDays} of ${over.totalActiveDays} active days had ${over.threshold}+ trades. Those days average a worse result than your normal days — volume isn't converting into edge.`,
        metric: `${over.heavyDays}`,
        metricLabel: 'Heavy days',
      })
    }
  }

  // ── Checklist working / not working ──────────────────────────────
  if (discipline.available && discipline.lift != null && discipline.sampleSize >= 10) {
    if (discipline.lift >= 12) {
      out.push({
        id: 'discipline-good',
        severity: 'positive',
        title: 'Your checklist is earning its place',
        body: `Trades scoring at or above ${discipline.cut.toFixed(0)}% win ${pct(discipline.highScoreWinRate)} of the time, against ${pct(discipline.lowScoreWinRate)} below it — a ${discipline.lift.toFixed(0)} point lift across ${discipline.sampleSize} resolved trades.`,
        metric: `+${discipline.lift.toFixed(0)}pt`,
        metricLabel: 'Checklist lift',
      })
    } else if (discipline.lift <= -8) {
      out.push({
        id: 'discipline-bad',
        severity: 'warning',
        title: 'Higher checklist scores are not winning more',
        body: `Above ${discipline.cut.toFixed(0)}% the win rate is ${pct(discipline.highScoreWinRate)}; below it ${pct(discipline.lowScoreWinRate)}. Either the rules are measuring the wrong thing, or boxes are being ticked after the decision is already made.`,
        metric: `${discipline.lift.toFixed(0)}pt`,
        metricLabel: 'Checklist lift',
      })
    }
  }

  // ── Threshold opportunity ────────────────────────────────────────
  if (threshold.available && threshold.best && threshold.gain != null && threshold.gain >= 10) {
    out.push({
      id: 'threshold',
      severity: 'opportunity',
      title: `Skipping sub-${threshold.best.cut}% setups would have lifted win rate`,
      body: `Taking only trades scoring ${threshold.best.cut}%+ leaves ${threshold.best.kept} of ${threshold.sampleSize} trades and raises win rate from ${pct(threshold.baseline.winRate)} to ${pct(threshold.best.winRate)}.`,
      metric: `${threshold.best.cut}%`,
      metricLabel: 'Suggested cut-off',
    })
  }

  // ── Dead rules ───────────────────────────────────────────────────
  if (rules.unused.length >= 3) {
    out.push({
      id: 'rules-unused',
      severity: 'info',
      title: `${rules.unused.length} active rules have never been ticked`,
      body: `They add length to the checklist without adding signal: ${rules.unused.slice(0, 4).map((r) => r.label).join(' · ')}${rules.unused.length > 4 ? ' …' : ''}. Retiring unused rules makes the score more meaningful.`,
      metric: `${rules.unused.length}`,
      metricLabel: 'Unused rules',
    })
  }

  // ── Standout rule ────────────────────────────────────────────────
  const bestRule = rules.best[0]
  if (bestRule && bestRule.lift != null && bestRule.lift >= 15) {
    out.push({
      id: 'rule-best',
      severity: 'positive',
      title: `"${bestRule.label}" is your strongest filter`,
      body: `Trades with it ticked win ${pct(bestRule.winRateWith)} versus ${pct(bestRule.winRateWithout)} without — a ${bestRule.lift.toFixed(0)} point lift over ${bestRule.usedCount} trades.`,
      metric: `+${bestRule.lift.toFixed(0)}pt`,
      metricLabel: 'Rule lift',
    })
  }
  const worstRule = rules.worst[0]
  if (worstRule && worstRule.lift != null && worstRule.lift <= -15) {
    out.push({
      id: 'rule-worst',
      severity: 'warning',
      title: `"${worstRule.label}" is working against you`,
      body: `Trades with it ticked win ${pct(worstRule.winRateWith)} versus ${pct(worstRule.winRateWithout)} without. A rule that predicts losses is worse than no rule — worth re-reading how it's defined.`,
      metric: `${worstRule.lift.toFixed(0)}pt`,
      metricLabel: 'Rule lift',
    })
  }

  // ── Day of week ──────────────────────────────────────────────────
  const dowWithData = dow.filter((d) => d.wins + d.losses >= 4)
  if (dowWithData.length >= 3) {
    const sorted = [...dowWithData].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    const bestDay = sorted[0]
    const worstDay = sorted[sorted.length - 1]
    if (bestDay.winRate != null && worstDay.winRate != null && bestDay.winRate - worstDay.winRate >= 25) {
      out.push({
        id: 'dow',
        severity: 'opportunity',
        title: `${bestDay.label} is your best day, ${worstDay.label} your worst`,
        body: `${bestDay.label} wins ${pct(bestDay.winRate)} across ${bestDay.trades} trades; ${worstDay.label} wins ${pct(worstDay.winRate)} across ${worstDay.trades}. A day-of-week filter is the cheapest edge there is.`,
        metric: bestDay.label,
        metricLabel: 'Strongest day',
      })
    }
  }

  // ── Session ──────────────────────────────────────────────────────
  const sessionsWithData = sessions.filter((s) => s.wins + s.losses >= 4)
  if (sessionsWithData.length >= 2) {
    const sorted = [...sessionsWithData].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    if (sorted[0].winRate != null && sorted[sorted.length - 1].winRate != null && sorted[0].winRate - sorted[sorted.length - 1].winRate >= 25) {
      out.push({
        id: 'session',
        severity: 'opportunity',
        title: `${sorted[0].label} session is where your edge sits`,
        body: `${pct(sorted[0].winRate)} win rate over ${sorted[0].trades} trades logged in that window, against ${pct(sorted[sorted.length - 1].winRate)} in ${sorted[sorted.length - 1].label}. Based on when each trade was logged.`,
        metric: sorted[0].label,
        metricLabel: 'Strongest session',
      })
    }
  }

  // ── Concentration ────────────────────────────────────────────────
  if (concentration.hhi != null && concentration.hhi > 0.4 && trades.length >= 10) {
    out.push({
      id: 'concentration',
      severity: 'info',
      title: `Nearly everything is in ${concentration.top[0]?.name}`,
      body: `${pct(concentration.top[0]?.sharePct)} of all trades sit in one instrument (effective spread: ${concentration.effectiveCount?.toFixed(1)} instruments). That's a specialisation, not automatically a problem — but the whole record now depends on one market's behaviour.`,
      metric: concentration.effectiveCount?.toFixed(1),
      metricLabel: 'Effective instruments',
    })
  }

  // ── Best / worst instrument ──────────────────────────────────────
  if (spotlight.available && spotlight.worst && spotlight.worst.netPnl < 0 && spotlight.worst.count >= 4) {
    out.push({
      id: 'worst-instrument',
      severity: 'warning',
      title: `${spotlight.worst.key} keeps losing money`,
      body: `${spotlight.worst.count} trades, ${pct(spotlight.worst.winRate)} win rate, net negative. Cutting one consistently unprofitable instrument is usually the fastest improvement available.`,
      metric: `${spotlight.worst.count}`,
      metricLabel: 'Trades taken',
    })
  }

  // ── Holding behaviour ────────────────────────────────────────────
  if (holding.available && holding.holdsLosersLonger && holding.sampleSize >= 8) {
    out.push({
      id: 'holding',
      severity: 'warning',
      title: 'Losers are held longer than winners',
      body: `Average time to close a loss is ${holding.avgLossDays.toFixed(1)} days against ${holding.avgWinDays.toFixed(1)} days for a win. That's the textbook disposition effect — hope on the losers, impatience on the winners.`,
      metric: `${holding.avgLossDays.toFixed(1)}d`,
      metricLabel: 'Avg loss hold',
    })
  }

  // ── Cadence ──────────────────────────────────────────────────────
  if (cadence.maxGapDays != null && cadence.maxGapDays > 30 && trades.length >= 8) {
    out.push({
      id: 'cadence',
      severity: 'info',
      title: `Longest gap between trades was ${cadence.maxGapDays} days`,
      body: `You average ${cadence.tradesPerWeek?.toFixed(1)} trades a week across ${cadence.activeDays} active days. Long breaks are fine — just be aware that stats either side of one may reflect different market conditions.`,
      metric: `${cadence.maxGapDays}d`,
      metricLabel: 'Longest gap',
    })
  }

  // ── Stale pending ────────────────────────────────────────────────
  const stale = trades.filter((t) => isPending(t) && (Date.now() - parseDate(t).getTime()) / 86400000 > 21)
  if (stale.length >= 2) {
    out.push({
      id: 'stale',
      severity: 'warning',
      title: `${stale.length} trades have sat pending for over three weeks`,
      body: `${[...new Set(stale.map(stockLabel))].slice(0, 4).join(', ')} — every unresolved row quietly distorts win rate, expectancy and drawdown until it's closed out.`,
      metric: `${stale.length}`,
      metricLabel: 'Stale pending',
    })
  }

  // ── Discipline grade ─────────────────────────────────────────────
  if (disciplineScore.score != null && disciplineScore.unscoredCount > 0 && trades.length >= 6) {
    const coverage = disciplineScore.coverage
    if (coverage < 60) {
      out.push({
        id: 'coverage',
        severity: 'info',
        title: `Only ${pct(coverage)} of trades carry a checklist score`,
        body: `${disciplineScore.unscoredCount} of ${trades.length} trades were logged without one, so every process statistic on this page is drawn from a partial picture.`,
        metric: pct(coverage),
        metricLabel: 'Score coverage',
      })
    }
  }

  return out
}

/**
 * Top-level entry point. Returns insights sorted by severity, each with a
 * stable id so the UI can animate the list without re-keying on every
 * recompute.
 */
export function getInsights(trades, validationRules = [], validationCategories = []) {
  if (!trades.length) return []

  const { INR, USD } = splitTradesByCurrency(trades)
  const insights = [
    ...currencyInsights(INR, '₹', 'Equity'),
    ...currencyInsights(USD, '$', 'Forex & Commodity'),
    ...behaviourInsights(trades, validationRules, validationCategories),
  ]

  return insights.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )
}

/** Counts by severity — drives the badge on the Insights section header. */
export function summariseInsights(insights) {
  const counts = { critical: 0, warning: 0, opportunity: 0, positive: 0, info: 0 }
  insights.forEach((i) => {
    counts[i.severity] = (counts[i.severity] || 0) + 1
  })
  return counts
}

export const SEVERITY_META = {
  critical: { label: 'Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  warning: { label: 'Watch', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  opportunity: { label: 'Opportunity', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  positive: { label: 'Strength', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  info: { label: 'Note', color: '#0284c7', bg: 'rgba(2,132,199,0.12)' },
}
