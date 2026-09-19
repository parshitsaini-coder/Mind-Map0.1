// Trade Analysis — the calculation layer behind the Tools tab.
//
// Every function here is a real calculator with real formulas, taking the
// numbers the person types in (or the ones their own journal already
// holds) and returning honest answers. Nothing is stubbed, nothing returns
// a sample figure, and anything that can't be computed from the inputs
// given comes back as `null` with a reason attached.
//
// Contract shared by every calculator:
//   { ok: boolean, error: string|null, ...results }
// The UI shows `error` verbatim when ok is false, so the messages here are
// written for a person, not a log file.

import { mean, percentile, seededRandom } from './stats'
import {
  getDrawdownStats, getKelly, getPerformance, hasPnl, outcomeOf, parseDate, pnlOf, sortChrono, stockLabel,
} from './tradeAnalyticsPro'

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const fail = (error) => ({ ok: false, error })

// ---------------------------------------------------------------------
// TOOL 1 — Position Size Calculator
// ---------------------------------------------------------------------

/**
 * The most important calculation in trading: how many units can be bought
 * such that hitting the stop costs exactly the intended fraction of the
 * account. Works for any instrument because it reasons in price distance,
 * not in lots.
 */
export function positionSize({ accountSize, riskPercent, entry, stopLoss, lotSize = 1 }) {
  const acct = num(accountSize)
  const riskPct = num(riskPercent)
  const e = num(entry)
  const sl = num(stopLoss)
  const lot = num(lotSize) || 1

  if (acct === null || acct <= 0) return fail('Enter an account size greater than zero.')
  if (riskPct === null || riskPct <= 0) return fail('Enter the percentage of the account you are willing to risk.')
  if (riskPct > 100) return fail('Risk per trade cannot exceed 100% of the account.')
  if (e === null || e <= 0) return fail('Enter an entry price.')
  if (sl === null || sl <= 0) return fail('Enter a stop-loss price.')
  if (e === sl) return fail('Entry and stop-loss cannot be the same price — there would be no risk to size against.')

  const riskAmount = acct * (riskPct / 100)
  const stopDistance = Math.abs(e - sl)
  const rawUnits = riskAmount / stopDistance
  const units = Math.floor(rawUnits / lot) * lot
  const actualRisk = units * stopDistance
  const positionValue = units * e

  return {
    ok: true,
    error: null,
    riskAmount,
    stopDistance,
    stopDistancePct: (stopDistance / e) * 100,
    rawUnits,
    units,
    lots: lot > 1 ? units / lot : units,
    actualRisk,
    actualRiskPct: (actualRisk / acct) * 100,
    positionValue,
    positionPctOfAccount: (positionValue / acct) * 100,
    direction: e > sl ? 'Long' : 'Short',
    // Flags a position bigger than the account — legitimate with leverage,
    // but it should never be a surprise.
    needsLeverage: positionValue > acct,
    leverageNeeded: positionValue > acct ? positionValue / acct : null,
  }
}

// ---------------------------------------------------------------------
// TOOL 2 — Risk / Reward Planner
// ---------------------------------------------------------------------

export function riskReward({ entry, stopLoss, target, winRatePct }) {
  const e = num(entry)
  const sl = num(stopLoss)
  const tp = num(target)
  const wr = num(winRatePct)

  if (e === null) return fail('Enter an entry price.')
  if (sl === null) return fail('Enter a stop-loss price.')
  if (tp === null) return fail('Enter a target price.')
  if (e === sl) return fail('Entry and stop-loss cannot match.')

  const risk = Math.abs(e - sl)
  const reward = Math.abs(tp - e)
  const rr = risk === 0 ? null : reward / risk

  const isLong = tp > e
  const stopOnRightSide = isLong ? sl < e : sl > e

  // The win rate this R:R needs just to break even — the number that
  // turns "is 1:2 good?" into an answerable question.
  const breakEvenWinRate = rr === null ? null : (1 / (1 + rr)) * 100
  const expectancyR = wr === null || rr === null ? null : (wr / 100) * rr - (1 - wr / 100)

  return {
    ok: true,
    error: null,
    risk,
    reward,
    rr,
    riskPct: (risk / e) * 100,
    rewardPct: (reward / e) * 100,
    direction: isLong ? 'Long' : 'Short',
    stopOnRightSide,
    warning: stopOnRightSide ? null : `For a ${isLong ? 'long' : 'short'}, the stop should sit ${isLong ? 'below' : 'above'} the entry.`,
    breakEvenWinRate,
    expectancyR,
    profitable: expectancyR === null ? null : expectancyR > 0,
  }
}

// ---------------------------------------------------------------------
// TOOL 3 — Pip Value Calculator (Forex)
// ---------------------------------------------------------------------

/**
 * Pip value for a standard/mini/micro lot. JPY pairs use a 0.01 pip; every
 * other pair uses 0.0001. For a quote-currency-is-USD pair (EUR/USD) the
 * value is fixed; otherwise it needs the quote-to-account rate.
 */
export function pipValue({ pair, lots, quoteToAccountRate }) {
  const l = num(lots)
  if (l === null || l <= 0) return fail('Enter a lot size greater than zero.')

  const symbol = (pair || '').toUpperCase().replace(/[^A-Z]/g, '')
  const isJpy = symbol.endsWith('JPY')
  const pipSize = isJpy ? 0.01 : 0.0001
  const unitsPerLot = 100000
  const units = l * unitsPerLot

  // Value of one pip in the QUOTE currency.
  const pipInQuote = pipSize * units

  const rate = num(quoteToAccountRate)
  const quoteIsAccount = !rate || rate === 1
  const pipInAccount = quoteIsAccount ? pipInQuote : pipInQuote * rate

  return {
    ok: true,
    error: null,
    pair: symbol || '—',
    pipSize,
    units,
    pipInQuote,
    pipInAccount,
    usedRate: quoteIsAccount ? 1 : rate,
    note: quoteIsAccount
      ? 'Quote currency treated as your account currency (rate 1.0).'
      : `Converted at ${rate} per unit of quote currency.`,
    lotLabel: l >= 1 ? `${l} standard` : l >= 0.1 ? `${l} mini` : `${l} micro`,
  }
}

// ---------------------------------------------------------------------
// TOOL 4 — Margin & Leverage Calculator
// ---------------------------------------------------------------------

export function marginCalc({ positionValue, leverage, accountSize }) {
  const pv = num(positionValue)
  const lev = num(leverage)
  const acct = num(accountSize)

  if (pv === null || pv <= 0) return fail('Enter the position value.')
  if (lev === null || lev <= 0) return fail('Enter the leverage your broker gives you (e.g. 20 for 20:1).')

  const marginRequired = pv / lev
  const freeMargin = acct === null ? null : acct - marginRequired
  const marginLevelPct = acct === null || marginRequired === 0 ? null : (acct / marginRequired) * 100

  return {
    ok: true,
    error: null,
    marginRequired,
    marginPct: (1 / lev) * 100,
    freeMargin,
    marginLevelPct,
    usedPctOfAccount: acct ? (marginRequired / acct) * 100 : null,
    // Most brokers issue a margin call around 100% and stop out near 50%.
    marginCallRisk: marginLevelPct != null && marginLevelPct < 200,
    affordable: acct === null ? null : marginRequired <= acct,
  }
}

// ---------------------------------------------------------------------
// TOOL 5 — Kelly Criterion Calculator (manual inputs)
// ---------------------------------------------------------------------

