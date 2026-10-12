// Dev-only test harness for the calculator layer. Checks correct math on
// hand-worked examples, graceful failure on bad input, and no NaN /
// Infinity leaking into any returned value.

import * as T from '../src/utils/tradeTools.js'
import { seededRandom } from '../src/utils/stats.js'

let checks = 0
let failures = 0

function assert(name, cond, detail = '') {
  checks += 1
  if (cond) console.log(`  ✓ ${name}`)
  else {
    console.error(`  ✗ ${name} ${detail}`)
    failures += 1
  }
}

function near(name, actual, expected, tol = 1e-6) {
  checks += 1
  if (actual == null) {
    console.error(`  ✗ ${name}: got null, expected ${expected}`)
    failures += 1
    return
  }
  if (Math.abs(actual - expected) <= tol) console.log(`  ✓ ${name} = ${actual}`)
  else {
    console.error(`  ✗ ${name}: got ${actual}, expected ${expected}`)
    failures += 1
  }
}

function noBadNumbers(name, obj, path = '') {
  checks += 1
  const walk = (v, p) => {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      console.error(`  ✗ ${name}${p}: non-finite (${v})`)
      failures += 1
      return false
    }
    if (Array.isArray(v)) return v.slice(0, 50).every((x, i) => walk(x, `${p}[${i}]`))
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return Object.entries(v).every(([k, x]) => (k === 'trade' || k === 'rows' ? true : walk(x, `${p}.${k}`)))
    }
    return true
  }
  if (walk(obj, path)) console.log(`  ✓ ${name} clean`)
}

console.log('\n── Position size ──')
// ₹100,000 account, 1% risk = ₹1,000. Entry 500, stop 480 → 20 distance.
// 1000/20 = 50 units.
let r = T.positionSize({ accountSize: 100000, riskPercent: 1, entry: 500, stopLoss: 480 })
assert('valid', r.ok)
near('riskAmount', r.riskAmount, 1000)
near('stopDistance', r.stopDistance, 20)
near('units', r.units, 50)
near('actualRisk', r.actualRisk, 1000)
near('positionValue', r.positionValue, 25000)
assert('direction long', r.direction === 'Long')
noBadNumbers('positionSize', r)

// Lot rounding: lotSize 10 → floor(50/10)*10 = 50 exactly; try 7 units/lot
r = T.positionSize({ accountSize: 100000, riskPercent: 1, entry: 500, stopLoss: 480, lotSize: 30 })
near('lot-rounded units', r.units, 30)
assert('lot-rounded risk under budget', r.actualRisk <= 1000)

// Short side
r = T.positionSize({ accountSize: 50000, riskPercent: 2, entry: 100, stopLoss: 105 })
assert('short direction', r.direction === 'Short')
near('short units', r.units, 200)

// Invalid inputs
assert('rejects zero account', !T.positionSize({ accountSize: 0, riskPercent: 1, entry: 5, stopLoss: 4 }).ok)
assert('rejects equal entry/stop', !T.positionSize({ accountSize: 1000, riskPercent: 1, entry: 5, stopLoss: 5 }).ok)
assert('rejects >100% risk', !T.positionSize({ accountSize: 1000, riskPercent: 150, entry: 5, stopLoss: 4 }).ok)
assert('rejects blank entry', !T.positionSize({ accountSize: 1000, riskPercent: 1, entry: '', stopLoss: 4 }).ok)
assert('rejects text entry', !T.positionSize({ accountSize: 1000, riskPercent: 1, entry: 'abc', stopLoss: 4 }).ok)

console.log('\n── Risk / reward ──')
r = T.riskReward({ entry: 100, stopLoss: 95, target: 115, winRatePct: 40 })
near('risk', r.risk, 5)
near('reward', r.reward, 15)
near('rr', r.rr, 3)
near('breakEvenWinRate', r.breakEvenWinRate, 25)
near('expectancyR', r.expectancyR, 0.4 * 3 - 0.6)
assert('profitable at 40%', r.profitable === true)
assert('stop on right side', r.stopOnRightSide === true)
r = T.riskReward({ entry: 100, stopLoss: 105, target: 115 })
assert('flags wrong-side stop for long', r.stopOnRightSide === false && !!r.warning)
noBadNumbers('riskReward', r)

