import { useMemo, useState } from 'react'
import {
  BarChart3, Boxes, CalendarRange, Coins, Crosshair, Layers, Medal, Repeat, Sigma, Split, TrendingUp, Trophy,
} from 'lucide-react'
import {
  getCdf, getConsistency, getEdgeDecay, getExpectancyR, getPerformance, getPeriodExtremes, getPnlDistribution, getRDistribution, getRollingMetrics, getStreakStats, getWhatIf, rUnitFor,
} from '../../../../../utils/tradeAnalyticsPro'
import { getMonthlyTable, getWeeklyTable } from '../../../../../utils/tradeAnalyticsTime'
import {
  BarRow, Card, CardHead, Empty, Grid, Metric, NeedsMore, Pill, SectionTitle, Segmented,
  StatRow, TableScroll, Verdict,
} from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { BoxPlot, ColumnChart, Histogram, Sparkline, StackedBar } from '../charts'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Analysis → Performance. Everything that answers "is the edge real and
// how big is it". Money metrics are rendered once per currency group;
// count-based ones once for the whole log.

// ── F1-F14 ───────────────────────────────────────────────────────────
function CoreMetricsCard({ group, delay }) {
  const { trades, symbol, label } = group
  const perf = useMemo(() => getPerformance(trades), [trades])
  const expR = useMemo(() => getExpectancyR(trades), [trades])
  const rUnit = useMemo(() => rUnitFor(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true })

  if (perf.tradesWithPnl === 0) {
    return (
      <Card delay={delay}>
        <CardHead icon={Coins} title={`${label} core metrics (${symbol})`} />
        <Empty>No P&amp;L logged on {label.toLowerCase()} trades yet.</Empty>
      </Card>
    )
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={Coins}
        title={`${label} core metrics (${symbol})`}
        sub={`${perf.tradesWithPnl} trades`}
        hint="Every figure here is computed only from trades that carry a P&L value"
      />
      <div className="grid grid-cols-3 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Metric label="Net P&L" raw={perf.netPnl} format={money} color={signColor(perf.netPnl)} big />
        <Metric label="Expectancy" raw={perf.expectancy} format={money} color={signColor(perf.expectancy)} hint="Average currency result per trade taken — the number that decides whether to keep trading a system" />
        <Metric label="Profit factor" value={fmtNum(perf.profitFactor, 2)} hint="Gross profit ÷ gross loss. 1.0 is break-even, 1.5+ is solid, 2+ is strong." />
        <Metric label="Payoff" value={fmtNum(perf.payoffRatio, 2)} hint="Average win ÷ average loss" />
        <Metric label="Gross profit" raw={perf.grossProfit} format={(v) => fmtMoney(v, symbol)} color={POS} />
        <Metric label="Gross loss" raw={perf.grossLoss} format={(v) => fmtMoney(v, symbol)} color={NEG} />
        <Metric label="Avg win" raw={perf.avgWin} format={(v) => fmtMoney(v, symbol)} color={POS} />
        <Metric label="Avg loss" raw={perf.avgLoss} format={(v) => fmtMoney(v, symbol)} color={NEG} />
        <Metric label="Largest win" raw={perf.largestWin} format={(v) => fmtMoney(v, symbol)} color={POS} />
        <Metric label="Largest loss" raw={perf.largestLoss} format={(v) => fmtMoney(v, symbol)} color={NEG} />
        <Metric label="Median" raw={perf.medianPnl} format={money} color={signColor(perf.medianPnl)} hint="The middle result — less swayed by one huge trade than the average" />
        <Metric
          label="SQN"
          value={fmtNum(perf.sqn, 2)}
          hint="System Quality Number (Van Tharp): expectancy ÷ result volatility, scaled by sample size. Under 1.6 is hard to trade; over 2.5 is strong."
          color={perf.sqn == null ? undefined : perf.sqn >= 2.5 ? POS : perf.sqn < 1.6 ? NEG : undefined}
        />
      </div>

      <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--tad-border)' }}>
        <StackedBar
          segments={[
            { label: 'Winners', value: perf.winCount, color: POS },
            { label: 'Losers', value: perf.lossCount, color: NEG },
            { label: 'Break-even', value: perf.flatCount, color: 'var(--ta-slate)' },
          ]}
        />
        {expR != null && (
          <Verdict tone={expR > 0 ? 'good' : 'bad'}>
            Expectancy is {fmtNum(expR, 2)}R — every trade returns {fmtNum(expR, 2)} times the average loss
            ({fmtMoney(rUnit, symbol)}), which stands in for one unit of risk since the form doesn't capture a stop price.
          </Verdict>
        )}
      </div>
    </Card>
  )
}