export function kellyCalc({ winRatePct, avgWin, avgLoss }) {
  const wr = num(winRatePct)
  const w = num(avgWin)
  const l = num(avgLoss)

  if (wr === null || wr < 0 || wr > 100) return fail('Enter a win rate between 0 and 100.')
  if (w === null || w <= 0) return fail('Enter the average winning trade amount.')
  if (l === null || l <= 0) return fail('Enter the average losing trade amount as a positive number.')

  const p = wr / 100
  const b = w / l
  const kelly = p - (1 - p) / b
  const expectancy = p * w - (1 - p) * l

  return {
    ok: true,
    error: null,
    payoffRatio: b,
    kellyPct: kelly * 100,
    halfKellyPct: (kelly / 2) * 100,
    quarterKellyPct: (kelly / 4) * 100,
    expectancy,
    hasEdge: kelly > 0,
    breakEvenWinRate: (1 / (1 + b)) * 100,
    note:
      kelly <= 0
        ? 'These numbers describe a losing system — the mathematically optimal stake is zero.'
        : 'Full Kelly maximises growth but produces violent swings. Half-Kelly is the usual working ceiling.',
  }
}

// ---------------------------------------------------------------------
// TOOL 6 — Expectancy Calculator
// ---------------------------------------------------------------------

export function expectancyCalc({ winRatePct, avgWin, avgLoss, tradesPerMonth }) {
  const wr = num(winRatePct)
  const w = num(avgWin)
  const l = num(avgLoss)
  const freq = num(tradesPerMonth)

  if (wr === null || wr < 0 || wr > 100) return fail('Enter a win rate between 0 and 100.')
  if (w === null) return fail('Enter the average winning trade amount.')
  if (l === null || l <= 0) return fail('Enter the average losing trade amount as a positive number.')

  const p = wr / 100
  const expectancy = p * w - (1 - p) * l
  const expectancyR = l === 0 ? null : expectancy / l

  return {
    ok: true,
    error: null,
    expectancy,
    expectancyR,
    perMonth: freq ? expectancy * freq : null,
    perYear: freq ? expectancy * freq * 12 : null,
    tradesToDouble: null,
    payoffRatio: l === 0 ? null : w / l,
    breakEvenWinRate: l === 0 ? null : (l / (w + l)) * 100,
    profitable: expectancy > 0,
  }
}

// ---------------------------------------------------------------------
// TOOL 7 — Monte Carlo Simulator (manual parameters)
// ---------------------------------------------------------------------

/**
 * Simulates a sequence of trades from a win rate and win/loss sizes, with
 * optional percentage-of-equity sizing so compounding is modelled
 * properly. Seeded, so the same inputs always produce the same answer.
 */
export function monteCarloSim({
  startingCapital,
  winRatePct,
  avgWin,
  avgLoss,
  tradeCount,
  runs = 1000,
  riskPercent = null,
  seed = 20260919,
}) {
  const cap = num(startingCapital)
  const wr = num(winRatePct)
  const w = num(avgWin)
  const l = num(avgLoss)
  const n = num(tradeCount)

  if (cap === null || cap <= 0) return fail('Enter a starting capital greater than zero.')
  if (wr === null || wr < 0 || wr > 100) return fail('Enter a win rate between 0 and 100.')
  if (w === null || w <= 0) return fail('Enter the average win.')
  if (l === null || l <= 0) return fail('Enter the average loss as a positive number.')
  if (n === null || n < 1) return fail('Enter how many trades to simulate.')

  const simRuns = Math.min(5000, Math.max(100, Math.round(runs)))
  const steps = Math.min(2000, Math.round(n))
  const rand = seededRandom(seed)
  const p = wr / 100
  const riskPct = num(riskPercent)
  const compounding = riskPct !== null && riskPct > 0
  const payoff = w / l

  const finals = []
  const maxDraws = []
  const paths = []
  const keepEvery = Math.max(1, Math.floor(simRuns / 30))
  let ruined = 0
  let profitable = 0

  for (let r = 0; r < simRuns; r++) {
    let equity = cap
    let peak = cap
    let maxDd = 0
    const path = r % keepEvery === 0 ? [cap] : null
    for (let s = 0; s < steps; s++) {
      // With percentage sizing, one "loss" costs riskPct of current equity
      // and one "win" returns payoff × that. Without it, flat amounts.
      const riskUnit = compounding ? equity * (riskPct / 100) : l
      const delta = rand() < p ? riskUnit * payoff : -riskUnit
      equity += delta
      if (equity <= 0) {
        equity = 0
        if (path) path.push(0)
        break
      }
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > maxDd) maxDd = dd
      if (path) path.push(equity)
    }
    if (equity <= 0) ruined += 1
    if (equity > cap) profitable += 1
    finals.push(equity)
    maxDraws.push(maxDd)
    if (path) paths.push(path)
  }

  const band = (q) => percentile(finals, q)

  return {
    ok: true,
    error: null,
    runs: simRuns,
    steps,
    compounding,
    startingCapital: cap,
    paths,
    finals,
    p5: band(5),
    p25: band(25),
    median: band(50),
    p75: band(75),
    p95: band(95),
    mean: mean(finals),
    best: Math.max(...finals),
    worst: Math.min(...finals),
    probProfitablePct: (profitable / simRuns) * 100,
    probRuinPct: (ruined / simRuns) * 100,
    medianMaxDrawdown: percentile(maxDraws, 50),
    p95MaxDrawdown: percentile(maxDraws, 95),
    worstMaxDrawdown: Math.max(...maxDraws),
    medianReturnPct: ((band(50) - cap) / cap) * 100,
  }
}

// ---------------------------------------------------------------------
// TOOL 8 — Risk of Ruin Calculator
// ---------------------------------------------------------------------

export function riskOfRuinCalc({ winRatePct, payoffRatio, riskPercent, ruinThresholdPct = 100 }) {
  const wr = num(winRatePct)
  const b = num(payoffRatio)
  const riskPct = num(riskPercent)
  const threshold = num(ruinThresholdPct) ?? 100

  if (wr === null || wr <= 0 || wr >= 100) return fail('Enter a win rate between 1 and 99.')
  if (b === null || b <= 0) return fail('Enter the payoff ratio (average win ÷ average loss).')
  if (riskPct === null || riskPct <= 0 || riskPct > 100) return fail('Enter the percentage of capital risked per trade.')

  const p = wr / 100
  const q = 1 - p
  const edge = p * b - q

  // How many consecutive full-risk losses the account can absorb before
  // it is down by the ruin threshold.
  const capitalUnits = Math.max(1, Math.floor(threshold / riskPct))

  if (edge <= 0) {
    return {
      ok: true,
      error: null,
      riskOfRuinPct: 100,
      edge,
      capitalUnits,
      hasEdge: false,
      note: 'With no positive edge, ruin is a certainty over a long enough series — no position size fixes that.',
    }
  }

  // Solve w·a^b + (1-w)/a = 1 for a ∈ (0,1); ruin = a^units.
  let lo = 0
  let hi = 1
  for (let i = 0; i < 100; i++) {
    const a = (lo + hi) / 2
    const f = p * a ** b + q / a - 1
    if (f > 0) lo = a
    else hi = a
  }
  const a = (lo + hi) / 2
  const ruin = Math.min(1, Math.max(0, a ** capitalUnits))

  return {
    ok: true,
    error: null,
    riskOfRuinPct: ruin * 100,
    edge,
    capitalUnits,
    hasEdge: true,
    consecutiveLossesToRuin: capitalUnits,
    note:
      ruin * 100 < 1
        ? 'Well inside a survivable range at this size.'
        : ruin * 100 < 10
          ? 'Survivable, but the tail is real — size down if the win rate slips.'
          : 'Dangerous. Cutting risk per trade drops this number faster than anything else.',
  }
}

// ---------------------------------------------------------------------
// TOOL 9 — Drawdown Recovery Calculator
// ---------------------------------------------------------------------

/**
 * The asymmetry that surprises everyone: a 50% loss needs a 100% gain to
 * get back. Returns the full curve so the widget can show why.
 */