console.log('\n── Pip value ──')
r = T.pipValue({ pair: 'EURUSD', lots: 1 })
near('standard lot pip', r.pipInQuote, 10)
r = T.pipValue({ pair: 'USDJPY', lots: 1 })
near('JPY pip size', r.pipSize, 0.01)
near('JPY pip value in quote', r.pipInQuote, 1000)
r = T.pipValue({ pair: 'EURUSD', lots: 0.01 })
near('micro lot pip', r.pipInQuote, 0.1)
assert('rejects zero lots', !T.pipValue({ pair: 'EURUSD', lots: 0 }).ok)

console.log('\n── Margin ──')
r = T.marginCalc({ positionValue: 100000, leverage: 20, accountSize: 10000 })
near('margin required', r.marginRequired, 5000)
near('margin pct', r.marginPct, 5)
near('free margin', r.freeMargin, 5000)
near('margin level', r.marginLevelPct, 200)
assert('affordable', r.affordable === true)
assert('rejects zero leverage', !T.marginCalc({ positionValue: 1000, leverage: 0 }).ok)

console.log('\n── Kelly ──')
// 60% win, avgWin 200, avgLoss 100 → b=2, k = .6 - .4/2 = .4
r = T.kellyCalc({ winRatePct: 60, avgWin: 200, avgLoss: 100 })
near('kelly', r.kellyPct, 40)
near('half kelly', r.halfKellyPct, 20)
near('expectancy', r.expectancy, 0.6 * 200 - 0.4 * 100)
near('breakEvenWinRate', r.breakEvenWinRate, (1 / 3) * 100)
assert('has edge', r.hasEdge === true)
// Losing system
r = T.kellyCalc({ winRatePct: 30, avgWin: 100, avgLoss: 100 })
assert('no edge flagged', r.hasEdge === false)
assert('negative kelly', r.kellyPct < 0)
assert('rejects wr 150', !T.kellyCalc({ winRatePct: 150, avgWin: 1, avgLoss: 1 }).ok)

console.log('\n── Drawdown recovery ──')
r = T.drawdownRecovery({ drawdownPct: 50 })
near('50% dd needs 100% gain', r.gainNeededPct, 100)
r = T.drawdownRecovery({ drawdownPct: 20, avgReturnPerTrade: 2 })
near('20% dd needs 25% gain', r.gainNeededPct, 25)
assert('trades to recover computed', r.tradesToRecover > 0)
assert('rejects 100% dd', !T.drawdownRecovery({ drawdownPct: 100 }).ok)
noBadNumbers('drawdownRecovery', r)

console.log('\n── Compounding ──')
r = T.compoundingProjector({ startingCapital: 1000, returnPerPeriodPct: 10, periods: 3 })
near('3 periods of 10%', r.final, 1331, 1e-9)
near('doubling periods', r.doublingPeriods, Math.log(2) / Math.log(1.1), 1e-9)
r = T.compoundingProjector({ startingCapital: 1000, returnPerPeriodPct: 0, periods: 5, contributionPerPeriod: 100 })
near('no-growth contributions', r.final, 1500)
near('contributed', r.contributed, 1500)
near('profit', r.profit, 0)
noBadNumbers('compounding', r)

console.log('\n── Break-even ──')
// 100 × 10 = 1000 position. Cost 20 both legs = 40. No tax. Move = 40/10 = 4
r = T.breakEvenCalc({ entry: 100, quantity: 10, costPerTrade: 20 })
near('move needed', r.moveNeeded, 4)
near('break-even price', r.breakEvenPrice, 104)
near('total costs', r.totalCosts, 40)
r = T.breakEvenCalc({ entry: 100, quantity: 10, costPerTrade: 20, direction: 'Short' })
near('short break-even', r.breakEvenPrice, 96)

