import { useMemo, useState } from 'react'
import { Dices, Flame, LineChart, Percent, PiggyBank, Repeat, ShieldAlert, TrendingDown, Wand2 } from 'lucide-react'
import {
  compoundingProjector, drawdownRecovery, expectancyCalc, kellyCalc, lossSequenceTable, monteCarloSim, riskOfRuinCalc, rrGrid, streakSimulator,
} from '../../../../../utils/tradeTools'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import { BarRow, Card, CardHead, Field, MiniButton, TableScroll, ToolError, ToolResult, Verdict } from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { FanChart, Sparkline } from '../charts'

// Tools → Risk planning. Everything that answers "what size, and what can
// go wrong at that size". Each card can pull its starting numbers straight
// from the journal via the "Use my stats" button, so the defaults are the
// person's own realised figures rather than invented ones.

function UseMyStats({ defaults, onApply, label = 'Use my stats' }) {
  if (!defaults.available) return null
  return (
    <MiniButton icon={Wand2} onClick={onApply} title={`Fill from your own ${defaults.sampleSize} logged trades`}>
      {label}
    </MiniButton>
  )
}

// ── TOOL 11 ──────────────────────────────────────────────────────────
export function KellyTool({ delay, defaults }) {
  const [wr, setWr] = useState('')
  const [avgWin, setAvgWin] = useState('')
  const [avgLoss, setAvgLoss] = useState('')

  const r = useMemo(() => kellyCalc({ winRatePct: wr, avgWin, avgLoss }), [wr, avgWin, avgLoss])

  const apply = () => {
    if (defaults.winRatePct != null) setWr(defaults.winRatePct.toFixed(1))
    if (defaults.avgWin != null) setAvgWin(defaults.avgWin.toFixed(0))
    if (defaults.avgLoss != null) setAvgLoss(defaults.avgLoss.toFixed(0))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={Percent}
        title="Kelly position size"
        hint="The stake that maximises long-run growth for a given edge"
        right={<UseMyStats defaults={defaults} onApply={apply} />}
      />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" />
        <Field label="Avg win" value={avgWin} onChange={setAvgWin} placeholder="500" />
        <Field label="Avg loss" value={avgLoss} onChange={setAvgLoss} placeholder="250" hint="Enter as a positive number" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Full Kelly', raw: r.kellyPct, format: (v) => `${v.toFixed(2)}%`, big: true, color: r.hasEdge ? 'var(--ta-accent)' : NEG },
                { label: 'Half Kelly', raw: r.halfKellyPct, format: (v) => `${v.toFixed(2)}%`, color: POS, hint: 'The practical working ceiling' },
                { label: 'Quarter Kelly', raw: r.quarterKellyPct, format: (v) => `${v.toFixed(2)}%` },
                { label: 'Break-even win rate', raw: r.breakEvenWinRate, format: (v) => `${v.toFixed(1)}%` },
              ]}
            />
            <Verdict tone={r.hasEdge ? 'good' : 'bad'}>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 12 ──────────────────────────────────────────────────────────