export function drawdownRecovery({ drawdownPct, avgReturnPerTrade }) {
  const dd = num(drawdownPct)
  const ret = num(avgReturnPerTrade)

  if (dd === null || dd <= 0 || dd >= 100) return fail('Enter a drawdown between 1% and 99%.')

  const remaining = 1 - dd / 100
  const gainNeededPct = (1 / remaining - 1) * 100

  let tradesToRecover = null
  if (ret !== null && ret > 0) {
    tradesToRecover = Math.ceil(Math.log(1 / remaining) / Math.log(1 + ret / 100))
  }

  const curve = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90].map((d) => ({
    drawdownPct: d,
    gainNeededPct: (1 / (1 - d / 100) - 1) * 100,
  }))

  return {
    ok: true,
    error: null,
    drawdownPct: dd,
    gainNeededPct,
    remainingCapitalPct: remaining * 100,
    tradesToRecover,
    curve,
    severity: dd >= 50 ? 'severe' : dd >= 25 ? 'heavy' : dd >= 10 ? 'moderate' : 'light',
  }
}

// ---------------------------------------------------------------------
// TOOL 10 — Compounding Projector
// ---------------------------------------------------------------------

export function compoundingProjector({ startingCapital, returnPerPeriodPct, periods, contributionPerPeriod = 0 }) {
  const cap = num(startingCapital)
  const ret = num(returnPerPeriodPct)
  const n = num(periods)
  const add = num(contributionPerPeriod) || 0

  if (cap === null || cap <= 0) return fail('Enter a starting capital greater than zero.')
  if (ret === null) return fail('Enter the expected return per period as a percentage.')
  if (n === null || n < 1) return fail('Enter how many periods to project.')

  const steps = Math.min(600, Math.round(n))
  const rows = []
  let equity = cap
  let contributed = cap

  for (let i = 1; i <= steps; i++) {
    const growth = equity * (ret / 100)
    equity += growth + add
    contributed += add
    if (equity < 0) equity = 0
    rows.push({ period: i, equity, growth, contributed, profit: equity - contributed })
  }

  const final = rows.length ? rows[rows.length - 1].equity : cap
  const totalReturnPct = ((final - contributed) / contributed) * 100

  // Rule-of-72 style doubling time, solved exactly.
  const doubleIn = ret > 0 ? Math.log(2) / Math.log(1 + ret / 100) : null

  return {
    ok: true,
    error: null,
    rows,
    final,
    contributed,
    profit: final - contributed,
    totalReturnPct,
    multiple: contributed > 0 ? final / contributed : null,
    doublingPeriods: doubleIn,
  }
}

// ---------------------------------------------------------------------
// TOOL 11 — Break-even Calculator
// ---------------------------------------------------------------------

export function breakEvenCalc({ entry, quantity, costPerTrade = 0, taxPct = 0, direction = 'Long' }) {
  const e = num(entry)
  const q = num(quantity)
  const cost = num(costPerTrade) || 0
  const tax = num(taxPct) || 0

  if (e === null || e <= 0) return fail('Enter an entry price.')
  if (q === null || q <= 0) return fail('Enter a quantity.')

  const positionValue = e * q
  // Costs are paid on both legs; tax applies to turnover.
  const totalCosts = cost * 2 + positionValue * (tax / 100) * 2
  const moveNeeded = totalCosts / q
  const isLong = direction !== 'Short'
  const breakEvenPrice = isLong ? e + moveNeeded : e - moveNeeded

  return {
    ok: true,
    error: null,
    positionValue,
    totalCosts,
    moveNeeded,
    moveNeededPct: (moveNeeded / e) * 100,
    breakEvenPrice,
    direction: isLong ? 'Long' : 'Short',
    costAsPctOfPosition: (totalCosts / positionValue) * 100,
  }
}

// ---------------------------------------------------------------------
// TOOL 12 — Pivot Points (4 methods)
// ---------------------------------------------------------------------

/**
 * Classic, Fibonacci, Camarilla and Woodie pivots from the previous
 * period's high/low/close. All four are standard published formulas.
 */
export function pivotPoints({ high, low, close, open }) {
  const h = num(high)
  const l = num(low)
  const c = num(close)
  const o = num(open)

  if (h === null) return fail('Enter the previous period high.')
  if (l === null) return fail('Enter the previous period low.')
  if (c === null) return fail('Enter the previous period close.')
  if (h < l) return fail('High cannot be below low.')

  const range = h - l

  const classicP = (h + l + c) / 3
  const classic = {
    r3: h + 2 * (classicP - l),
    r2: classicP + range,
    r1: 2 * classicP - l,
    p: classicP,
    s1: 2 * classicP - h,
    s2: classicP - range,
    s3: l - 2 * (h - classicP),
  }

  const fibonacci = {
    r3: classicP + range,
    r2: classicP + 0.618 * range,
    r1: classicP + 0.382 * range,
    p: classicP,
    s1: classicP - 0.382 * range,
    s2: classicP - 0.618 * range,
    s3: classicP - range,
  }

  const camarilla = {
    r4: c + (range * 1.1) / 2,
    r3: c + (range * 1.1) / 4,
    r2: c + (range * 1.1) / 6,
    r1: c + (range * 1.1) / 12,
    p: classicP,
    s1: c - (range * 1.1) / 12,
    s2: c - (range * 1.1) / 6,
    s3: c - (range * 1.1) / 4,
    s4: c - (range * 1.1) / 2,
  }

  const woodieP = o !== null ? (h + l + 2 * o) / 4 : (h + l + 2 * c) / 4
  const woodie = {
    r2: woodieP + range,
    r1: 2 * woodieP - l,
    p: woodieP,
    s1: 2 * woodieP - h,
    s2: woodieP - range,
  }

  return {
    ok: true,
    error: null,
    range,
    classic,
    fibonacci,
    camarilla,
    woodie,
    usedOpenForWoodie: o !== null,
  }
}

// ---------------------------------------------------------------------
// TOOL 13 — Fibonacci Retracement & Extension
// ---------------------------------------------------------------------

export function fibonacciLevels({ swingHigh, swingLow, direction = 'Up' }) {
  const hi = num(swingHigh)
  const lo = num(swingLow)

  if (hi === null) return fail('Enter the swing high.')
  if (lo === null) return fail('Enter the swing low.')
  if (hi === lo) return fail('Swing high and swing low cannot be the same price.')

  const high = Math.max(hi, lo)
  const low = Math.min(hi, lo)
  const range = high - low
  const up = direction !== 'Down'

  const retracementRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1]
  const extensionRatios = [1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236]

  const retracements = retracementRatios.map((r) => ({
    ratio: r,
    label: r === 0 ? '0%' : r === 1 ? '100%' : `${(r * 100).toFixed(1)}%`,
    price: up ? high - range * r : low + range * r,
    golden: r === 0.618 || r === 0.5,
  }))

  const extensions = extensionRatios.map((r) => ({
    ratio: r,
    label: `${(r * 100).toFixed(1)}%`,
    price: up ? high + range * (r - 1) : low - range * (r - 1),
    golden: r === 1.618,
  }))

  return {
    ok: true,
    error: null,
    high,
    low,
    range,
    direction: up ? 'Up' : 'Down',
    retracements,
    extensions,
    goldenZone: up
      ? { from: high - range * 0.618, to: high - range * 0.5 }
      : { from: low + range * 0.5, to: low + range * 0.618 },
  }
}

// ---------------------------------------------------------------------
// TOOL 14 — ATR Stop Calculator
// ---------------------------------------------------------------------

export function atrStop({ entry, atr, multiplier = 2, direction = 'Long', rrTarget = 2 }) {
  const e = num(entry)
  const a = num(atr)
  const m = num(multiplier) || 2
  const rr = num(rrTarget) || 2

  if (e === null || e <= 0) return fail('Enter an entry price.')
  if (a === null || a <= 0) return fail('Enter the ATR value for your timeframe.')

  const distance = a * m
  const isLong = direction !== 'Short'
  const stop = isLong ? e - distance : e + distance
  const target = isLong ? e + distance * rr : e - distance * rr

  return {
    ok: true,
    error: null,
    distance,
    distancePct: (distance / e) * 100,
    stop,
    target,
    rr,
    direction: isLong ? 'Long' : 'Short',
    atrMultiple: m,
    // A stop inside 0.5 ATR gets taken out by ordinary noise.
    tooTight: m < 0.5,
  }
}