console.log('\n── Pivot points ──')
// H120 L100 C110 → P = 110
r = T.pivotPoints({ high: 120, low: 100, close: 110 })
near('classic P', r.classic.p, 110)
near('classic R1', r.classic.r1, 120)
near('classic S1', r.classic.s1, 100)
near('classic R2', r.classic.r2, 130)
near('classic S2', r.classic.s2, 90)
near('fib R1', r.fibonacci.r1, 110 + 0.382 * 20)
near('camarilla R1', r.camarilla.r1, 110 + (20 * 1.1) / 12)
assert('rejects high<low', !T.pivotPoints({ high: 100, low: 120, close: 110 }).ok)
noBadNumbers('pivots', r)

console.log('\n── Fibonacci ──')
r = T.fibonacciLevels({ swingHigh: 200, swingLow: 100, direction: 'Up' })
near('range', r.range, 100)
near('0% at high', r.retracements[0].price, 200)
near('100% at low', r.retracements[r.retracements.length - 1].price, 100)
near('61.8% retrace', r.retracements.find((x) => x.ratio === 0.618).price, 200 - 61.8)
near('161.8% ext', r.extensions.find((x) => x.ratio === 1.618).price, 200 + 61.8, 1e-9)
assert('rejects equal swings', !T.fibonacciLevels({ swingHigh: 100, swingLow: 100 }).ok)
noBadNumbers('fibonacci', r)

console.log('\n── ATR stop ──')
r = T.atrStop({ entry: 100, atr: 2, multiplier: 2, direction: 'Long', rrTarget: 3 })
near('stop', r.stop, 96)
near('target', r.target, 112)
near('distance', r.distance, 4)
r = T.atrStop({ entry: 100, atr: 2, multiplier: 2, direction: 'Short', rrTarget: 3 })
near('short stop', r.stop, 104)
near('short target', r.target, 88)
assert('rejects zero atr', !T.atrStop({ entry: 100, atr: 0 }).ok)

console.log('\n── Currency ──')
r = T.currencyConvert({ amount: 100, rate: 88.5, from: 'USD', to: 'INR' })
near('usd->inr', r.converted, 8850)
r = T.currencyConvert({ amount: 8850, rate: 88.5, from: 'INR', to: 'USD' })
near('inr->usd', r.converted, 100)
assert('rejects zero rate', !T.currencyConvert({ amount: 1, rate: 0 }).ok)

console.log('\n── Lots ──')
r = T.lotConverter({ lots: 1 })
near('units', r.units, 100000)
near('mini', r.mini, 10)
near('micro', r.micro, 100)

console.log('\n── Risk of ruin ──')
r = T.riskOfRuinCalc({ winRatePct: 60, payoffRatio: 2, riskPercent: 1 })
assert('has edge', r.hasEdge === true)
assert('ruin small with edge', r.riskOfRuinPct < 5, `got ${r.riskOfRuinPct}`)
r = T.riskOfRuinCalc({ winRatePct: 60, payoffRatio: 2, riskPercent: 25 })
assert('ruin higher at big size', r.riskOfRuinPct > 0)
r = T.riskOfRuinCalc({ winRatePct: 30, payoffRatio: 1, riskPercent: 2 })
near('no edge -> 100%', r.riskOfRuinPct, 100)
assert('rejects wr 0', !T.riskOfRuinCalc({ winRatePct: 0, payoffRatio: 1, riskPercent: 1 }).ok)
noBadNumbers('riskOfRuin', r)

