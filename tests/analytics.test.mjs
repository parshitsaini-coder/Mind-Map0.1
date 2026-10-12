// Dev-only test harness. Generates a realistic trade log and runs every
// analytics export against it, checking for NaN/Infinity leaks, thrown
// errors, and obviously-wrong values. Not shipped with the app.

import * as Pro from '../src/utils/tradeAnalyticsPro.js'
import * as Time from '../src/utils/tradeAnalyticsTime.js'
import * as Behavior from '../src/utils/tradeAnalyticsBehavior.js'
import * as Edge from '../src/utils/tradeAnalyticsEdge.js'
import * as Insights from '../src/utils/tradeInsights.js'
import { seededRandom } from '../src/utils/stats.js'

const rand = seededRandom(99)

const INSTRUMENTS = [
  { name: 'Gold / US Dollar', pair: 'XAUUSD', type: 'Commodity' },
  { name: 'Euro / US Dollar', pair: 'EURUSD', type: 'Forex' },
  { name: 'Reliance Industries', pair: 'RELIANCE', type: 'Equity' },
  { name: 'Tata Motors', pair: 'TATAMOTORS', type: 'Equity' },
  { name: 'Silver / US Dollar', pair: 'XAGUSD', type: 'Commodity' },
]
const TFS = ['5m', '15m', '1h', '4h', '1D']
const RULES = Array.from({ length: 12 }, (_, i) => ({
  id: `rule-${i}`,
  categoryId: i < 6 ? 'cat-a' : 'cat-b',
  label: `Rule ${i + 1}`,
  active: true,
  order: i,
}))
const CATEGORIES = [
  { id: 'cat-a', name: 'Candle Rules', icon: 'Flame', order: 0 },
  { id: 'cat-b', name: 'SMC Rules', icon: 'BarChart3', order: 1 },
]

function makeTrades(n) {
  const trades = []
  const start = new Date(2026, 0, 5).getTime()
  for (let i = 0; i < n; i++) {
    const inst = INSTRUMENTS[Math.floor(rand() * INSTRUMENTS.length)]
    const dayOffset = Math.floor(i * 1.7 + rand() * 3)
    const created = start + dayOffset * 86400000 + Math.floor(rand() * 14 + 6) * 3600000
    const d = new Date(created)
    const checked = Math.floor(rand() * 13)
    const win = rand() < 0.45 + checked * 0.02
    const status = rand() < 0.15 ? 'Pending' : win ? 'Target Hit' : 'SL Hit'
    const magnitude = inst.type === 'Equity' ? 1200 : 300
    const pnl =
      status === 'Pending'
        ? null
        : win
          ? Math.round(magnitude * (0.5 + rand() * 2.2))
          : -Math.round(magnitude * (0.4 + rand() * 1.3))
    trades.push({
      id: `t-${i}`,
      name: `Trade ${i}`,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      pair: inst.pair,
      instrumentName: inst.name,
      instrumentType: inst.type,
      timeframe: TFS[Math.floor(rand() * TFS.length)],
      direction: rand() < 0.55 ? 'Buy' : 'Sell',
      price: Math.round((inst.type === 'Equity' ? 2800 : 4300) * (0.9 + rand() * 0.2)),
      pnl,
      notes: rand() < 0.6 ? ['clean breakout retest zone', 'chased the entry late', 'news spike volatile', 'patient waited confirmation'][Math.floor(rand() * 4)] : '',
      validationRuleIds: RULES.filter(() => rand() < checked / 12).map((r) => r.id),
      validationScore: { checked, total: 12 },
      status,
      createdAt: created,
      updatedAt: created + (status === 'Pending' ? 0 : Math.floor(rand() * 6 + 1) * 86400000),
    })
  }
  return trades
}

// ── Guards ─────────────────────────────────────────────────────────
let failures = 0
let checks = 0

function badNumber(v) {
  return typeof v === 'number' && !Number.isFinite(v)
}