// ---------------------------------------------------------------------
// TOOL 15 — Currency Converter
// ---------------------------------------------------------------------

/**
 * Converts between the two currencies this app deals in, using a rate the
 * person supplies. There's no live FX feed here on purpose — a stale
 * hard-coded rate would be worse than an honest input box, and this way
 * the number is always one they endorse.
 */
export function currencyConvert({ amount, rate, from = 'USD', to = 'INR' }) {
  const a = num(amount)
  const r = num(rate)

  if (a === null) return fail('Enter an amount to convert.')
  if (r === null || r <= 0) return fail('Enter the exchange rate you want to use.')

  const converted = from === to ? a : from === 'USD' ? a * r : a / r

  return {
    ok: true,
    error: null,
    amount: a,
    converted,
    rate: r,
    from,
    to,
    inverseRate: 1 / r,
  }
}

// ---------------------------------------------------------------------
// TOOL 16 — Lot / Unit Converter
// ---------------------------------------------------------------------

export function lotConverter({ lots, unitsPerLot = 100000 }) {
  const l = num(lots)
  const upl = num(unitsPerLot) || 100000
  if (l === null || l < 0) return fail('Enter a lot size.')

  const units = l * upl
  return {
    ok: true,
    error: null,
    units,
    standard: units / 100000,
    mini: units / 10000,
    micro: units / 1000,
    nano: units / 100,
    unitsPerLot: upl,
  }
}

// ---------------------------------------------------------------------
// TOOL 17 — Portfolio Heat
// ---------------------------------------------------------------------

/**
 * Total risk currently live across all open positions. Answers "if every
 * open stop got hit today, what would that cost?" — the question that
 * separates a controlled book from an accidental one.
 */
export function portfolioHeat(trades, { accountSize, defaultRiskPct = 1 }) {
  const acct = num(accountSize)
  const pending = trades.filter((t) => !t.status || t.status === 'Pending')

  if (!pending.length) {
    return { ok: true, error: null, openCount: 0, heatPct: 0, positions: [], accountSize: acct, overExposed: false }
  }
  if (acct === null || acct <= 0) {
    return fail('Enter your account size to see how much risk is live right now.')
  }

  const riskPct = num(defaultRiskPct) ?? 1
  const positions = pending.map((t) => ({
    id: t.id,
    name: stockLabel(t),
    direction: t.direction,
    timeframe: t.timeframe,
    date: parseDate(t),
    daysOpen: Math.round((Date.now() - parseDate(t).getTime()) / 86400000),
    riskAmount: acct * (riskPct / 100),
    riskPct,
  }))

  const heatPct = positions.length * riskPct
  const byInstrument = new Map()
  positions.forEach((p) => byInstrument.set(p.name, (byInstrument.get(p.name) || 0) + p.riskPct))

  return {
    ok: true,
    error: null,
    openCount: positions.length,
    positions: positions.sort((a, b) => b.daysOpen - a.daysOpen),
    heatPct,
    heatAmount: acct * (heatPct / 100),
    accountSize: acct,
    perInstrument: [...byInstrument.entries()].map(([name, p]) => ({ name, pct: p })).sort((a, b) => b.pct - a.pct),
    // 6% total heat is the widely-cited ceiling from Elder's work.
    overExposed: heatPct > 6,
    assumedRiskPct: riskPct,
  }
}

// ---------------------------------------------------------------------
// TOOL 18 — Goal Projection
// ---------------------------------------------------------------------

/**
 * How long a target takes at the journal's own realised expectancy and
 * trade frequency. Pure extrapolation of real history — labelled as such.
 */
export function goalProjection(trades, { targetAmount, currentAmount = 0 }) {
  const target = num(targetAmount)
  const current = num(currentAmount) || 0

  if (target === null || target <= 0) return fail('Enter the profit target you are working towards.')

  const perf = getPerformance(trades)
  if (perf.expectancy == null || perf.tradesWithPnl < 5) {
    return fail('Log at least five trades with a P&L before projecting — anything less is guesswork.')
  }
  if (perf.expectancy <= 0) {
    return {
      ok: true,
      error: null,
      reachable: false,
      expectancy: perf.expectancy,
      note: 'Expectancy is currently negative, so more trades move you further from the target, not closer.',
      progressPct: target > 0 ? Math.min(100, (current / target) * 100) : 0,
      remaining: target - current,
    }
  }

  const remaining = Math.max(0, target - current)
  const tradesNeeded = Math.ceil(remaining / perf.expectancy)

  const rows = sortChrono(trades)
  let perWeek = null
  if (rows.length >= 2) {
    const span = Math.max(1, (parseDate(rows[rows.length - 1]) - parseDate(rows[0])) / 86400000)
    perWeek = (rows.length / span) * 7
  }

  return {
    ok: true,
    error: null,
    reachable: true,
    expectancy: perf.expectancy,
    remaining,
    tradesNeeded,
    progressPct: target > 0 ? Math.min(100, (current / target) * 100) : 0,
    tradesPerWeek: perWeek,
    weeksNeeded: perWeek ? tradesNeeded / perWeek : null,
    basedOn: perf.tradesWithPnl,
  }
}

// ---------------------------------------------------------------------
// TOOL 19 — Streak Simulator
// ---------------------------------------------------------------------

/**
 * Given a win rate, what's the chance of hitting a losing streak of N in
 * a series of M trades? Most traders wildly underestimate this, then read
 * a normal streak as a broken system.
 */
export function streakSimulator({ winRatePct, tradeCount, streakLength, runs = 4000, seed = 424242 }) {
  const wr = num(winRatePct)
  const n = num(tradeCount)
  const k = num(streakLength)

  if (wr === null || wr <= 0 || wr >= 100) return fail('Enter a win rate between 1 and 99.')
  if (n === null || n < 2) return fail('Enter how many trades the series covers.')
  if (k === null || k < 2) return fail('Enter the streak length to test (2 or more).')
  if (k > n) return fail('The streak cannot be longer than the series.')

  const simRuns = Math.min(20000, Math.max(500, Math.round(runs)))
  const steps = Math.min(5000, Math.round(n))
  const target = Math.round(k)
  const p = wr / 100
  const rand = seededRandom(seed)

  let hitLoss = 0
  let hitWin = 0
  let longestLossSeen = 0
  let longestWinSeen = 0
  const longestLosses = []

  for (let r = 0; r < simRuns; r++) {
    let lossRun = 0
    let winRun = 0
    let maxLoss = 0
    let maxWin = 0
    for (let s = 0; s < steps; s++) {
      if (rand() < p) {
        winRun += 1
        lossRun = 0
      } else {
        lossRun += 1
        winRun = 0
      }
      if (lossRun > maxLoss) maxLoss = lossRun
      if (winRun > maxWin) maxWin = winRun
    }
    if (maxLoss >= target) hitLoss += 1
    if (maxWin >= target) hitWin += 1
    longestLossSeen = Math.max(longestLossSeen, maxLoss)
    longestWinSeen = Math.max(longestWinSeen, maxWin)
    longestLosses.push(maxLoss)
  }

  return {
    ok: true,
    error: null,
    runs: simRuns,
    steps,
    streakLength: target,
    probLossStreakPct: (hitLoss / simRuns) * 100,
    probWinStreakPct: (hitWin / simRuns) * 100,
    typicalLongestLoss: percentile(longestLosses, 50),
    p95LongestLoss: percentile(longestLosses, 95),
    worstLossSeen: longestLossSeen,
    bestWinSeen: longestWinSeen,
  }
}

// ---------------------------------------------------------------------
// TOOL 20 — Trade Query engine
// ---------------------------------------------------------------------

/**
 * Filters and sorts the real trade log on any combination of fields.
 * Backs the query console, the CSV export scope, and the comparison tool.
 */