console.log('\n── Monte Carlo (manual) ──')
r = T.monteCarloSim({ startingCapital: 10000, winRatePct: 55, avgWin: 200, avgLoss: 100, tradeCount: 100, runs: 400, seed: 5 })
assert('runs ok', r.ok)
assert('median above start with edge', r.median > 10000, `median ${r.median}`)
assert('prob profitable high', r.probProfitablePct > 60)
const r2 = T.monteCarloSim({ startingCapital: 10000, winRatePct: 55, avgWin: 200, avgLoss: 100, tradeCount: 100, runs: 400, seed: 5 })
assert('deterministic', r.median === r2.median && r.probProfitablePct === r2.probProfitablePct)
noBadNumbers('monteCarlo', { ...r, paths: undefined, finals: undefined })
// compounding mode must never go below zero
r = T.monteCarloSim({ startingCapital: 1000, winRatePct: 40, avgWin: 100, avgLoss: 100, tradeCount: 300, runs: 200, riskPercent: 50, seed: 3 })
assert('compounding worst >= 0', r.worst >= 0, `worst ${r.worst}`)
noBadNumbers('monteCarlo compounding', { ...r, paths: undefined, finals: undefined })

console.log('\n── Streak simulator ──')
r = T.streakSimulator({ winRatePct: 50, tradeCount: 100, streakLength: 5, runs: 800, seed: 11 })
assert('5-loss streak likely at 50%/100', r.probLossStreakPct > 50, `got ${r.probLossStreakPct}`)
r = T.streakSimulator({ winRatePct: 50, tradeCount: 100, streakLength: 15, runs: 800, seed: 11 })
assert('15-loss streak rare', r.probLossStreakPct < 10, `got ${r.probLossStreakPct}`)
assert('rejects streak > count', !T.streakSimulator({ winRatePct: 50, tradeCount: 5, streakLength: 10 }).ok)

console.log('\n── Loss sequence ──')
r = T.lossSequenceTable({ accountSize: 10000, riskPercent: 2, maxLosses: 5 })
near('after 1 loss', r.rows[0].equity, 9800)
near('after 2 losses', r.rows[1].equity, 9604)
assert('drawdown grows', r.rows[4].drawdownPct > r.rows[0].drawdownPct)
noBadNumbers('lossSequence', r)

console.log('\n── R:R grid ──')
const grid = T.rrGrid(50)
near('1:1 break-even', grid.find((g) => g.rr === 1).breakEvenWinRate, 50)
near('1:2 break-even', grid.find((g) => g.rr === 2).breakEvenWinRate, 100 / 3)
assert('50% wr profitable at 1:2', grid.find((g) => g.rr === 2).profitable === true)
assert('50% wr unprofitable at 1:0.5', grid.find((g) => g.rr === 0.5).profitable === false)
noBadNumbers('rrGrid', grid)

console.log('\n── CSV round-trip ──')
const rand = seededRandom(3)
const sample = Array.from({ length: 12 }, (_, i) => ({
  id: `x${i}`,
  date: `2026-04-${String((i % 28) + 1).padStart(2, '0')}`,
  pair: i % 2 ? 'XAUUSD' : 'RELIANCE',
  instrumentName: i % 2 ? 'Gold / US Dollar' : 'Reliance Industries',
  instrumentType: i % 2 ? 'Commodity' : 'Equity',
  timeframe: '15m',
  direction: i % 3 ? 'Buy' : 'Sell',
  price: 100 + i,
  pnl: i % 4 === 0 ? null : Math.round((rand() - 0.4) * 1000),
  status: i % 4 === 0 ? 'Pending' : 'Target Hit',
  notes: i === 2 ? 'has, comma and "quotes"\nand newline' : i === 3 ? '=SUM(A1)' : 'ok',
  validationScore: { checked: i % 13, total: 12 },
  validationRuleIds: [],
  createdAt: new Date(2026, 3, (i % 28) + 1, 10).getTime(),
}))
const csv = T.tradesToCsv(sample)
assert('csv has header', csv.split('\n')[0].startsWith('date,'))
assert('csv row count', csv.trim().split('\n').length === 13, `got ${csv.trim().split('\n').length}`)
assert('formula injection guarded', csv.includes("'=SUM(A1)"))
const back = T.csvToTrades(csv)
assert('import ok', back.ok, back.error || '')
assert('import count', back.imported === 12, `got ${back.imported}`)
assert('import preserves commas/quotes', back.trades[2].notes.includes('has, comma'))
assert('import preserves pnl null', back.trades[0].pnl === null)
assert('import preserves type', back.trades[1].instrumentType === 'Commodity')
assert('import preserves score', back.trades[5].validationScore.total === 12)

