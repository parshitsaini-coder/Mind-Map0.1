// Tests for the confidence / grading / cost tools.
// Wilson interval values below are checked against published tables, not
// against the implementation, so a regression in the formula fails here.
import {
  costImpact, sampleSizeNeeded, tradeGrader, trailingStop, winRateConfidence,
} from '../src/utils/tradeTools.js'

let checks = 0, failures = 0
const ok = (label, cond, got) => {
  checks++
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`) }
}
const near = (a, b, tol = 0.15) => a != null && Math.abs(a - b) <= tol

const trade = (i, { win = true, pnl = null, instrument = 'XAUUSD', tf = '1H', dir = 'Buy', price = 4400 } = {}) => ({
  id: `t${i}`, name: `${instrument} ${i}`, date: `2025-03-${String((i % 28) + 1).padStart(2, '0')}`,
  pair: instrument, instrumentName: instrument, instrumentType: 'Commodity', timeframe: tf,
  direction: dir, price, pnl, notes: '', validationRuleIds: [], validationScore: null,
  screenshotUrl: '', resultImageUrl: '', status: win ? 'Target Hit' : 'SL Hit',
  createdAt: `2025-03-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  updatedAt: `2025-03-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z`,
})

console.log('\n── Wilson score interval (vs published values) ──')
{
  const r = winRateConfidence({ wins: 10, losses: 10 })
  ok('10/20 observed = 50%', near(r.observed, 50, 0.001), r.observed)
  ok('10/20 low ≈ 29.9%', near(r.low, 29.9), r.low)
  ok('10/20 high ≈ 70.1%', near(r.high, 70.1), r.high)
  ok('10/20 is inconclusive', r.inconclusive === true)
  ok('10/20 does not beat a coin flip', r.beatsCoinFlip === false)
}
{
  const r = winRateConfidence({ wins: 60, losses: 40 })
  ok('60/100 low ≈ 50.2%', near(r.low, 50.2), r.low)
  ok('60/100 high ≈ 69.1%', near(r.high, 69.1), r.high)
  ok('60/100 beats a coin flip', r.beatsCoinFlip === true)
}
{
  const r = winRateConfidence({ wins: 3, losses: 0 })
  ok('3/3 stays inside 0-100', r.low >= 0 && r.high <= 100, [r.low, r.high])
  ok('3/3 is still inconclusive', r.inconclusive === true)
}
{
  const r = winRateConfidence({ wins: 20, losses: 80 })
  ok('20/100 is worse than a coin flip', r.worseThanCoinFlip === true)
}
{
  const wide = winRateConfidence({ wins: 6, losses: 4 })
  const narrow = winRateConfidence({ wins: 600, losses: 400 })
  ok('interval narrows as n grows', narrow.width < wide.width, [wide.width, narrow.width])
  ok('99% is wider than 95%',
    winRateConfidence({ wins: 60, losses: 40, confidence: 99 }).width >
    winRateConfidence({ wins: 60, losses: 40, confidence: 95 }).width)
}
ok('rejects empty input', winRateConfidence({}).ok === false)
ok('rejects zero trades', winRateConfidence({ wins: 0, losses: 0 }).ok === false)
ok('rejects negatives', winRateConfidence({ wins: -3, losses: 5 }).ok === false)