export function ExpectancyTool({ delay, defaults, symbol }) {
  const [wr, setWr] = useState('')
  const [avgWin, setAvgWin] = useState('')
  const [avgLoss, setAvgLoss] = useState('')
  const [freq, setFreq] = useState('')

  const r = useMemo(
    () => expectancyCalc({ winRatePct: wr, avgWin, avgLoss, tradesPerMonth: freq }),
    [wr, avgWin, avgLoss, freq]
  )

  const apply = () => {
    if (defaults.winRatePct != null) setWr(defaults.winRatePct.toFixed(1))
    if (defaults.avgWin != null) setAvgWin(defaults.avgWin.toFixed(0))
    if (defaults.avgLoss != null) setAvgLoss(defaults.avgLoss.toFixed(0))
    if (defaults.tradesPerMonth != null) setFreq(defaults.tradesPerMonth.toFixed(0))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={LineChart}
        title="Expectancy projector"
        hint="Average result per trade, projected out over your trading frequency"
        right={<UseMyStats defaults={defaults} onApply={apply} />}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" />
        <Field label="Avg win" value={avgWin} onChange={setAvgWin} />
        <Field label="Avg loss" value={avgLoss} onChange={setAvgLoss} />
        <Field label="Trades / month" value={freq} onChange={setFreq} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Per trade', raw: r.expectancy, format: (v) => fmtMoney(v, symbol, { signed: true }), big: true, color: signColor(r.expectancy) },
                { label: 'In R', raw: r.expectancyR, format: (v) => `${v.toFixed(2)}R`, color: signColor(r.expectancyR) },
                { label: 'Per month', raw: r.perMonth, format: (v) => fmtMoney(v, symbol, { signed: true, compact: true }), color: signColor(r.perMonth) },
                { label: 'Per year', raw: r.perYear, format: (v) => fmtMoney(v, symbol, { signed: true, compact: true }), color: signColor(r.perYear) },
              ]}
            />
            <Verdict tone={r.profitable ? 'good' : 'bad'}>
              Break-even needs a {fmtPct(r.breakEvenWinRate, 1)} win rate at this payoff ratio
              ({fmtNum(r.payoffRatio, 2)}).{' '}
              {r.profitable ? 'You are above it.' : 'You are below it, so the system loses money over a long series.'}
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 13 ──────────────────────────────────────────────────────────
export function RiskOfRuinTool({ delay, defaults }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [wr, setWr] = useState('')
  const [payoff, setPayoff] = useState('')
  const [threshold, setThreshold] = useState('100')

  const r = useMemo(
    () => riskOfRuinCalc({ winRatePct: wr, payoffRatio: payoff, riskPercent: toolInputs.riskPercent, ruinThresholdPct: threshold }),
    [wr, payoff, toolInputs.riskPercent, threshold]
  )

  const apply = () => {
    if (defaults.winRatePct != null) setWr(defaults.winRatePct.toFixed(1))
    if (defaults.payoffRatio != null) setPayoff(defaults.payoffRatio.toFixed(2))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={ShieldAlert}
        title="Risk of ruin"
        hint="The odds of losing the defined share of capital before the edge plays out"
        right={<UseMyStats defaults={defaults} onApply={apply} />}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" />
        <Field label="Payoff ratio" value={payoff} onChange={setPayoff} step="0.1" hint="Average win ÷ average loss" />
        <Field label="Risk / trade" value={toolInputs.riskPercent} onChange={(v) => setToolInput('riskPercent', v)} suffix="%" step="0.1" />
        <Field label="Ruin at" value={threshold} onChange={setThreshold} suffix="% loss" hint="How much of the account counts as ruin" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-3"
              items={[
                {
                  label: 'Risk of ruin',
                  value: r.riskOfRuinPct < 0.01 && r.riskOfRuinPct > 0 ? '<0.01%' : `${r.riskOfRuinPct.toFixed(2)}%`,
                  big: true,
                  color: r.riskOfRuinPct > 10 ? NEG : r.riskOfRuinPct > 1 ? '#d97706' : POS,
                },
                { label: 'Edge per trade', raw: r.edge, format: (v) => `${v.toFixed(3)}R`, color: signColor(r.edge) },
                { label: 'Capital', value: `${r.capitalUnits} risk units` },
              ]}
            />
            <Verdict tone={r.riskOfRuinPct > 10 ? 'bad' : r.riskOfRuinPct > 1 ? 'warn' : 'good'}>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 14 ──────────────────────────────────────────────────────────
export function DrawdownRecoveryTool({ delay, defaults }) {
  const [dd, setDd] = useState('')
  const [ret, setRet] = useState('')

  const r = useMemo(() => drawdownRecovery({ drawdownPct: dd, avgReturnPerTrade: ret }), [dd, ret])

  const apply = () => {
    if (defaults.maxDrawdownPct != null) setDd(defaults.maxDrawdownPct.toFixed(1))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={TrendingDown}
        title="Drawdown recovery"
        hint="The asymmetry that catches everyone out: a 50% loss needs a 100% gain to get back"
        right={defaults.maxDrawdownPct != null ? <MiniButton icon={Wand2} onClick={apply}>My worst DD</MiniButton> : undefined}
      />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Drawdown" value={dd} onChange={setDd} suffix="%" placeholder="25" />
        <Field label="Avg return / trade" value={ret} onChange={setRet} suffix="%" step="0.1" hint="Optional — used to estimate how many trades recovery takes" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-3"
              items={[
                { label: 'Gain needed', raw: r.gainNeededPct, format: (v) => `${v.toFixed(1)}%`, big: true, color: NEG },
                { label: 'Capital left', raw: r.remainingCapitalPct, format: (v) => `${v.toFixed(1)}%` },
                { label: 'Trades to recover', value: r.tradesToRecover == null ? '—' : `${r.tradesToRecover}` },
              ]}
            />
            <div className="mt-1.5">
              <TableScroll maxHeight={150}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Drawdown</th>
                      <th className="text-right">Gain to recover</th>
                      <th>Shape</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.curve.map((row) => (
                      <tr key={row.drawdownPct} style={Math.abs(row.drawdownPct - r.drawdownPct) < 3 ? { backgroundColor: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}>
                        <td className="font-semibold">{row.drawdownPct}%</td>
                        <td className="text-right font-semibold" style={{ color: row.gainNeededPct > 50 ? NEG : undefined }}>
                          {row.gainNeededPct.toFixed(1)}%
                        </td>
                        <td style={{ width: 90 }}>
                          <BarRow pct={Math.min(100, row.gainNeededPct / 9)} color={row.gainNeededPct > 50 ? NEG : 'var(--ta-accent)'} labelWidth={0} valueWidth={0} value={null} label={null} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 15 ──────────────────────────────────────────────────────────
export function CompoundingTool({ delay, symbol }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [ret, setRet] = useState('3')
  const [periods, setPeriods] = useState('24')
  const [contrib, setContrib] = useState('')

  const r = useMemo(
    () => compoundingProjector({ startingCapital: toolInputs.accountSize, returnPerPeriodPct: ret, periods, contributionPerPeriod: contrib }),
    [toolInputs.accountSize, ret, periods, contrib]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={PiggyBank} title="Compounding projector" hint="Straight compound arithmetic — it assumes the return repeats, which no market guarantees" />
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Starting capital" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
        <Field label="Return / period" value={ret} onChange={setRet} suffix="%" step="0.1" />
        <Field label="Periods" value={periods} onChange={setPeriods} />
        <Field label="Added / period" value={contrib} onChange={setContrib} placeholder="0" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <Sparkline values={r.rows.map((row) => row.equity)} height={40} color="var(--ta-accent)" />
            <div className="mt-1">
              <ToolResult
                columns="grid-cols-2 sm:grid-cols-4"
                items={[
                  { label: 'Final', raw: r.final, format: (v) => fmtMoney(v, symbol, { compact: true }), big: true, color: 'var(--ta-accent)' },
                  { label: 'Profit', raw: r.profit, format: (v) => fmtMoney(v, symbol, { signed: true, compact: true }), color: signColor(r.profit) },
                  { label: 'Multiple', raw: r.multiple, format: (v) => `${v.toFixed(2)}×` },
                  { label: 'Doubles every', value: r.doublingPeriods == null ? '—' : `${fmtNum(r.doublingPeriods, 1)} periods` },
                ]}
              />
            </div>
            <Verdict tone="warn">
              This is arithmetic, not a forecast. Real returns vary, and the same average with more variance ends up
              lower — see the Monte Carlo tool for what the spread actually looks like.
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 16 ──────────────────────────────────────────────────────────
export function MonteCarloTool({ delay, defaults, symbol }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [wr, setWr] = useState('')
  const [avgWin, setAvgWin] = useState('')
  const [avgLoss, setAvgLoss] = useState('')
  const [count, setCount] = useState('100')
  const [compound, setCompound] = useState(false)

  const r = useMemo(
    () =>
      monteCarloSim({
        startingCapital: toolInputs.accountSize,
        winRatePct: wr,
        avgWin,
        avgLoss,
        tradeCount: count,
        runs: 1200,
        riskPercent: compound ? toolInputs.riskPercent : null,
      }),
    [toolInputs.accountSize, toolInputs.riskPercent, wr, avgWin, avgLoss, count, compound]
  )

  const apply = () => {
    if (defaults.winRatePct != null) setWr(defaults.winRatePct.toFixed(1))
    if (defaults.avgWin != null) setAvgWin(defaults.avgWin.toFixed(0))
    if (defaults.avgLoss != null) setAvgLoss(defaults.avgLoss.toFixed(0))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={Dices}
        title="Forward simulation"
        hint="Runs 1,200 random sequences at the win rate and sizes you give"
        right={
          <div className="flex items-center gap-1">
            <MiniButton active={compound} onClick={() => setCompound((c) => !c)} title="Size each trade as a percentage of current equity instead of a flat amount">
              {compound ? 'Compounding' : 'Flat size'}
            </MiniButton>
            <UseMyStats defaults={defaults} onApply={apply} />
          </div>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Capital" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" />
        <Field label="Avg win" value={avgWin} onChange={setAvgWin} />
        <Field label="Avg loss" value={avgLoss} onChange={setAvgLoss} />
        <Field label="Trades" value={count} onChange={setCount} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <FanChart paths={r.paths} median={r.median} symbol={symbol} startValue={r.startingCapital} />
            <div className="mt-1">
              <ToolResult
                columns="grid-cols-2 sm:grid-cols-4"
                items={[
                  { label: 'P(profit)', raw: r.probProfitablePct, format: (v) => `${v.toFixed(0)}%`, big: true, color: r.probProfitablePct > 70 ? POS : NEG },
                  { label: 'Median end', raw: r.median, format: (v) => fmtMoney(v, symbol, { compact: true }) },
                  { label: 'Bad case (P5)', raw: r.p5, format: (v) => fmtMoney(v, symbol, { compact: true }), color: NEG },
                  { label: 'Good case (P95)', raw: r.p95, format: (v) => fmtMoney(v, symbol, { compact: true }), color: POS },
                  { label: 'Typical worst DD', raw: r.medianMaxDrawdown, format: (v) => fmtMoney(-v, symbol, { compact: true }), color: NEG },
                  { label: '95th pct DD', raw: r.p95MaxDrawdown, format: (v) => fmtMoney(-v, symbol, { compact: true }), color: NEG },
                  { label: 'Ruin odds', raw: r.probRuinPct, format: (v) => `${v.toFixed(1)}%`, color: r.probRuinPct > 1 ? NEG : POS },
                  { label: 'Median return', raw: r.medianReturnPct, format: (v) => `${v.toFixed(1)}%`, color: signColor(r.medianReturnPct) },
                ]}
              />
            </div>
            <Verdict tone={r.probRuinPct > 1 ? 'bad' : 'info'}>
              Prepare for the 95th-percentile drawdown of {fmtMoney(r.p95MaxDrawdown, symbol, { compact: true })}, not
              the median — the one you must survive is the bad one.
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 17 ──────────────────────────────────────────────────────────
export function StreakSimulatorTool({ delay, defaults }) {
  const [wr, setWr] = useState('')
  const [count, setCount] = useState('100')
  const [len, setLen] = useState('5')

  const r = useMemo(
    () => streakSimulator({ winRatePct: wr, tradeCount: count, streakLength: len }),
    [wr, count, len]
  )

  const apply = () => {
    if (defaults.winRatePct != null) setWr(defaults.winRatePct.toFixed(1))
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={Flame}
        title="Streak odds"
        hint="How likely a losing run of a given length is — most traders badly underestimate this and read a normal streak as a broken system"
        right={<UseMyStats defaults={defaults} onApply={apply} />}
      />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" />
        <Field label="Over N trades" value={count} onChange={setCount} />
        <Field label="Streak length" value={len} onChange={setLen} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: `${r.streakLength} losses in a row`, raw: r.probLossStreakPct, format: (v) => `${v.toFixed(1)}%`, big: true, color: NEG },
                { label: `${r.streakLength} wins in a row`, raw: r.probWinStreakPct, format: (v) => `${v.toFixed(1)}%`, color: POS },
                { label: 'Typical worst run', raw: r.typicalLongestLoss, format: (v) => fmtNum(v, 0), hint: 'The median longest losing streak across all simulations' },
                { label: '95th pct worst run', raw: r.p95LongestLoss, format: (v) => fmtNum(v, 0), color: NEG },
              ]}
            />
            <Verdict tone="info">
              Across {r.runs.toLocaleString('en-IN')} simulated series of {r.steps} trades, a losing run of{' '}
              {r.typicalLongestLoss} is completely normal at this win rate. Plan for the 95th-percentile run of{' '}
              {r.p95LongestLoss}, not the typical one.
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 18 ──────────────────────────────────────────────────────────
export function LossSequenceTool({ delay, symbol }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)

  const r = useMemo(
    () => lossSequenceTable({ accountSize: toolInputs.accountSize, riskPercent: toolInputs.riskPercent, maxLosses: 12 }),
    [toolInputs.accountSize, toolInputs.riskPercent]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Repeat} title="Consecutive losses" hint="What a losing run actually does to the balance at your current risk setting" />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Account" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
        <Field label="Risk / trade" value={toolInputs.riskPercent} onChange={(v) => setToolInput('riskPercent', v)} suffix="%" step="0.1" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <TableScroll maxHeight={210}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Losses</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Down</th>
                  <th className="text-right">To recover</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.losses}>
                    <td className="font-semibold">{row.losses}</td>
                    <td className="text-right">{fmtMoney(row.equity, symbol, { compact: true })}</td>
                    <td className="text-right" style={{ color: NEG }}>{row.drawdownPct.toFixed(1)}%</td>
                    <td className="text-right" style={{ color: row.gainToRecoverPct > 30 ? NEG : undefined }}>
                      +{row.gainToRecoverPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 19 ──────────────────────────────────────────────────────────
export function RrGridTool({ delay, actualWinRate }) {
  const grid = useMemo(() => rrGrid(actualWinRate), [actualWinRate])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Dices}
        title="Reward ratio table"
        sub={actualWinRate != null ? `your win rate ${actualWinRate.toFixed(0)}%` : 'enter trades to compare'}
        hint="The win rate each reward ratio needs to break even, with your own rate measured against it"
      />
      <TableScroll maxHeight={230}>
        <table className="ta-table">
          <thead>
            <tr>
              <th>Ratio</th>
              <th className="text-right">Break-even</th>
              <th className="text-right">Your edge</th>
              <th className="text-right">Per trade</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((g) => (
              <tr key={g.rr} style={g.profitable ? { backgroundColor: 'rgba(22,163,74,0.08)' } : undefined}>
                <td className="font-semibold">{g.label}</td>
                <td className="text-right">{g.breakEvenWinRate.toFixed(1)}%</td>
                <td className="text-right font-semibold" style={{ color: g.yourEdge == null ? 'var(--ta-slate)' : g.yourEdge > 0 ? POS : NEG }}>
                  {g.yourEdge == null ? '—' : `${g.yourEdge > 0 ? '+' : ''}${g.yourEdge.toFixed(1)}pt`}
                </td>
                <td className="text-right" style={{ color: signColor(g.expectancyR) }}>
                  {g.expectancyR == null ? '—' : `${g.expectancyR.toFixed(2)}R`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {actualWinRate != null && (
        <Verdict tone="info">
          Green rows are the reward ratios your current {actualWinRate.toFixed(0)}% win rate already clears.
        </Verdict>
      )}
    </Card>
  )
}