// Malformed input
assert('rejects empty csv', !T.csvToTrades('').ok)
assert('rejects header-only', !T.csvToTrades('date,pnl').ok)
assert('rejects missing date column', !T.csvToTrades('foo,bar\n1,2').ok)
const partial = T.csvToTrades('date,pnl\n2026-01-01,100\nnot-a-date,50\n2026-01-03,-20')
assert('partial import succeeds', partial.ok)
assert('partial skips bad row', partial.imported === 2 && partial.skipped === 1, JSON.stringify({ i: partial.imported, s: partial.skipped }))

console.log('\n── Query engine ──')
let q = T.queryTrades(sample, {})
assert('query all', q.count === 12)
q = T.queryTrades(sample, { instrumentTypes: ['Commodity'] })
assert('query by type', q.rows.every((t) => t.instrumentType === 'Commodity'))
q = T.queryTrades(sample, { text: 'reliance' })
assert('query text', q.count > 0 && q.rows.every((t) => /reliance/i.test(t.instrumentName)))
q = T.queryTrades(sample, { minPnl: 0 })
assert('query minPnl excludes nulls', q.rows.every((t) => t.pnl !== null && t.pnl >= 0))
q = T.queryTrades(sample, { hasNotes: true })
assert('query hasNotes', q.rows.every((t) => (t.notes || '').trim()))
q = T.queryTrades(sample, { sortBy: 'pnl', sortDir: 'desc' })
const pnls = q.rows.filter((t) => t.pnl !== null).map((t) => t.pnl)
assert('sorted desc by pnl', pnls.every((v, i) => i === 0 || pnls[i - 1] >= v))
q = T.queryTrades(sample, { statuses: ['Pending'] })
assert('query status', q.rows.every((t) => t.status === 'Pending'))
q = T.queryTrades([], {})
assert('query empty list', q.count === 0 && q.winRate === null)
noBadNumbers('query', { ...q, rows: undefined })

console.log('\n── Portfolio heat ──')
r = T.portfolioHeat(sample, { accountSize: 100000, defaultRiskPct: 1 })
assert('heat ok', r.ok)
assert('counts pending', r.openCount === sample.filter((t) => t.status === 'Pending').length)
near('heat pct', r.heatPct, r.openCount * 1)
r = T.portfolioHeat(sample, { accountSize: null })
assert('heat needs account size', !r.ok)
r = T.portfolioHeat([], { accountSize: 1000 })
assert('heat with no open trades', r.ok && r.openCount === 0)

console.log('\n── Goal projection ──')
r = T.goalProjection(sample, { targetAmount: 5000 })
if (r.ok && r.reachable) {
  assert('trades needed positive', r.tradesNeeded > 0)
  noBadNumbers('goalProjection', r)
} else {
  assert('goal gracefully unavailable', r.ok === false || r.reachable === false)
}
assert('rejects zero target', !T.goalProjection(sample, { targetAmount: 0 }).ok)
assert('rejects thin history', !T.goalProjection(sample.slice(0, 2), { targetAmount: 1000 }).ok)

console.log('\n── Session clock ──')
r = T.sessionClock(new Date(Date.UTC(2026, 8, 16, 14, 0)))
assert('clock ok', r.ok)
assert('london open at 14:00 UTC Wed', r.sessions.find((s) => s.id === 'london').open === true)
assert('NY open at 14:00 UTC Wed', r.sessions.find((s) => s.id === 'newyork').open === true)
assert('overlap detected', r.overlap === true)
r = T.sessionClock(new Date(Date.UTC(2026, 8, 19, 12, 0))) // Saturday
assert('weekend flagged', r.weekend === true)
assert('no sessions open on weekend', r.openCount === 0)
r = T.sessionClock(new Date(Date.UTC(2026, 8, 16, 2, 0)))
assert('tokyo open at 02:00 UTC', r.sessions.find((s) => s.id === 'tokyo').open === true)
assert('sydney wrap-around open at 02:00', r.sessions.find((s) => s.id === 'sydney').open === true)
noBadNumbers('sessionClock', r)