console.log('\n── Sample size ──')
{
  // n = z²p(1-p)/m² ; 55% within ±5pt at 95% => 1.96²(.55)(.45)/.05² ≈ 381
  const r = sampleSizeNeeded({ winRatePct: 55, marginPct: 5 })
  ok('55% ±5pt ≈ 381 trades', r.tradesNeeded >= 375 && r.tradesNeeded <= 385, r.tradesNeeded)

  // Degenerate on purpose: a 55% win rate sits exactly 5 points above
  // break-even, so "know it to ±5pt" and "prove it beats 50%" are the
  // same question and must return the same n.
  ok('at margin = edge the two answers coincide', r.tradesNeeded === r.tradesToProveEdge, [r.tradesNeeded, r.tradesToProveEdge])

  // With a loose margin the gap opens up, which is the real point: a
  // rough estimate is cheap, proving an edge is not.
  const loose = sampleSizeNeeded({ winRatePct: 55, marginPct: 10 })
  ok('proving a 5pt edge costs far more than a ±10pt estimate',
    loose.tradesToProveEdge > loose.tradesNeeded * 3, [loose.tradesNeeded, loose.tradesToProveEdge])
  ok('proving is independent of the margin asked for',
    loose.tradesToProveEdge === r.tradesToProveEdge, [loose.tradesToProveEdge, r.tradesToProveEdge])

  // A win rate hugging 50% needs an impractical sample.
  const marginal = sampleSizeNeeded({ winRatePct: 51, marginPct: 5 })
  ok('a 1pt edge needs a huge sample', marginal.tradesToProveEdge > 9000, marginal.tradesToProveEdge)
}
ok('tighter margin needs more trades',
  sampleSizeNeeded({ winRatePct: 55, marginPct: 2 }).tradesNeeded >
  sampleSizeNeeded({ winRatePct: 55, marginPct: 10 }).tradesNeeded)
ok('rejects 0%', sampleSizeNeeded({ winRatePct: 0 }).ok === false)
ok('rejects 100%', sampleSizeNeeded({ winRatePct: 100 }).ok === false)
ok('rejects silly margin', sampleSizeNeeded({ winRatePct: 55, marginPct: 60 }).ok === false)

console.log('\n── Trade grader ──')
{
  ok('refuses to grade under 5 trades', tradeGrader([trade(1)], { instrument: 'XAUUSD' }).ok === false)

  // 20 trades: XAUUSD wins 9/10, EURUSD wins 1/10. Baseline = 50%.
  const mixed = [
    ...Array.from({ length: 10 }, (_, i) => trade(i, { win: i < 9, instrument: 'XAUUSD' })),
    ...Array.from({ length: 10 }, (_, i) => trade(100 + i, { win: i < 1, instrument: 'EURUSD' })),
  ]
  const good = tradeGrader(mixed, { instrument: 'XAUUSD' })
  ok('baseline = 50%', near(good.baseline, 50, 0.01), good.baseline)
  ok('strong instrument lifts the grade', good.lift > 30, good.lift)
  ok('strong instrument grades A', good.grade === 'A', good.grade)

  const bad = tradeGrader(mixed, { instrument: 'EURUSD' })
  ok('weak instrument grades F', bad.grade === 'F', bad.grade)
  ok('weak instrument has a negative lift', bad.lift < -30, bad.lift)

  const unknown = tradeGrader(mixed, { instrument: 'NIFTY' })
  ok('unseen instrument is not graded', unknown.graded === false)
  ok('unseen instrument still returns ok', unknown.ok === true)

  // A facet with only 3 trades must be excluded from the grade.
  const thin = [
    ...Array.from({ length: 12 }, (_, i) => trade(i, { win: i % 2 === 0, tf: '1H' })),
    ...Array.from({ length: 3 }, (_, i) => trade(200 + i, { win: true, tf: '5m' })),
  ]
  ok('3-trade facet is excluded', tradeGrader(thin, { timeframe: '5m' }).graded === false)
}