export function queryTrades(trades, q = {}) {
  const {
    text = '',
    instruments = [],
    timeframes = [],
    directions = [],
    statuses = [],
    instrumentTypes = [],
    outcomes = [],
    minPnl = null,
    maxPnl = null,
    minScore = null,
    maxScore = null,
    dateFrom = null,
    dateTo = null,
    ruleIds = [],
    hasScreenshot = null,
    hasNotes = null,
    sortBy = 'date',
    sortDir = 'desc',
  } = q

  const needle = text.trim().toLowerCase()

  let rows = trades.filter((t) => {
    if (instruments.length && !instruments.includes(stockLabel(t))) return false
    if (timeframes.length && !timeframes.includes(t.timeframe || '—')) return false
    if (directions.length && !directions.includes(t.direction)) return false
    if (statuses.length && !statuses.includes(t.status || 'Pending')) return false
    if (instrumentTypes.length && !instrumentTypes.includes(t.instrumentType)) return false
    if (outcomes.length && !outcomes.includes(outcomeOf(t))) return false

    if (minPnl !== null && (!hasPnl(t) || pnlOf(t) < minPnl)) return false
    if (maxPnl !== null && (!hasPnl(t) || pnlOf(t) > maxPnl)) return false

    const s = t.validationScore
    const pctScore = s && s.total ? (s.checked / s.total) * 100 : null
    if (minScore !== null && (pctScore === null || pctScore < minScore)) return false
    if (maxScore !== null && (pctScore === null || pctScore > maxScore)) return false

    if (dateFrom && parseDate(t) < dateFrom) return false
    if (dateTo && parseDate(t) > dateTo) return false

    if (ruleIds.length && !ruleIds.every((id) => (t.validationRuleIds || []).includes(id))) return false

    if (hasScreenshot === true && !t.screenshotUrl) return false
    if (hasScreenshot === false && t.screenshotUrl) return false
    if (hasNotes === true && !(t.notes || '').trim()) return false
    if (hasNotes === false && (t.notes || '').trim()) return false

    if (needle) {
      const haystack = [t.name, t.pair, t.instrumentName, t.notes, t.timeframe, t.direction, t.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const dir = sortDir === 'asc' ? 1 : -1
  const getter = {
    date: (t) => parseDate(t).getTime(),
    pnl: (t) => (hasPnl(t) ? pnlOf(t) : -Infinity),
    score: (t) => {
      const s = t.validationScore
      return s && s.total ? s.checked / s.total : -1
    },
    name: (t) => stockLabel(t).toLowerCase(),
    timeframe: (t) => t.timeframe || '',
  }[sortBy] || ((t) => parseDate(t).getTime())

  rows = [...rows].sort((a, b) => {
    const va = getter(a)
    const vb = getter(b)
    if (typeof va === 'string') return va.localeCompare(vb) * dir
    return (va - vb) * dir
  })

  const withPnl = rows.filter(hasPnl)
  const wins = rows.filter((t) => outcomeOf(t) === 'win').length
  const losses = rows.filter((t) => outcomeOf(t) === 'loss').length

  return {
    rows,
    count: rows.length,
    totalCount: trades.length,
    netPnl: withPnl.reduce((a, t) => a + pnlOf(t), 0),
    withPnl: withPnl.length,
    wins,
    losses,
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
  }
}

// ---------------------------------------------------------------------
// TOOL 21 — CSV export / import
// ---------------------------------------------------------------------

const CSV_COLUMNS = [
  'date', 'instrumentName', 'pair', 'instrumentType', 'timeframe',
  'direction', 'price', 'pnl', 'status', 'validationChecked',
  'validationTotal', 'scorePct', 'notes', 'createdAt', 'id',
]

const csvEscape = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // A leading =, +, - or @ makes Excel treat the cell as a formula.
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function tradesToCsv(trades) {
  const header = CSV_COLUMNS.join(',')
  const lines = sortChrono(trades).map((t) => {
    const s = t.validationScore
    const row = {
      date: t.date || '',
      instrumentName: t.instrumentName || '',
      pair: t.pair || '',
      instrumentType: t.instrumentType || '',
      timeframe: t.timeframe || '',
      direction: t.direction || '',
      price: t.price ?? '',
      pnl: hasPnl(t) ? pnlOf(t) : '',
      status: t.status || 'Pending',
      validationChecked: s?.checked ?? '',
      validationTotal: s?.total ?? '',
      scorePct: s && s.total ? ((s.checked / s.total) * 100).toFixed(1) : '',
      notes: (t.notes || '').replace(/\r?\n/g, ' '),
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
      id: t.id,
    }
    return CSV_COLUMNS.map((c) => csvEscape(row[c])).join(',')
  })
  return [header, ...lines].join('\n')
}

/** Minimal RFC-4180 parser — handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Turns parsed CSV rows into trade objects, reporting exactly which rows
 * were rejected and why rather than silently dropping them.
 */
export function csvToTrades(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return fail('That file has no data rows — expected a header plus at least one trade.')

  const header = rows[0].map((h) => h.trim())
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

  const dateI = idx('date')
  if (dateI === -1) return fail('No "date" column found. Export a file from this app first to see the expected format.')

  const map = {
    instrumentName: idx('instrumentName'),
    pair: idx('pair'),
    instrumentType: idx('instrumentType'),
    timeframe: idx('timeframe'),
    direction: idx('direction'),
    price: idx('price'),
    pnl: idx('pnl'),
    status: idx('status'),
    checked: idx('validationChecked'),
    total: idx('validationTotal'),
    notes: idx('notes'),
  }

  const trades = []
  const errors = []

  rows.slice(1).forEach((r, i) => {
    const lineNo = i + 2
    const date = (r[dateI] || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${lineNo}: date "${date}" is not in YYYY-MM-DD format.`)
      return
    }
    const get = (k) => (map[k] >= 0 ? (r[map[k]] || '').trim() : '')
    const pnlRaw = get('pnl')
    const priceRaw = get('price')
    const checked = num(get('checked'))
    const total = num(get('total'))
    const type = get('instrumentType')

    trades.push({
      date,
      pair: get('pair') || get('instrumentName') || 'Imported',
      instrumentName: get('instrumentName') || get('pair') || 'Imported',
      instrumentType: ['Equity', 'Forex', 'Commodity'].includes(type) ? type : 'Equity',
      timeframe: get('timeframe') || '15m',
      direction: get('direction') === 'Sell' ? 'Sell' : 'Buy',
      price: priceRaw === '' ? null : num(priceRaw),
      pnl: pnlRaw === '' ? null : num(pnlRaw),
      status: ['Target Hit', 'SL Hit', 'Pending'].includes(get('status')) ? get('status') : 'Pending',
      notes: get('notes'),
      validationRuleIds: [],
      validationScore: checked !== null && total ? { checked, total } : null,
    })
  })

  if (!trades.length) return fail(`No valid rows found. ${errors[0] || ''}`)

  return { ok: true, error: null, trades, errors, imported: trades.length, skipped: errors.length }
}

// ---------------------------------------------------------------------
// TOOL 22 — Session clock
// ---------------------------------------------------------------------

/**
 * Which FX sessions are open right now, in the person's own local time.
 * Real clock, real boundaries — it re-reads Date.now() on every call.
 */
const SESSION_WINDOWS = [
  { id: 'sydney', label: 'Sydney', openUtc: 21, closeUtc: 6 },
  { id: 'tokyo', label: 'Tokyo', openUtc: 0, closeUtc: 9 },
  { id: 'london', label: 'London', openUtc: 7, closeUtc: 16 },
  { id: 'newyork', label: 'New York', openUtc: 12, closeUtc: 21 },
]

export function sessionClock(now = new Date()) {
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60
  const day = now.getUTCDay()
  const weekend = day === 6 || (day === 0 && utcHour < 21) || (day === 5 && utcHour >= 21)

  const sessions = SESSION_WINDOWS.map((s) => {
    const wraps = s.closeUtc < s.openUtc
    const open = wraps ? utcHour >= s.openUtc || utcHour < s.closeUtc : utcHour >= s.openUtc && utcHour < s.closeUtc
    const hoursToClose = open ? (s.closeUtc - utcHour + 24) % 24 : null
    const hoursToOpen = open ? null : (s.openUtc - utcHour + 24) % 24
    // Convert the UTC boundary to the viewer's own local clock.
    const localOpen = new Date(now)
    localOpen.setUTCHours(s.openUtc, 0, 0, 0)
    const localClose = new Date(now)
    localClose.setUTCHours(s.closeUtc, 0, 0, 0)
    return {
      ...s,
      open: open && !weekend,
      hoursToClose,
      hoursToOpen,
      localOpenLabel: localOpen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      localCloseLabel: localClose.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  })

  const openNow = sessions.filter((s) => s.open)
  return {
    ok: true,
    error: null,
    weekend,
    sessions,
    openCount: openNow.length,
    openLabels: openNow.map((s) => s.label),
    // London/NY overlap is the deepest liquidity window of the day.
    overlap: openNow.some((s) => s.id === 'london') && openNow.some((s) => s.id === 'newyork'),
    localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    utcTime: `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`,
  }
}

// ---------------------------------------------------------------------
// TOOL 23 — Journal-derived defaults
// ---------------------------------------------------------------------

/**
 * Pre-fills the calculators from the person's own realised statistics, so
 * "what happens if I keep trading like this" is one click rather than a
 * transcription exercise.
 */
export function deriveToolDefaults(trades) {
  const perf = getPerformance(trades)
  const kelly = getKelly(trades)
  const dd = getDrawdownStats(trades)
  const rows = sortChrono(trades)

  let tradesPerMonth = null
  if (rows.length >= 2) {
    const span = Math.max(1, (parseDate(rows[rows.length - 1]) - parseDate(rows[0])) / 86400000)
    tradesPerMonth = (rows.length / span) * 30
  }

  return {
    available: perf.tradesWithPnl >= 3,
    winRatePct: perf.winRate,
    avgWin: perf.avgWin,
    avgLoss: perf.avgLoss,
    payoffRatio: perf.payoffRatio,
    expectancy: perf.expectancy,
    tradesPerMonth,
    kellyPct: kelly.kellyPct,
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownPct: dd.maxDrawdownPct,
    sampleSize: perf.tradesWithPnl,
  }
}

// ---------------------------------------------------------------------
// TOOL 24 — Alert rule evaluation
// ---------------------------------------------------------------------

/** The metrics a custom alert rule can watch. All read from real stats. */
export const ALERT_METRICS = [
  { id: 'winRate', label: 'Win rate', unit: '%', scope: 'all' },
  { id: 'profitFactor', label: 'Profit factor', unit: '', scope: 'currency' },
  { id: 'expectancy', label: 'Expectancy per trade', unit: 'money', scope: 'currency' },
  { id: 'netPnl', label: 'Net P&L', unit: 'money', scope: 'currency' },
  { id: 'currentDrawdown', label: 'Current drawdown', unit: 'money', scope: 'currency' },
  { id: 'maxDrawdownPct', label: 'Max drawdown', unit: '%', scope: 'currency' },
  { id: 'lossStreak', label: 'Current loss streak', unit: 'trades', scope: 'all' },
  { id: 'openTrades', label: 'Open (pending) trades', unit: 'trades', scope: 'all' },
  { id: 'tradesThisWeek', label: 'Trades this week', unit: 'trades', scope: 'all' },
  { id: 'avgScore', label: 'Avg checklist score', unit: '%', scope: 'all' },
]

export function evaluateAlertRule(rule, { trades, groupTrades, symbol = '' }) {
  const scopedTrades = rule.scope === 'currency' ? groupTrades : trades
  let value = null

  switch (rule.metric) {
    case 'winRate': {
      const wins = scopedTrades.filter((t) => outcomeOf(t) === 'win').length
      const losses = scopedTrades.filter((t) => outcomeOf(t) === 'loss').length
      value = wins + losses ? (wins / (wins + losses)) * 100 : null
      break
    }
    case 'profitFactor':
      value = getPerformance(scopedTrades).profitFactor
      break
    case 'expectancy':
      value = getPerformance(scopedTrades).expectancy
      break
    case 'netPnl':
      value = getPerformance(scopedTrades).netPnl
      break
    case 'currentDrawdown':
      value = getDrawdownStats(scopedTrades).currentDrawdown
      break
    case 'maxDrawdownPct':
      value = getDrawdownStats(scopedTrades).maxDrawdownPct
      break
    case 'lossStreak': {
      const seq = sortChrono(scopedTrades).map(outcomeOf).filter((o) => o === 'win' || o === 'loss')
      let run = 0
      for (let i = seq.length - 1; i >= 0; i--) {
        if (seq[i] === 'loss') run += 1
        else break
      }
      value = run
      break
    }
    case 'openTrades':
      value = scopedTrades.filter((t) => !t.status || t.status === 'Pending').length
      break
    case 'tradesThisWeek': {
      const now = new Date()
      const start = new Date(now)
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      start.setHours(0, 0, 0, 0)
      value = scopedTrades.filter((t) => parseDate(t) >= start).length
      break
    }
    case 'avgScore': {
      const scores = scopedTrades
        .map((t) => (t.validationScore?.total ? (t.validationScore.checked / t.validationScore.total) * 100 : null))
        .filter((v) => v !== null)
      value = scores.length ? mean(scores) : null
      break
    }
    default:
      value = null
  }

  if (value === null) return { ...rule, value: null, triggered: false, reason: 'Not enough data yet' }

  const threshold = num(rule.threshold)
  if (threshold === null) return { ...rule, value, triggered: false, reason: 'No threshold set' }

  const triggered = rule.comparator === 'below' ? value < threshold : value > threshold
  const meta = ALERT_METRICS.find((m) => m.id === rule.metric)
  const fmt = (v) =>
    meta?.unit === 'money'
      ? `${v < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
      : meta?.unit === '%'
        ? `${v.toFixed(1)}%`
        : meta?.unit === 'trades'
          ? `${Math.round(v)}`
          : v.toFixed(2)

  return {
    ...rule,
    value,
    triggered,
    display: fmt(value),
    thresholdDisplay: fmt(threshold),
    label: meta?.label || rule.metric,
    reason: null,
  }
}

// ---------------------------------------------------------------------
// TOOL 25 — R:R grid
// ---------------------------------------------------------------------

/**
 * The break-even win rate for every common reward ratio, with the
 * person's own realised win rate marked against it. Turns "is my R:R good
 * enough?" into a table you can read in two seconds.
 */
export function rrGrid(actualWinRatePct = null) {
  const ratios = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5]
  return ratios.map((rr) => {
    const breakEven = (1 / (1 + rr)) * 100
    return {
      rr,
      label: `1:${rr}`,
      breakEvenWinRate: breakEven,
      yourEdge: actualWinRatePct == null ? null : actualWinRatePct - breakEven,
      profitable: actualWinRatePct == null ? null : actualWinRatePct > breakEven,
      expectancyR: actualWinRatePct == null ? null : (actualWinRatePct / 100) * rr - (1 - actualWinRatePct / 100),
    }
  })
}

// ---------------------------------------------------------------------
// TOOL 26 — Consecutive-loss capital table
// ---------------------------------------------------------------------

export function lossSequenceTable({ accountSize, riskPercent, maxLosses = 12 }) {
  const acct = num(accountSize)
  const riskPct = num(riskPercent)

  if (acct === null || acct <= 0) return fail('Enter an account size.')
  if (riskPct === null || riskPct <= 0 || riskPct > 100) return fail('Enter risk per trade as a percentage.')

  const rows = []
  let equity = acct
  for (let i = 1; i <= Math.min(30, maxLosses); i++) {
    // Fixed-fractional sizing: each loss is a percentage of what's left.
    const loss = equity * (riskPct / 100)
    equity -= loss
    rows.push({
      losses: i,
      loss,
      equity,
      drawdownPct: ((acct - equity) / acct) * 100,
      gainToRecoverPct: (acct / equity - 1) * 100,
    })
  }
  return { ok: true, error: null, rows, accountSize: acct, riskPercent: riskPct }
}

// ---------------------------------------------------------------------
// TOOL 27 — Trade replay timeline
// ---------------------------------------------------------------------

/** Chronological walk-through of the account, one trade at a time. */
export function buildReplay(trades) {
  const rows = sortChrono(trades).filter(hasPnl)
  if (!rows.length) return { available: false, frames: [] }

  let equity = 0
  let peak = 0
  let wins = 0
  let losses = 0

  const frames = rows.map((t, i) => {
    const v = pnlOf(t)
    equity += v
    if (equity > peak) peak = equity
    const o = outcomeOf(t)
    if (o === 'win') wins += 1
    if (o === 'loss') losses += 1
    return {
      index: i + 1,
      trade: t,
      pnl: v,
      equity,
      peak,
      drawdown: equity - peak,
      winRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
      wins,
      losses,
      date: parseDate(t),
      name: stockLabel(t),
      outcome: o,
    }
  })

  return { available: true, frames, total: frames.length }
}

// ---------------------------------------------------------------------
// TOOL 28 — Risk normaliser
// ---------------------------------------------------------------------

/**
 * Equal-weight replay: re-runs the journal as if every trade had been the
 * same size — each win contributes the average win, each loss the average
 * loss, in the real order they happened.
 *
 * The gap between that curve and the real one is entirely position
 * sizing. A real curve well above the equal-weight one means the bigger
 * bets landed on the better trades (skill, or luck); well below means
 * size was largest exactly when it shouldn't have been, which is the more
 * common and more expensive pattern.
 */
export function normaliseRisk(trades) {
  const rows = sortChrono(trades).filter(hasPnl)
  if (rows.length < 5) return { available: false, sampleSize: rows.length }

  const values = rows.map(pnlOf)
  const wins = values.filter((v) => v > 0)
  const losses = values.filter((v) => v < 0)
  if (!wins.length || !losses.length) {
    return { available: false, sampleSize: rows.length, reason: 'Needs at least one win and one loss' }
  }

  const avgWin = mean(wins)
  const avgLoss = Math.abs(mean(losses))

  let actual = 0
  let flat = 0
  const curve = rows.map((t, i) => {
    const v = pnlOf(t)
    actual += v
    flat += v > 0 ? avgWin : v < 0 ? -avgLoss : 0
    return { index: i + 1, actual, flat, date: parseDate(t), pnl: v, name: stockLabel(t) }
  })

  const difference = actual - flat

  return {
    available: true,
    sampleSize: rows.length,
    avgWin,
    avgLoss,
    curve,
    actualFinal: actual,
    flatFinal: flat,
    difference,
    sizingHelped: difference > 0,
    // Share of the real result that came from sizing rather than selection.
    sizingSharePct: actual !== 0 ? (difference / Math.abs(actual)) * 100 : null,
    verdict:
      Math.abs(difference) < Math.abs(flat) * 0.1
        ? 'Sizing is consistent — results come from trade selection.'
        : difference > 0
          ? 'Your bigger positions landed on better trades.'
          : 'Your bigger positions landed on worse trades — flat sizing would have done better.',
  }
}

export { num as parseNumber }

// ---------------------------------------------------------------------
// Statistical confidence in the edge
// ---------------------------------------------------------------------

/**
 * Wilson score interval for a win rate.
 *
 * The obvious approach — wins/total ± 1.96·sqrt(p(1-p)/n) — is the normal
 * approximation, and it is badly wrong at the sample sizes a trading
 * journal actually has. It can produce bounds below 0 or above 100, and
 * at 10 trades it is meaningless. Wilson stays inside [0,1] and behaves
 * at small n, which is exactly where a trader is asking the question.
 */
export function winRateConfidence({ wins, losses, confidence = 95 } = {}) {
  const w = num(wins)
  const l = num(losses)
  if (w == null || l == null || w < 0 || l < 0) return { ok: false, error: 'Enter the number of wins and losses.' }

  const n = w + l
  if (n < 1) return { ok: false, error: 'At least one resolved trade is needed.' }

  const z = confidence >= 99 ? 2.5758 : confidence >= 95 ? 1.96 : 1.6449
  const p = w / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const spread = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom

  const low = Math.max(0, centre - spread) * 100
  const high = Math.min(1, centre + spread) * 100
  const observed = p * 100

  // "Is the edge real?" reduces to whether the interval clears break-even.
  const beatsCoinFlip = low > 50
  const worseThanCoinFlip = high < 50

  return {
    ok: true,
    observed,
    low,
    high,
    width: high - low,
    sampleSize: n,
    wins: w,
    losses: l,
    confidence,
    beatsCoinFlip,
    worseThanCoinFlip,
    inconclusive: !beatsCoinFlip && !worseThanCoinFlip,
    note: beatsCoinFlip
      ? `Even the pessimistic end of the range (${low.toFixed(1)}%) is above 50%, so on this evidence the edge is real.`
      : worseThanCoinFlip
        ? `Even the optimistic end (${high.toFixed(1)}%) is below 50%. On this evidence the system is losing.`
        : `The range spans 50%, so ${n} trades cannot yet distinguish this from a coin flip. That is a statement about sample size, not about the strategy.`,
  }
}

/**
 * How many trades are needed before a win rate is known to within a given
 * margin. Uses the normal approximation for n, which is fine here because
 * the answer is always large enough for it to hold.
 */
export function sampleSizeNeeded({ winRatePct, marginPct = 10, confidence = 95 } = {}) {
  const p0 = num(winRatePct)
  const margin = num(marginPct)
  if (p0 == null || p0 <= 0 || p0 >= 100) return { ok: false, error: 'Enter a win rate between 0 and 100.' }
  if (margin == null || margin <= 0 || margin >= 50) return { ok: false, error: 'Margin must be between 0 and 50 points.' }

  const z = confidence >= 99 ? 2.5758 : confidence >= 95 ? 1.96 : 1.6449
  const p = p0 / 100
  const m = margin / 100
  const n = Math.ceil((z * z * p * (1 - p)) / (m * m))

  // Also: the n at which a win rate this far above 50% becomes provable.
  const edge = Math.abs(p - 0.5)
  const nToProve = edge > 0.001 ? Math.ceil((z * z * p * (1 - p)) / (edge * edge)) : null

  return {
    ok: true,
    tradesNeeded: n,
    tradesToProveEdge: nToProve,
    winRatePct: p0,
    marginPct: margin,
    confidence,
    note: nToProve
      ? `To show a ${p0.toFixed(0)}% win rate is genuinely better than a coin flip takes roughly ${nToProve.toLocaleString('en-IN')} trades. Most journals are nowhere near that, which is why conclusions from thirty trades should be held loosely.`
      : `A win rate this close to 50% cannot be distinguished from chance at any practical sample size.`,
  }
}

// ---------------------------------------------------------------------
// Grade a planned trade against the person's own history
// ---------------------------------------------------------------------

/**
 * Looks up how the trader has actually done on this instrument, this
 * timeframe and this direction, and grades a planned trade on that
 * evidence alone. Every component reports its own sample size, because a
 * grade built on two trades deserves to be ignored.
 */
export function tradeGrader(trades, { instrument, timeframe, direction } = {}) {
  const list = Array.isArray(trades) ? trades : []
  const resolved = list.filter((t) => outcomeOf(t) === 'win' || outcomeOf(t) === 'loss')

  if (resolved.length < 5) {
    return { ok: false, error: `Only ${resolved.length} resolved trades on record. Grading needs at least 5 to mean anything.` }
  }

  const baseWins = resolved.filter((t) => outcomeOf(t) === 'win').length
  const baseline = (baseWins / resolved.length) * 100

  const facet = (predicate, label) => {
    const subset = resolved.filter(predicate)
    if (!subset.length) return { label, count: 0, winRate: null, lift: null, reliable: false }
    const wins = subset.filter((t) => outcomeOf(t) === 'win').length
    const winRate = (wins / subset.length) * 100
    return {
      label,
      count: subset.length,
      winRate,
      lift: winRate - baseline,
      reliable: subset.length >= 5,
    }
  }

  const facets = [
    instrument ? facet((t) => stockLabel(t) === instrument, `On ${instrument}`) : null,
    timeframe ? facet((t) => t.timeframe === timeframe, `On the ${timeframe}`) : null,
    direction ? facet((t) => t.direction === direction, `Going ${direction.toLowerCase()}`) : null,
  ].filter(Boolean)

  const reliable = facets.filter((f) => f.reliable)
  if (!reliable.length) {
    return {
      ok: true,
      graded: false,
      baseline,
      facets,
      note: 'None of these choices has five or more trades behind it yet, so there is no evidence to grade against. That is not a red flag — it just means this is new territory.',
    }
  }

  // Weight each facet by its own sample size: a 40-trade instrument
  // record should count for more than a 6-trade one.
  const totalWeight = reliable.reduce((a, f) => a + Math.min(f.count, 40), 0)
  const weightedLift = reliable.reduce((a, f) => a + f.lift * Math.min(f.count, 40), 0) / totalWeight
  const expected = baseline + weightedLift

  const grade =
    weightedLift >= 10 ? 'A' : weightedLift >= 4 ? 'B' : weightedLift >= -4 ? 'C' : weightedLift >= -10 ? 'D' : 'F'

  return {
    ok: true,
    graded: true,
    grade,
    baseline,
    expectedWinRate: Math.max(0, Math.min(100, expected)),
    lift: weightedLift,
    facets,
    reliableCount: reliable.length,
    note:
      weightedLift >= 4
        ? `Your record on these choices runs ${weightedLift.toFixed(1)} points above your overall ${baseline.toFixed(0)}% win rate.`
        : weightedLift <= -4
          ? `Your record on these choices runs ${Math.abs(weightedLift).toFixed(1)} points below your overall ${baseline.toFixed(0)}% win rate. Worth a second look before taking it.`
          : `This combination performs in line with your overall ${baseline.toFixed(0)}% win rate — no signal either way.`,
  }
}

// ---------------------------------------------------------------------
// Trailing stop levels
// ---------------------------------------------------------------------

export function trailingStop({ entry, currentPrice, atr, multiplier = 3, direction = 'Long', trailPct } = {}) {
  const e = num(entry)
  const c = num(currentPrice)
  if (e == null || e <= 0) return { ok: false, error: 'Enter an entry price above zero.' }
  if (c == null || c <= 0) return { ok: false, error: 'Enter the current price.' }

  const long = direction !== 'Short'
  const a = num(atr)
  const mult = num(multiplier) ?? 3
  const pct = num(trailPct)

  const openProfit = long ? c - e : e - c
  const openProfitPct = (openProfit / e) * 100

  const levels = []
  if (a != null && a > 0) {
    const chandelier = long ? c - a * mult : c + a * mult
    levels.push({
      id: 'atr',
      label: `Chandelier (${mult}× ATR)`,
      price: chandelier,
      locked: long ? chandelier - e : e - chandelier,
      note: 'Trails the extreme by a multiple of average true range, so it widens in volatile conditions instead of getting knocked out.',
    })
  }
  if (pct != null && pct > 0) {
    const percentStop = long ? c * (1 - pct / 100) : c * (1 + pct / 100)
    levels.push({
      id: 'pct',
      label: `${pct}% trail`,
      price: percentStop,
      locked: long ? percentStop - e : e - percentStop,
      note: 'A fixed percentage from the current price. Simple, but it ignores how much the instrument actually moves.',
    })
  }
  levels.push({
    id: 'be',
    label: 'Break-even',
    price: e,
    locked: 0,
    note: 'Moving to break-even removes the loss but also raises the chance of being stopped out on noise.',
  })
  if (openProfit > 0) {
    const half = long ? e + openProfit / 2 : e - openProfit / 2
    levels.push({
      id: 'half',
      label: 'Lock half the gain',
      price: half,
      locked: openProfit / 2,
      note: 'A middle path: banks part of the move while leaving room for it to continue.',
    })
  }

  const best = levels
    .filter((l) => (long ? l.price < c : l.price > c))
    .sort((a2, b2) => (long ? b2.price - a2.price : a2.price - b2.price))[0]

  return {
    ok: true,
    direction: long ? 'Long' : 'Short',
    entry: e,
    currentPrice: c,
    openProfit,
    openProfitPct,
    inProfit: openProfit > 0,
    levels: levels.sort((a2, b2) => (long ? b2.price - a2.price : a2.price - b2.price)),
    tightest: best || null,
    note: openProfit <= 0
      ? 'The position is not in profit, so a trailing stop would sit below the entry and lock in a loss. The original stop still applies.'
      : `The position is ${openProfitPct.toFixed(2)}% onside. Any level above the entry converts part of that into a floor.`,
  }
}

// ---------------------------------------------------------------------
// What costs actually took out of the real journal
// ---------------------------------------------------------------------

/**
 * Applies a per-trade cost and turnover tax to every logged trade and
 * reports the drag. This is the one cost figure that matters, because it
 * is measured against the trades actually taken rather than a
 * hypothetical.
 */
export function costImpact(trades, { costPerTrade, taxPct = 0 } = {}) {
  const list = Array.isArray(trades) ? trades : []
  const withPnl = list.filter(hasPnl)
  const cost = num(costPerTrade)
  const tax = num(taxPct) ?? 0

  if (cost == null || cost < 0) return { ok: false, error: 'Enter the round-trip cost of one trade.' }
  if (!withPnl.length) return { ok: false, error: 'No trades with a logged P&L in range.' }

  const grossNet = withPnl.reduce((a, t) => a + pnlOf(t), 0)

  // Turnover tax needs a position value; price × 1 unit is the only
  // notional the form records, so it is used and labelled as such.
  const taxTotal = tax > 0
    ? withPnl.reduce((a, t) => {
        const price = num(t.price)
        return a + (price ? (price * tax) / 100 : 0)
      }, 0)
    : 0

  const costTotal = cost * withPnl.length
  const totalDrag = costTotal + taxTotal
  const netAfter = grossNet - totalDrag

  const wins = withPnl.filter((t) => pnlOf(t) > 0)
  const perTradeDrag = totalDrag / withPnl.length

  // How many winners were only winners before costs?
  const flipped = withPnl.filter((t) => pnlOf(t) > 0 && pnlOf(t) - perTradeDrag <= 0).length

  return {
    ok: true,
    sampleSize: withPnl.length,
    grossNet,
    costTotal,
    taxTotal,
    totalDrag,
    netAfter,
    perTradeDrag,
    dragPctOfGross: grossNet !== 0 ? (totalDrag / Math.abs(grossNet)) * 100 : null,
    flippedWinners: flipped,
    winCount: wins.length,
    turnsProfitIntoLoss: grossNet > 0 && netAfter <= 0,
    note: grossNet > 0 && netAfter <= 0
      ? `Costs turn a ${Math.round(grossNet).toLocaleString('en-IN')} gross profit into a loss. The strategy works; the cost structure does not.`
      : flipped > 0
        ? `${flipped} of ${wins.length} winners are small enough that costs alone would wipe them out. Trades that thin are not worth taking.`
        : `Costs take ${Math.round(perTradeDrag).toLocaleString('en-IN')} per trade, leaving ${Math.round(netAfter).toLocaleString('en-IN')} of the ${Math.round(grossNet).toLocaleString('en-IN')} gross.`,
  }
}