// ── F87, F90, F91 ────────────────────────────────────────────────────
function DistributionCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [bins, setBins] = useState(12)
  const dist = useMemo(() => getPnlDistribution(trades, bins), [trades, bins])

  return (
    <Card delay={delay}>
      <CardHead
        icon={BarChart3}
        title={`${label} result spread`}
        right={
          <Segmented
            size="xs"
            value={String(bins)}
            onChange={(v) => setBins(Number(v))}
            options={[{ id: '8', label: '8' }, { id: '12', label: '12' }, { id: '20', label: '20' }]}
            layoutId={`bins-${group.id}`}
          />
        }
      />
      {dist.values.length < 4 ? (
        <NeedsMore have={dist.values.length} need={4} what="P&L values" />
      ) : (
        <>
          <Histogram bins={dist.bins} symbol={symbol} />
          <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--tad-border)' }}>
            <BoxPlot box={dist.box} symbol={symbol} />
          </div>
          {dist.box && (
            <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
              <Metric label="Q1" raw={dist.box.q1} format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })} color={signColor(dist.box.q1)} />
              <Metric label="Median" raw={dist.box.median} format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })} color={signColor(dist.box.median)} />
              <Metric label="Q3" raw={dist.box.q3} format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })} color={signColor(dist.box.q3)} />
              <Metric label="IQR" raw={dist.box.iqr} format={(v) => fmtMoney(v, symbol, { compact: true })} hint="Interquartile range — the span the middle half of trades falls within" />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ── F88 ──────────────────────────────────────────────────────────────
function RMultipleCard({ group, delay }) {
  const { trades, label } = group
  const rd = useMemo(() => getRDistribution(trades), [trades])
  const max = Math.max(...rd.buckets.map((b) => b.count), 1)

  return (
    <Card delay={delay}>
      <CardHead
        icon={Crosshair}
        title={`${label} R multiples`}
        sub={rd.sampleSize ? `${rd.sampleSize} trades` : undefined}
        hint="Each trade's result divided by the average loss, which stands in for one unit of risk"
      />
      {!rd.sampleSize ? (
        <Empty>R multiples need at least one logged loss to set the risk unit.</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            {rd.buckets.map((b, i) => (
              <BarRow
                key={b.label}
                label={b.label}
                pct={(b.count / max) * 100}
                value={b.count || '—'}
                color={b.label.includes('-') && !b.label.startsWith('-1 to 0') ? NEG : b.label.startsWith('-1 to 0') ? NEG : POS}
                labelWidth={58}
                valueWidth={26}
                delay={i * 0.03}
              />
            ))}
          </div>
          <div className="mt-1 grid grid-cols-3 border-t pt-1" style={{ gap: 'var(--tad-gap)', borderColor: 'var(--tad-border)' }}>
            <Metric label="Avg R" value={fmtNum(rd.avgR, 2)} color={signColor(rd.avgR)} />
            <Metric label="Best R" value={fmtNum(rd.bestR, 2)} color={POS} />
            <Metric label="Worst R" value={fmtNum(rd.worstR, 2)} color={NEG} />
          </div>
        </>
      )}
    </Card>
  )
}

// ── F41-F50 ──────────────────────────────────────────────────────────
function StreakCard({ trades, delay }) {
  const st = useMemo(() => getStreakStats(trades), [trades])
  const maxRun = Math.max(...st.runs.map((r) => r.length), 1)

  return (
    <Card delay={delay}>
      <CardHead icon={Repeat} title="Streaks" sub={`${st.runs.length} runs`} />
      {!st.sampleSize ? (
        <Empty>Resolve some trades to map win and loss runs.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric
              label="Current"
              value={st.currentType ? `${st.current}${st.currentType === 'win' ? 'W' : 'L'}` : '—'}
              color={st.currentType === 'win' ? POS : NEG}
              big
            />
            <Metric label="Best run" raw={st.maxWin} color={POS} />
            <Metric label="Worst run" raw={st.maxLoss} color={NEG} />
            <Metric label="Avg win run" value={fmtNum(st.avgWinStreak, 1)} />
          </div>
          {/* Run ribbon — every streak in order, width proportional to length */}
          <div className="ta-scroll ta-scroll-x mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--tad-border)' }}>
            <div className="flex items-end gap-px" style={{ minWidth: st.runs.length * 7 }}>
              {st.runs.map((r, i) => (
                <div
                  key={i}
                  title={`${r.length} ${r.type === 'win' ? 'win' : 'loss'}${r.length > 1 ? 'es' : ''} in a row`}
                  className="shrink-0 rounded-sm"
                  style={{
                    width: 6,
                    height: 6 + (r.length / maxRun) * 22,
                    backgroundColor: r.type === 'win' ? POS : NEG,
                    opacity: 0.55 + (r.length / maxRun) * 0.45,
                  }}
                />
              ))}
            </div>
          </div>
          <Verdict>Each bar is one uninterrupted run, oldest on the left. Height is its length.</Verdict>
        </>
      )}
    </Card>
  )
}