console.log('\n── Trailing stop ──')
{
  const r = trailingStop({ entry: 4400, currentPrice: 4460, atr: 12, multiplier: 3, direction: 'Long' })
  ok('open profit = 60', near(r.openProfit, 60, 0.001), r.openProfit)
  ok('chandelier = 4460 - 36 = 4424', near(r.levels.find((l) => l.id === 'atr').price, 4424, 0.001))
  ok('break-even level present', r.levels.some((l) => l.id === 'be'))
  ok('half-gain locks 30', near(r.levels.find((l) => l.id === 'half').locked, 30, 0.001))
  ok('all levels sit below price when long', r.levels.every((l) => l.price <= 4460))

  const short = trailingStop({ entry: 4400, currentPrice: 4340, atr: 12, direction: 'Short' })
  ok('short open profit = 60', near(short.openProfit, 60, 0.001), short.openProfit)
  ok('short levels sit above price', short.levels.every((l) => l.price >= 4340))

  const under = trailingStop({ entry: 4400, currentPrice: 4380, atr: 12, direction: 'Long' })
  ok('losing position is flagged', under.inProfit === false)
  ok('losing position offers no half-gain level', !under.levels.some((l) => l.id === 'half'))

  const pctOnly = trailingStop({ entry: 100, currentPrice: 110, trailPct: 5, direction: 'Long' })
  ok('5% trail from 110 = 104.5', near(pctOnly.levels.find((l) => l.id === 'pct').price, 104.5, 0.001))
  ok('no ATR level when no ATR given', !pctOnly.levels.some((l) => l.id === 'atr'))
}
ok('rejects missing entry', trailingStop({ currentPrice: 100 }).ok === false)
ok('rejects zero price', trailingStop({ entry: 0, currentPrice: 100 }).ok === false)

console.log('\n── Cost impact ──')
{
  // 10 trades, +1000 each = 10,000 gross. 100 per trade = 1,000 drag.
  const ts = Array.from({ length: 10 }, (_, i) => trade(i, { win: true, pnl: 1000, price: 0 }))
  const r = costImpact(ts, { costPerTrade: 100, taxPct: 0 })
  ok('gross = 10,000', near(r.grossNet, 10000, 0.01), r.grossNet)
  ok('drag = 1,000', near(r.totalDrag, 1000, 0.01), r.totalDrag)
  ok('net = 9,000', near(r.netAfter, 9000, 0.01), r.netAfter)
  ok('per trade = 100', near(r.perTradeDrag, 100, 0.01))
  ok('drag is 10% of gross', near(r.dragPctOfGross, 10, 0.01), r.dragPctOfGross)
  ok('no winners erased at this size', r.flippedWinners === 0)

  const thin = Array.from({ length: 10 }, (_, i) => trade(i, { win: true, pnl: 50, price: 0 }))
  const t2 = costImpact(thin, { costPerTrade: 100 })
  ok('costs can turn profit into loss', t2.turnsProfitIntoLoss === true)
  ok('all thin winners are erased', t2.flippedWinners === 10, t2.flippedWinners)

  const taxed = costImpact(
    Array.from({ length: 4 }, (_, i) => trade(i, { win: true, pnl: 500, price: 1000 })),
    { costPerTrade: 0, taxPct: 1 }
  )
  ok('1% of 1000 × 4 trades = 40 tax', near(taxed.taxTotal, 40, 0.01), taxed.taxTotal)
}
ok('rejects missing cost', costImpact([trade(1, { pnl: 100 })], {}).ok === false)
ok('rejects an empty log', costImpact([], { costPerTrade: 10 }).ok === false)
ok('rejects trades with no P&L', costImpact([trade(1)], { costPerTrade: 10 }).ok === false)

console.log('\n── Garbage input ──')
{
  const junk = [null, undefined, '', 'abc', NaN, Infinity, -Infinity, {}, []]
  let threw = 0
  for (const v of junk) {
    for (const fn of [
      () => winRateConfidence({ wins: v, losses: v }),
      () => sampleSizeNeeded({ winRatePct: v, marginPct: v }),
      () => trailingStop({ entry: v, currentPrice: v, atr: v }),
      () => costImpact(v, { costPerTrade: v }),
      () => tradeGrader(v, { instrument: v }),
    ]) {
      try { const out = fn(); if (typeof out !== 'object') threw++ } catch { threw++ }
    }
  }
  ok(`5 tools × ${junk.length} junk inputs — none threw`, threw === 0, threw)
}

console.log(`\n══ ${checks} checks, ${failures} failure(s) ══\n`)
process.exit(failures ? 1 : 0)