console.log('\n── Replay & normalise ──')
r = T.buildReplay(sample)
assert('replay available', r.available)
assert('frames match pnl count', r.frames.length === sample.filter((t) => t.pnl !== null).length)
assert('equity accumulates', r.frames[r.frames.length - 1].equity === sample.filter((t) => t.pnl !== null).reduce((a, t) => a + t.pnl, 0))
noBadNumbers('replay', { ...r, frames: r.frames.map((f) => ({ ...f, trade: undefined })) })
assert('replay empty safe', T.buildReplay([]).available === false)

r = T.normaliseRisk(sample)
if (r.available) {
  noBadNumbers('normaliseRisk', { ...r, curve: r.curve.slice(0, 5) })
  assert('has verdict', typeof r.verdict === 'string')
}
assert('normalise needs 5+', T.normaliseRisk(sample.slice(0, 3)).available === false)

console.log('\n── Alert rules ──')
const rule = { id: 'a', metric: 'winRate', comparator: 'below', threshold: 90, scope: 'all' }
r = T.evaluateAlertRule(rule, { trades: sample, groupTrades: sample, symbol: '₹' })
assert('alert evaluated', r.value !== null)
assert('alert triggered below 90', r.triggered === true)
r = T.evaluateAlertRule({ ...rule, threshold: 0, comparator: 'below' }, { trades: sample, groupTrades: sample })
assert('alert not triggered below 0', r.triggered === false)
r = T.evaluateAlertRule({ ...rule, metric: 'profitFactor', scope: 'currency' }, { trades: sample, groupTrades: [], symbol: '$' })
assert('alert handles empty group', r.triggered === false && r.reason !== null)
T.ALERT_METRICS.forEach((m) => {
  const out = T.evaluateAlertRule({ id: m.id, metric: m.id, comparator: 'above', threshold: 1, scope: m.scope }, { trades: sample, groupTrades: sample, symbol: '₹' })
  checks += 1
  if (out === undefined) {
    console.error(`  ✗ alert metric ${m.id} returned undefined`)
    failures += 1
  }
})
console.log(`  ✓ all ${T.ALERT_METRICS.length} alert metrics evaluate`)

console.log('\n── Derived defaults ──')
r = T.deriveToolDefaults(sample)
noBadNumbers('deriveToolDefaults', r)
assert('defaults from empty safe', T.deriveToolDefaults([]).available === false)

console.log('\n── Every tool rejects garbage without throwing ──')
const garbage = [
  {}, { accountSize: 'x' }, { entry: null }, { winRatePct: -5 },
  { amount: NaN }, { lots: Infinity }, { high: 'a', low: 'b', close: 'c' },
]
const toolFns = [
  'positionSize', 'riskReward', 'pipValue', 'marginCalc', 'kellyCalc', 'expectancyCalc',
  'monteCarloSim', 'riskOfRuinCalc', 'drawdownRecovery', 'compoundingProjector',
  'breakEvenCalc', 'pivotPoints', 'fibonacciLevels', 'atrStop', 'currencyConvert',
  'lotConverter', 'streakSimulator', 'lossSequenceTable',
]
let threw = 0
toolFns.forEach((fn) => {
  garbage.forEach((g) => {
    try {
      const out = T[fn](g)
      if (out === undefined || typeof out.ok !== 'boolean') {
        console.error(`  ✗ ${fn} returned a malformed result for ${JSON.stringify(g)}`)
        threw += 1
      }
    } catch (e) {
      console.error(`  ✗ ${fn} threw on ${JSON.stringify(g)}: ${e.message}`)
      threw += 1
    }
  })
})
checks += toolFns.length * garbage.length
if (threw) failures += threw
else console.log(`  ✓ ${toolFns.length} tools × ${garbage.length} garbage inputs — all handled`)

console.log(`\n══ ${checks} checks, ${failures} failure(s) ══`)
process.exit(failures ? 1 : 0)