// ── F46-F49 ──────────────────────────────────────────────────────────
function ConsistencyCard({ group, delay }) {
  const { trades, label } = group
  const c = useMemo(() => getConsistency(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Sigma} title={`${label} consistency`} hint="How evenly profit arrives rather than how much of it there is" />
      {!c.monthCount ? (
        <Empty>Consistency needs at least one month with a logged P&amp;L.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Score" value={c.score == null ? '—' : `${c.score}`} color="var(--ta-accent)" big hint="100 = perfectly even monthly returns" />
            <Metric label="Green months" value={fmtPct(c.profitableMonthsPct, 0)} sub={`of ${c.monthCount}`} color={POS} />
            <Metric label="Green weeks" value={fmtPct(c.profitableWeeksPct, 0)} sub={`of ${c.weekCount}`} />
            <Metric label="Green days" value={fmtPct(c.profitableDaysPct, 0)} sub={`of ${c.dayCount}`} />
          </div>
          {c.topMonthShare != null && (
            <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--tad-border)' }}>
              <StatRow label="Best month's share of all profit" value={fmtPct(c.topMonthShare, 0)} color={c.topMonthShare > 70 ? NEG : undefined} strong />
              <Verdict tone={c.topMonthShare > 70 ? 'warn' : 'good'}>
                {c.topMonthShare > 70
                  ? 'One month carries most of the result — the rest of the record is close to flat.'
                  : 'Profit is spread across several months rather than resting on one.'}
              </Verdict>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ── F57-F59 ──────────────────────────────────────────────────────────
function ExtremesCard({ group, delay }) {
  const { trades, symbol, label } = group
  const ex = useMemo(() => getPeriodExtremes(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  const rows = [
    { period: 'Day', best: ex.day.best, worst: ex.day.worst },
    { period: 'Week', best: ex.week.best, worst: ex.week.worst },
    { period: 'Month', best: ex.month.best, worst: ex.month.worst },
  ].filter((r) => r.best)

  return (
    <Card delay={delay}>
      <CardHead icon={Medal} title={`${label} best & worst`} />
      {!rows.length ? (
        <Empty>No period has a logged P&amp;L yet.</Empty>
      ) : (
        <TableScroll maxHeight={132}>
          <table className="ta-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-right">Best</th>
                <th className="text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period}>
                  <td className="font-semibold">{r.period}</td>
                  <td className="text-right" style={{ color: POS }} title={r.best.key}>
                    {money(r.best.pnl)}
                  </td>
                  <td className="text-right" style={{ color: NEG }} title={r.worst?.key}>
                    {r.worst ? money(r.worst.pnl) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  )
}

// ── F51-F60 monthly / weekly ledger ──────────────────────────────────
function LedgerCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [mode, setMode] = useState('month')
  const rows = useMemo(
    () => (mode === 'month' ? getMonthlyTable(trades, 18) : getWeeklyTable(trades, 18)),
    [trades, mode]
  )
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={CalendarRange}
        title={`${label} ledger`}
        right={
          <Segmented
            size="xs"
            value={mode}
            onChange={setMode}
            options={[{ id: 'month', label: 'Monthly' }, { id: 'week', label: 'Weekly' }]}
            layoutId={`ledger-${group.id}`}
          />
        }
      />
      {!rows.length ? (
        <Empty>Nothing in range.</Empty>
      ) : (
        <>
          <ColumnChart data={rows} valueKey="pnl" labelKey="label" symbol={symbol} height={82} />
          <div className="mt-1.5">
            <TableScroll maxHeight={168}>
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>{mode === 'month' ? 'Month' : 'Week'}</th>
                    <th className="text-right">Trades</th>
                    <th className="text-right">Win %</th>
                    <th className="text-right">P&L</th>
                    <th className="text-right">Running</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.key}>
                      <td className="font-semibold">{r.label}</td>
                      <td className="text-right">{r.trades}</td>
                      <td className="text-right" style={{ color: r.winRate == null ? undefined : r.winRate >= 50 ? POS : NEG }}>
                        {fmtPct(r.winRate, 0)}
                      </td>
                      <td className="text-right font-semibold" style={{ color: signColor(r.pnl) }}>
                        {r.withPnl ? money(r.pnl) : '—'}
                      </td>
                      <td className="text-right" style={{ color: signColor(r.cumulative) }}>
                        {money(r.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </>
      )}
    </Card>
  )
}

// ── F55-F56 ──────────────────────────────────────────────────────────
function RollingCard({ trades, delay }) {
  const [win, setWin] = useState(10)
  const rolling = useMemo(() => getRollingMetrics(trades, win), [trades, win])

  return (
    <Card delay={delay}>
      <CardHead
        icon={TrendingUp}
        title="Rolling form"
        hint="Win rate over a sliding window of trades — shows whether recent form differs from the lifetime average"
        right={
          <Segmented
            size="xs"
            value={String(win)}
            onChange={(v) => setWin(Number(v))}
            options={[{ id: '5', label: '5' }, { id: '10', label: '10' }, { id: '20', label: '20' }]}
            layoutId="rolling-window"
          />
        }
      />
      {rolling.length < 2 ? (
        <NeedsMore have={trades.length} need={win + 1} />
      ) : (
        <>
          <Sparkline values={rolling.map((r) => r.winRate ?? 0)} height={46} color="var(--ta-accent)" baseline={50} />
          <div className="mt-1 grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Latest" value={fmtPct(rolling[rolling.length - 1].winRate, 0)} color="var(--ta-accent)" />
            <Metric
              label="Peak"
              value={fmtPct(Math.max(...rolling.map((r) => r.winRate ?? 0)), 0)}
              color={POS}
            />
            <Metric
              label="Trough"
              value={fmtPct(Math.min(...rolling.map((r) => r.winRate ?? 0)), 0)}
              color={NEG}
            />
          </div>
          <Verdict>Dashed line is the 50% break-even mark for a 1:1 reward ratio.</Verdict>
        </>
      )}
    </Card>
  )
}

// ── F93 ──────────────────────────────────────────────────────────────
function EdgeDecayCard({ group, delay }) {
  const { trades, symbol, label } = group
  const d = useMemo(() => getEdgeDecay(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true })

  return (
    <Card delay={delay}>
      <CardHead icon={Split} title={`${label} edge over time`} hint="Splits the log in half chronologically and compares the two halves" />
      {!d.available ? (
        <NeedsMore have={d.sampleSize} need={8} />
      ) : (
        <>
          <TableScroll maxHeight={120}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Half</th>
                  <th className="text-right">Trades</th>
                  <th className="text-right">Win %</th>
                  <th className="text-right">Expectancy</th>
                  <th className="text-right">PF</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Earlier</td>
                  <td className="text-right">{d.first.count}</td>
                  <td className="text-right">{fmtPct(d.first.winRate, 0)}</td>
                  <td className="text-right" style={{ color: signColor(d.first.expectancy) }}>{money(d.first.expectancy)}</td>
                  <td className="text-right">{fmtNum(d.first.profitFactor, 2)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Recent</td>
                  <td className="text-right">{d.second.count}</td>
                  <td className="text-right">{fmtPct(d.second.winRate, 0)}</td>
                  <td className="text-right" style={{ color: signColor(d.second.expectancy) }}>{money(d.second.expectancy)}</td>
                  <td className="text-right">{fmtNum(d.second.profitFactor, 2)}</td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Pill color={d.expectancyDelta > 0 ? POS : NEG}>
              Expectancy {d.expectancyDelta > 0 ? '+' : ''}{money(d.expectancyDelta)}
            </Pill>
            {d.winRateDelta != null && (
              <Pill color={d.winRateDelta > 0 ? POS : NEG}>
                Win rate {d.winRateDelta > 0 ? '+' : ''}{fmtNum(d.winRateDelta, 1)}pt
              </Pill>
            )}
          </div>
          <Verdict tone={d.expectancyDelta > 0 ? 'good' : 'warn'}>{d.verdict}</Verdict>
        </>
      )}
    </Card>
  )
}

// ── F94 what-if ──────────────────────────────────────────────────────
function WhatIfCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [n, setN] = useState(3)
  const wi = useMemo(() => getWhatIf(trades, n), [trades, n])
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={Boxes}
        title={`${label} without the extremes`}
        hint="Recomputes the result with the biggest winners and losers removed"
        right={
          <Segmented
            size="xs"
            value={String(n)}
            onChange={(v) => setN(Number(v))}
            options={[{ id: '1', label: '1' }, { id: '3', label: '3' }, { id: '5', label: '5' }]}
            layoutId={`whatif-${group.id}`}
          />
        }
      />
      {!wi.available ? (
        <NeedsMore have={wi.sampleSize} need={n * 2 + 1} what="P&L values" />
      ) : (
        <>
          <TableScroll maxHeight={132}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">Win %</th>
                  <th className="text-right">PF</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: 'As traded', v: wi.base },
                  { k: `Minus top ${n}`, v: wi.noBest },
                  { k: `Minus worst ${n}`, v: wi.noWorst },
                  { k: 'Minus both', v: wi.noBoth },
                ].map((row) => (
                  <tr key={row.k}>
                    <td className="font-semibold">{row.k}</td>
                    <td className="text-right font-semibold" style={{ color: signColor(row.v.netPnl) }}>{money(row.v.netPnl)}</td>
                    <td className="text-right">{fmtPct(row.v.winRate, 0)}</td>
                    <td className="text-right">{fmtNum(row.v.profitFactor, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <Verdict tone={wi.stillProfitableWithoutBest ? 'good' : 'warn'}>
            {wi.stillProfitableWithoutBest
              ? `Still profitable without the top ${n} — the edge is broad rather than resting on a handful of trades.`
              : `Removing the top ${n} trades turns the record negative. Worth checking whether those setups repeat.`}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F89 cumulative distribution ──────────────────────────────────────
function CdfCard({ group, delay }) {
  const { trades, symbol, label } = group
  const cdf = useMemo(() => getCdf(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Layers} title={`${label} percentile ladder`} hint="The result at each percentile of your trade history" />
      {cdf.length < 2 ? (
        <Empty>Two or more P&amp;L values are needed.</Empty>
      ) : (
        <>
          <Sparkline values={cdf.map((c) => c.value)} height={44} color="var(--ta-accent)" baseline={0} />
          <div className="mt-1 grid grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
            {[5, 25, 50, 75, 95].map((p) => {
              const row = cdf.reduce((best, c) => (Math.abs(c.pct - p) < Math.abs(best.pct - p) ? c : best), cdf[0])
              return (
                <Metric
                  key={p}
                  label={`P${p}`}
                  raw={row.value}
                  format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })}
                  color={signColor(row.value)}
                />
              )
            })}
          </div>
          <Verdict>P5 is the result only 5% of trades fall below — a practical read on the bad tail.</Verdict>
        </>
      )}
    </Card>
  )
}

export default function PerformanceSection() {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const dual = groups.length > 1

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <SectionTitle icon={Trophy} title="Core performance" sub="per settlement currency" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => <CoreMetricsCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={BarChart3} title="Distribution" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}>
        {groups.map((g, i) => <DistributionCard key={g.id} group={g} delay={i * 0.03} />)}
        {groups.map((g, i) => <RMultipleCard key={g.id} group={g} delay={0.06 + i * 0.03} />)}
        {groups.map((g, i) => <CdfCard key={g.id} group={g} delay={0.09 + i * 0.03} />)}
      </Grid>

      <SectionTitle icon={Repeat} title="Runs & steadiness" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <StreakCard trades={trades} delay={0.02} />
        <RollingCard trades={trades} delay={0.05} />
        {groups.map((g, i) => <ConsistencyCard key={g.id} group={g} delay={0.08 + i * 0.03} />)}
        {groups.map((g, i) => <ExtremesCard key={g.id} group={g} delay={0.11 + i * 0.03} />)}
      </Grid>

      <SectionTitle icon={CalendarRange} title="Period ledger" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => <LedgerCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={Split} title="Stress tests" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        {groups.map((g, i) => <EdgeDecayCard key={g.id} group={g} delay={i * 0.03} />)}
        {groups.map((g, i) => <WhatIfCard key={g.id} group={g} delay={0.06 + i * 0.03} />)}
      </Grid>
    </div>
  )
}
