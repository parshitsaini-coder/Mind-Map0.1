/* Render smoke test.
 *
 * A successful `vite build` only proves the modules parse and link. It
 * says nothing about whether a widget throws when it meets a trade with a
 * null pnl, an empty instrument list, or a single row where quartiles are
 * undefined. This entry renders every section and every tool against
 * several deliberately awkward datasets and reports anything that throws.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useTradeAnalysisStore } from '../src/store/tradeAnalysisStore'

import OverviewSection from '../src/components/trade-analysis/analysis/pro/sections/OverviewSection'
import PerformanceSection from '../src/components/trade-analysis/analysis/pro/sections/PerformanceSection'
import RiskSection from '../src/components/trade-analysis/analysis/pro/sections/RiskSection'
import BehaviorSection from '../src/components/trade-analysis/analysis/pro/sections/BehaviorSection'
import TimeSection from '../src/components/trade-analysis/analysis/pro/sections/TimeSection'
import EdgeSection from '../src/components/trade-analysis/analysis/pro/sections/EdgeSection'
import InsightsSection from '../src/components/trade-analysis/analysis/pro/sections/InsightsSection'
import ToolsSection from '../src/components/trade-analysis/analysis/pro/sections/ToolsSection'

import * as Calc from '../src/components/trade-analysis/analysis/pro/tools/CalculatorTools'
import * as RiskT from '../src/components/trade-analysis/analysis/pro/tools/RiskTools'
import * as DataT from '../src/components/trade-analysis/analysis/pro/tools/DataTools'
import * as PlanT from '../src/components/trade-analysis/analysis/pro/tools/PlanningTools'
import * as EdgeT from '../src/components/trade-analysis/analysis/pro/tools/EdgeTools'

const PAIRS = [
  ['XAUUSD', 'Commodity', 'Gold Spot'],
  ['EURUSD', 'Forex', 'Euro / US Dollar'],
  ['RELIANCE', 'Equity', 'Reliance Industries'],
  ['TCS', 'Equity', 'Tata Consultancy'],
]
const TFS = ['5m', '15m', '1H', '4H', '1D']

function makeTrades(n, opts = {}) {
  const out = []
  const start = new Date('2025-01-06T09:30:00Z')
  for (let i = 0; i < n; i++) {
    const [pair, type, name] = PAIRS[i % PAIRS.length]
    const d = new Date(start.getTime() + i * 36e5 * 7)
    // Deterministic but uneven outcomes, with holes on purpose.
    const win = (i * 7) % 10 < 6
    const pending = opts.allPending || (!opts.noPending && i % 11 === 0)
    const noPnl = opts.noPnl || i % 13 === 0
    out.push({
      id: `t${i}`,
      name: `${name} ${i}`,
      date: d.toISOString().slice(0, 10),
      pair,
      instrumentName: opts.singleInstrument ? 'XAUUSD' : name,
      instrumentType: opts.singleType ? 'Commodity' : type,
      timeframe: opts.singleTf ? '1H' : TFS[i % TFS.length],
      direction: i % 3 === 0 ? 'Sell' : 'Buy',
      price: 1000 + ((i * 37) % 900),
      pnl: pending || noPnl ? null : win ? 400 + ((i * 53) % 900) : -(200 + ((i * 29) % 500)),
      notes: i % 4 === 0 ? 'breakout retest above the range, waited for confirmation' : '',
      validationRuleIds: opts.noScores ? [] : ['r1', 'r2'].slice(0, (i % 3) + 1),
      validationScore: opts.noScores ? null : { checked: (i % 4) + 1, total: 5 },
      screenshotUrl: i % 6 === 0 ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : '',
      resultImageUrl: '',
      status: pending ? 'Pending' : win ? 'Target Hit' : 'SL Hit',
      createdAt: d.toISOString(),
      updatedAt: new Date(d.getTime() + 864e5 * ((i % 5) + 1)).toISOString(),
    })
  }
  return out
}

const RULES = [
  { id: 'r1', label: 'Trend aligned on higher timeframe', categoryId: 'c1', active: true },
  { id: 'r2', label: 'Entry at a tested level', categoryId: 'c1', active: true },
  { id: 'r3', label: 'Risk under 1% of account', categoryId: 'c2', active: true },
  { id: 'r4', label: 'No news within 30 minutes', categoryId: 'c2', active: true },
]
const CATS = [
  { id: 'c1', name: 'Setup' },
  { id: 'c2', name: 'Risk' },
]

const SECTIONS = {
  OverviewSection, PerformanceSection, RiskSection, BehaviorSection,
  TimeSection, EdgeSection, InsightsSection, ToolsSection,
}

const TOOLS = { ...Calc, ...RiskT, ...DataT, ...PlanT, ...EdgeT }

const SCENARIOS = [
  { name: 'empty log', trades: [] },
  { name: 'one trade', trades: makeTrades(1) },
  { name: 'two trades', trades: makeTrades(2) },
  { name: 'three trades', trades: makeTrades(3) },
  { name: 'all pending, no P&L', trades: makeTrades(12, { allPending: true }) },
  { name: 'no P&L values at all', trades: makeTrades(20, { noPnl: true }) },
  { name: 'no validation scores', trades: makeTrades(25, { noScores: true }) },
  { name: 'single instrument only', trades: makeTrades(30, { singleInstrument: true, singleType: true, singleTf: true }) },
  { name: 'equity only (INR)', trades: makeTrades(24).filter((t) => t.instrumentType === 'Equity') },
  { name: 'forex only (USD)', trades: makeTrades(24).filter((t) => t.instrumentType !== 'Equity') },
  { name: 'realistic mixed 60', trades: makeTrades(60) },
  { name: 'large 400', trades: makeTrades(400) },
]

const SCOPES = [
  { preset: 'all', from: null, to: null },
  { preset: '30d', from: null, to: null },
  { preset: 'custom', from: '2025-01-01', to: '2025-02-01' },
  { preset: 'custom', from: null, to: null },
]
const DENSITIES = ['cozy', 'compact', 'dense']

let checks = 0
let failures = 0
const fail = (where, err) => {
  failures++
  console.error(`  ✗ ${where}\n      ${err && err.message ? err.message : err}`)
  if (err && err.stack) {
    const line = err.stack.split('\n').find((l) => l.includes('src/'))
    if (line) console.error(`      ${line.trim()}`)
  }
}

const render = (label, el) => {
  checks++
  try {
    const html = renderToStaticMarkup(el)
    if (typeof html !== 'string') throw new Error('render returned a non-string')
    return html
  } catch (err) {
    fail(label, err)
    return null
  }
}

console.log('\n══ Render smoke test ══')

for (const scenario of SCENARIOS) {
  useTradeAnalysisStore.setState({
    trades: scenario.trades,
    validationRules: RULES,
    validationCategories: CATS,
    analysisScope: { preset: 'all', from: null, to: null },
    density: 'compact',
    alertRules: [
      { id: 'a1', metric: 'winRate', comparator: 'below', threshold: 45, enabled: true, scope: 'all' },
      { id: 'a2', metric: 'currentLossStreak', comparator: 'above', threshold: 2, enabled: true, scope: 'all' },
      { id: 'a3', metric: 'netPnl', comparator: 'below', threshold: 0, enabled: false, scope: 'currency' },
    ],
    goals: [
      { id: 'g1', label: 'Q1 target', target: 50000, currency: 'INR' },
      { id: 'g2', label: 'Swing target', target: 4000, currency: 'USD' },
    ],
    toolInputs: { accountSize: 500000, riskPercent: 1, leverage: 10, usdInrRate: 88.5, costPerTrade: 20, taxPct: 0.1 },
  })

  let sectionFails = 0
  const before = failures
  for (const [name, Component] of Object.entries(SECTIONS)) {
    render(`${scenario.name} → ${name}`, React.createElement(Component, { onNavigate: () => {} }))
  }
  sectionFails = failures - before
  console.log(
    `  ${sectionFails ? '✗' : '✓'} ${scenario.name.padEnd(24)} ${String(scenario.trades.length).padStart(4)} trades · 8 sections`
  )
}

// Every tool on its own, against the richest dataset, so a failure points
// at one component rather than a whole section.
console.log('\n── Individual tools ──')
useTradeAnalysisStore.setState({ trades: makeTrades(60), validationRules: RULES, validationCategories: CATS })
const groups = [
  { id: 'INR', label: 'Equity', symbol: '₹', trades: makeTrades(20).filter((t) => t.instrumentType === 'Equity') },
]
const toolNames = Object.keys(TOOLS).filter((k) => k.endsWith('Tool'))
let toolFails = 0
for (const name of toolNames) {
  const before = failures
  render(
    `tool ${name}`,
    React.createElement(TOOLS[name], {
      delay: 0,
      symbol: '₹',
      group: groups[0],
      actualWinRate: 58,
      defaults: { available: true, sampleSize: 20, winRatePct: 58, avgWin: 600, avgLoss: 300, payoffRatio: 2, tradesPerMonth: 12, maxDrawdownPct: 18 },
    })
  )
  if (failures > before) toolFails++
}
console.log(`  ${toolFails ? '✗' : '✓'} ${toolNames.length} tools rendered individually`)

// Density and scope permutations on the heaviest section.
console.log('\n── Density × scope permutations ──')
const before = failures
for (const density of DENSITIES) {
  for (const scope of SCOPES) {
    useTradeAnalysisStore.setState({ trades: makeTrades(60), density, analysisScope: scope, validationRules: RULES, validationCategories: CATS })
    render(`${density}/${scope.preset} → Overview`, React.createElement(OverviewSection, { onNavigate: () => {} }))
    render(`${density}/${scope.preset} → Performance`, React.createElement(PerformanceSection, {}))
  }
}
console.log(`  ${failures > before ? '✗' : '✓'} ${DENSITIES.length} densities × ${SCOPES.length} scopes × 2 sections`)

console.log(`\n══ ${checks} renders, ${failures} failure(s) ══\n`)
process.exit(failures ? 1 : 0)