function scan(label, value, path = '') {
  checks += 1
  if (badNumber(value)) {
    console.error(`  ✗ ${label}${path}: non-finite number (${value})`)
    failures += 1
    return
  }
  if (Array.isArray(value)) {
    value.slice(0, 40).forEach((v, i) => scan(label, v, `${path}[${i}]`))
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    // Don't recurse into raw trade objects we pass back through
    for (const [k, v] of Object.entries(value)) {
      if (k === 'rows' || k === 'trade' || k === 'trades' || k === 'curve' || k === 'paths' || k === 'finals') continue
      scan(label, v, `${path}.${k}`)
    }
  }
}

function run(label, fn) {
  try {
    const out = fn()
    scan(label, out)
    return out
  } catch (err) {
    console.error(`  ✗ ${label} THREW: ${err.message}`)
    console.error(err.stack.split('\n').slice(1, 3).join('\n'))
    failures += 1
    return null
  }
}

// ── Test across many dataset sizes, including the nasty edges ──────
const SIZES = [0, 1, 2, 3, 5, 8, 15, 40, 120]

for (const size of SIZES) {
  const trades = makeTrades(size)
  const inr = trades.filter((t) => t.instrumentType === 'Equity')
  const usd = trades.filter((t) => t.instrumentType !== 'Equity')
  console.log(`\n── n=${size} (INR ${inr.length} / USD ${usd.length}) ──`)

  run('getPerformance', () => Pro.getPerformance(usd))
  run('getEquityCurve', () => Pro.getEquityCurve(usd))
  run('getDrawdownStats', () => Pro.getDrawdownStats(usd))
  run('getRiskRatios', () => Pro.getRiskRatios(usd))
  run('getKelly', () => Pro.getKelly(usd))
  run('getRiskOfRuin', () => Pro.getRiskOfRuin(usd, 20))
  run('getZScore', () => Pro.getZScore(trades))
  run('getStreakStats', () => Pro.getStreakStats(trades))
  run('getConsistency', () => Pro.getConsistency(usd))
  run('getPeriodExtremes', () => Pro.getPeriodExtremes(usd))
  run('getRollingMetrics', () => Pro.getRollingMetrics(trades, 10))
  run('getEdgeDecay', () => Pro.getEdgeDecay(usd))
  run('getPnlDistribution', () => Pro.getPnlDistribution(usd))
  run('getRDistribution', () => Pro.getRDistribution(usd))
  run('getOutliers', () => Pro.getOutliers(usd))
  run('getCdf', () => Pro.getCdf(usd))
  run('runMonteCarlo', () => Pro.runMonteCarlo(usd, { runs: 200 }))
  run('getWhatIf', () => Pro.getWhatIf(usd, 2))
  run('getExpectancyR', () => Pro.getExpectancyR(usd))
  run('getRMultiples', () => Pro.getRMultiples(usd))

  run('getDayOfWeekStats', () => Time.getDayOfWeekStats(trades))
  run('getMonthOfYearStats', () => Time.getMonthOfYearStats(trades))
  run('getHourOfDayStats', () => Time.getHourOfDayStats(trades))
  run('getSessionStats', () => Time.getSessionStats(trades))
  run('getCadenceStats', () => Time.getCadenceStats(trades))
  run('getHoldingPeriodStats', () => Time.getHoldingPeriodStats(trades))
  run('getMonthlyTable', () => Time.getMonthlyTable(usd))
  run('getWeeklyTable', () => Time.getWeeklyTable(usd))
  run('getTimeHeatmap', () => Time.getTimeHeatmap(trades))
  run('comparePeriods', () =>
    Time.comparePeriods(trades, { from: new Date(2026, 0, 1), to: new Date(2026, 1, 1) }, { from: new Date(2026, 1, 1), to: new Date(2026, 2, 1) })
  )

  run('getSequenceBehavior', () => Behavior.getSequenceBehavior(trades))
  run('getRevengeTrading', () => Behavior.getRevengeTrading(trades))
  run('getOvertrading', () => Behavior.getOvertrading(trades))
  run('getDisciplineImpact', () => Behavior.getDisciplineImpact(trades))
  run('getThresholdCurve', () => Behavior.getThresholdCurve(trades))
  run('getRuleEffectiveness', () => Behavior.getRuleEffectiveness(trades, RULES, CATEGORIES))
  run('getDisciplineScore', () => Behavior.getDisciplineScore(trades))
  run('getSizeDrift', () => Behavior.getSizeDrift(trades))
  run('getNotesKeywords', () => Behavior.getNotesKeywords(trades))

  run('getInstrumentStats', () => Edge.getInstrumentStats(trades).map(({ rows, ...r }) => r))
  run('getTimeframeStats', () => Edge.getTimeframeStats(trades).map(({ rows, ...r }) => r))
  run('getDirectionStats', () => Edge.getDirectionStats(trades).map(({ rows, ...r }) => r))
  run('getInstrumentTypeStats', () => Edge.getInstrumentTypeStats(trades).map(({ rows, ...r }) => r))
  run('rankEdge', () => Edge.rankEdge(Edge.getInstrumentStats(trades)).map(({ rows, ...r }) => r))
  run('getEdgeMatrix', () => Edge.getEdgeMatrix(trades))
  run('getDirectionMatrix', () => Edge.getDirectionMatrix(trades))
  run('getConcentration', () => Edge.getConcentration(trades))
  run('getInstrumentCorrelation', () => Edge.getInstrumentCorrelation(trades))
  run('getPerformerSpotlight', () => {
    const s = Edge.getPerformerSpotlight(trades)
    return { available: s.available, best: s.best ? { ...s.best, rows: undefined } : null }
  })

  const ins = run('getInsights', () => Insights.getInsights(trades, RULES, CATEGORIES))
  if (ins) {
    const bad = ins.filter((i) => !i.id || !i.title || !i.body || !i.severity)
    if (bad.length) {
      console.error(`  ✗ getInsights: ${bad.length} malformed insight(s)`)
      failures += 1
    }
    const undef = ins.filter((i) => /undefined|NaN|\[object/.test(i.title + i.body + (i.metric ?? '')))
    if (undef.length) {
      console.error(`  ✗ getInsights: ${undef.length} insight(s) contain undefined/NaN text`)
      undef.slice(0, 3).forEach((i) => console.error(`     - ${i.title} :: ${i.body.slice(0, 120)}`))
      failures += 1
    }
    console.log(`  insights: ${ins.length}`)
  }
}

// ── Hand-checked numeric assertions ────────────────────────────────
console.log('\n── Numeric assertions ──')
function assert(name, actual, expected, tol = 1e-9) {
  checks += 1
  const ok = expected === null ? actual === null : Math.abs(actual - expected) <= tol
  if (!ok) {
    console.error(`  ✗ ${name}: got ${actual}, expected ${expected}`)
    failures += 1
  } else {
    console.log(`  ✓ ${name} = ${actual}`)
  }
}

const mk = (pnl, i, status) => ({
  id: `a${i}`,
  date: `2026-03-${String(i + 1).padStart(2, '0')}`,
  pair: 'XAUUSD',
  instrumentName: 'Gold',
  instrumentType: 'Commodity',
  timeframe: '15m',
  direction: 'Buy',
  pnl,
  status: status || (pnl > 0 ? 'Target Hit' : 'SL Hit'),
  createdAt: new Date(2026, 2, i + 1, 10).getTime(),
  updatedAt: new Date(2026, 2, i + 1, 10).getTime(),
  validationRuleIds: [],
})

// 100, -50, 200, -50, 100 → gross +400 / -100, PF 4, net 300, exp 60
const simple = [100, -50, 200, -50, 100].map(mk)
const p = Pro.getPerformance(simple)
assert('grossProfit', p.grossProfit, 400)
assert('grossLoss', p.grossLoss, 100)
assert('netPnl', p.netPnl, 300)
assert('profitFactor', p.profitFactor, 4)
assert('expectancy', p.expectancy, 60)
assert('winRate', p.winRate, 60)
assert('avgWin', p.avgWin, 400 / 3, 1e-9)
assert('avgLoss', p.avgLoss, 50)
assert('payoffRatio', p.payoffRatio, 400 / 3 / 50)
assert('largestWin', p.largestWin, 200)
assert('largestLoss', p.largestLoss, -50)

// Equity: 100, 50, 250, 200, 300. Peak 250 at idx3 → dd 50. Max dd -50.
const dd = Pro.getDrawdownStats(simple)
assert('maxDrawdown', dd.maxDrawdown, -50)
assert('maxDrawdownPct', dd.maxDrawdownPct, 50) // worst % fall: 100 -> 50
assert('currentDrawdown', dd.currentDrawdown, 0)
assert('recoveryFactor', dd.recoveryFactor, 300 / 50)
assert('curve last equity', dd.curve[dd.curve.length - 1].equity, 300)

// R unit = avg abs loss = 50. Expectancy 60 → 1.2R
assert('rUnit', Pro.rUnitFor(simple), 50)
assert('expectancyR', Pro.getExpectancyR(simple), 1.2)

// Kelly: w=.6, b=2.6667 → .6 - .4/2.6667 = .45
const k = Pro.getKelly(simple)
assert('kellyPct', k.kellyPct, 45, 1e-6)
assert('halfKellyPct', k.halfKellyPct, 22.5, 1e-6)

// Streaks on W L W L W → current win 1, maxWin 1, maxLoss 1
const st = Pro.getStreakStats(simple)
assert('streak current', st.current, 1)
assert('streak maxWin', st.maxWin, 1)
assert('streak maxLoss', st.maxLoss, 1)

// Longer run: W W W L L W
const runSeq = [10, 20, 30, -10, -20, 40].map(mk)
const st2 = Pro.getStreakStats(runSeq)
assert('streak2 maxWin', st2.maxWin, 3)
assert('streak2 maxLoss', st2.maxLoss, 2)
assert('streak2 current', st2.current, 1)

// Monte Carlo determinism
const mc1 = Pro.runMonteCarlo(simple, { runs: 300, seed: 7 })
const mc2 = Pro.runMonteCarlo(simple, { runs: 300, seed: 7 })
checks += 1
if (mc1.median !== mc2.median || mc1.probProfitablePct !== mc2.probProfitablePct) {
  console.error('  ✗ Monte Carlo not deterministic with a fixed seed')
  failures += 1
} else {
  console.log(`  ✓ Monte Carlo deterministic (median ${mc1.median}, P(profit) ${mc1.probProfitablePct.toFixed(1)}%)`)
}

// Concentration: all one instrument → HHI 1
const conc = Edge.getConcentration(simple)
assert('HHI single instrument', conc.hhi, 1)
assert('effectiveCount', conc.effectiveCount, 1)

// Currency-agnostic: win rate should not care about mixed instruments
const mixed = [...simple, { ...mk(9999, 9), instrumentType: 'Equity' }]
checks += 1
if (Pro.getPerformance(mixed).netPnl !== 300 + 9999) {
  console.error('  ✗ mixed-currency perf sanity failed')
  failures += 1
} else {
  console.log('  ✓ getPerformance sums whatever it is given (callers must split by currency)')
}

// Empty / degenerate inputs must not throw and must return nulls
const emptyPerf = Pro.getPerformance([])
assert('empty profitFactor', emptyPerf.profitFactor, null)
assert('empty expectancy', emptyPerf.expectancy, null)
assert('empty winRate', emptyPerf.winRate, null)
const oneTrade = Pro.getRiskRatios([mk(100, 0)])
assert('single-trade sharpe', oneTrade.sharpe, null)

// All wins → profit factor must be null, not Infinity
const allWins = [10, 20, 30].map(mk)
assert('all-wins profitFactor', Pro.getPerformance(allWins).profitFactor, null)
assert('all-wins rUnit', Pro.rUnitFor(allWins), null)

console.log(`\n══ ${checks} checks, ${failures} failure(s) ══`)
process.exit(failures ? 1 : 0)
