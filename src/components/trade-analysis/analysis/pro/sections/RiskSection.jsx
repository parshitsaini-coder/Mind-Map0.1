import { useMemo, useState } from 'react'
import {
  Activity, AlertOctagon, Anchor, Dices, Droplet, Scale, Shield, ShieldAlert, Waves,
} from 'lucide-react'
import { getDrawdownStats, getKelly, getOutliers, getRiskOfRuin, getRiskRatios, getZScore, runMonteCarlo } from '../../../../../utils/tradeAnalyticsPro'
import { normaliseRisk } from '../../../../../utils/tradeTools'
import {
  Card, CardHead, Empty, Grid, Metric, NeedsMore, Pill, SectionTitle, Segmented, StatRow,
  TableScroll, Verdict,
} from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { FanChart, Gauge, Sparkline, UnderwaterChart } from '../charts'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Analysis → Risk. Drawdown, volatility, tails and survival. The section
// that answers "what could this cost me" rather than "what has it made".

// ── F15-F26 ──────────────────────────────────────────────────────────
function DrawdownCard({ group, delay }) {
  const { trades, symbol, label } = group
  const dd = useMemo(() => getDrawdownStats(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={Waves}
        title={`${label} drawdown`}
        sub={dd.inDrawdown ? 'under water now' : 'at a high'}
        hint="Peak-to-trough falls in the running balance"
      />
      {dd.curve.length < 2 ? (
        <Empty height={70}>Two or more P&amp;L values are needed to map drawdown.</Empty>
      ) : (
        <>
          <UnderwaterChart points={dd.curve} symbol={symbol} />
          <div className="mt-1 grid grid-cols-3 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Max DD" raw={dd.maxDrawdown} format={money} color={NEG} big />
            <Metric label="Max DD %" value={fmtPct(dd.maxDrawdownPct, 1)} color={NEG} hint="Deepest fall as a share of the peak it fell from" />
            <Metric label="Current" raw={dd.currentDrawdown} format={money} color={dd.inDrawdown ? NEG : POS} />
            <Metric label="Recovery factor" value={fmtNum(dd.recoveryFactor, 2)} hint="Net profit ÷ max drawdown. Above 3 means the account earns well relative to the pain." />
            <Metric label="Longest under water" value={`${dd.longestDrawdownTrades}t`} hint="Most consecutive trades spent below a prior peak" />
            <Metric label="Ulcer index" value={fmtNum(dd.ulcerIndex, 2)} hint="Root-mean-square drawdown — punishes long shallow pain as well as one sharp drop" />
            <Metric label="New highs" raw={dd.newHighs} color={POS} />
            <Metric
              label="Recovered?"
              value={dd.recovered == null ? '—' : dd.recovered ? 'Yes' : 'Not yet'}
              color={dd.recovered ? POS : NEG}
              hint="Whether the balance has made a new high since its worst trough"
            />
          </div>
        </>
      )}
    </Card>
  )
}

// ── F27-F40 ──────────────────────────────────────────────────────────
function RatiosCard({ group, delay }) {
  const { trades, symbol, label } = group
  const r = useMemo(() => getRiskRatios(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={Scale}
        title={`${label} risk ratios`}
        sub={`n=${r.sampleSize}`}
        hint="Computed per trade rather than annualised — a discretionary journal has no fixed period length, and annualising it would invent precision"
      />
      {r.sampleSize < 2 ? (
        <NeedsMore have={r.sampleSize} need={2} what="P&L values" />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
          <Metric label="Sharpe" value={fmtNum(r.sharpe, 2)} color={r.sharpe > 0.3 ? POS : r.sharpe < 0 ? NEG : undefined} hint="Average result ÷ result volatility" />
          <Metric label="Sortino" value={fmtNum(r.sortino, 2)} color={r.sortino > 0.4 ? POS : r.sortino < 0 ? NEG : undefined} hint="Like Sharpe but only downside swings count against you" />
          <Metric label="Calmar" value={fmtNum(r.calmar, 2)} hint="Net profit ÷ max drawdown" />
          <Metric label="Omega" value={fmtNum(r.omega, 2)} hint="Total gains ÷ total losses at a zero threshold" />
          <Metric label="Gain/pain" value={fmtNum(r.gainToPain, 2)} hint="Net profit per unit of total loss endured" />
          <Metric label="Tail ratio" value={fmtNum(r.tailRatio, 2)} hint="Size of the best 5% against the worst 5%. Above 1 means winners out-run losers at the extremes." />
          <Metric label="Std dev" raw={r.stdev} format={(v) => fmtMoney(v, symbol)} hint="Typical swing around the average result" />
          <Metric label="Downside dev" raw={r.downsideDev} format={(v) => fmtMoney(v, symbol)} color={NEG} />
          <Metric label="VaR 95%" raw={r.var95} format={money} color={NEG} hint="The loss the worst 5% of trades exceed" />
          <Metric label="CVaR 95%" raw={r.cvar95} format={money} color={NEG} hint="Average loss once you are inside that worst 5%" />
          <Metric label="Skew" value={fmtNum(r.skew, 2)} hint="Positive means a long right tail — a few big winners carry the account" />
          <Metric label="Kurtosis" value={fmtNum(r.kurt, 2)} color={r.kurt > 3 ? NEG : undefined} hint="Excess kurtosis. High values mean fat tails: rare trades far outside the normal range." />
        </div>
      )}
    </Card>
  )
}

// ── F38, F39 ─────────────────────────────────────────────────────────
function SurvivalCard({ group, delay }) {
  const { trades, label } = group
  const [units, setUnits] = useState(20)
  const kelly = useMemo(() => getKelly(trades), [trades])
  const ruin = useMemo(() => getRiskOfRuin(trades, units), [trades, units])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Shield}
        title={`${label} survival`}
        hint="Position sizing implied by the realised edge, and the odds of blowing up at that size"
        right={
          <Segmented
            size="xs"
            value={String(units)}
            onChange={(v) => setUnits(Number(v))}
            options={[{ id: '10', label: '10R' }, { id: '20', label: '20R' }, { id: '50', label: '50R' }]}
            layoutId={`ruin-${group.id}`}
          />
        }
      />
      {kelly.kellyPct == null ? (
        <NeedsMore have={kelly.sampleSize} need={2} what="resolved trades" />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Gauge
              pct={ruin.riskOfRuinPct == null ? 0 : Math.min(100, ruin.riskOfRuinPct)}
              size={62}
              centerTop={ruin.riskOfRuinPct == null ? '—' : `${ruin.riskOfRuinPct < 0.1 ? '<0.1' : fmtNum(ruin.riskOfRuinPct, 1)}%`}
              centerBottom="ruin risk"
              color={ruin.riskOfRuinPct > 10 ? NEG : ruin.riskOfRuinPct > 1 ? '#d97706' : POS}
            />
            <div className="min-w-0 flex-1">
              <StatRow label="Kelly fraction" value={fmtPct(kelly.kellyPct, 1)} color={kelly.kellyPct > 0 ? POS : NEG} strong />
              <StatRow label="Half Kelly (working size)" value={fmtPct(kelly.halfKellyPct, 1)} hint="Most traders cap at half-Kelly because Kelly assumes the win rate holds exactly" />
              <StatRow label="Payoff ratio" value={fmtNum(kelly.payoffRatio, 2)} />
              <StatRow label="Capital modelled" value={`${units} risk units`} />
            </div>
          </div>
          <Verdict tone={kelly.kellyPct > 0 ? 'good' : 'bad'}>
            {kelly.kellyPct > 0
              ? `A ${fmtPct(kelly.winRate, 0)} win rate at ${fmtNum(kelly.payoffRatio, 2)} payoff supports risking up to ${fmtPct(kelly.halfKellyPct, 1)} per trade.`
              : 'The realised edge is negative, so the mathematically optimal position size is zero.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F92 Monte Carlo from the person's own trades ─────────────────────
function MonteCarloCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [runs, setRuns] = useState(1000)
  const mc = useMemo(() => runMonteCarlo(trades, { runs }), [trades, runs])
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={Dices}
        title={`${label} sequence risk`}
        sub={mc.available ? `${mc.runs} runs` : undefined}
        hint="Reshuffles your own logged results thousands of times. Every simulated trade is one you really took — only the order changes."
        right={
          <Segmented
            size="xs"
            value={String(runs)}
            onChange={(v) => setRuns(Number(v))}
            options={[{ id: '500', label: '500' }, { id: '1000', label: '1k' }, { id: '3000', label: '3k' }]}
            layoutId={`mc-${group.id}`}
          />
        }
      />
      {!mc.available ? (
        <NeedsMore have={mc.sampleSize} need={5} what="P&L values" />
      ) : (
        <>
          <FanChart paths={mc.paths} median={mc.median} actual={mc.actualFinal} symbol={symbol} startValue={0} />
          <div className="mt-1 grid grid-cols-3 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="P(profit)" value={fmtPct(mc.probProfitablePct, 0)} color={mc.probProfitablePct > 70 ? POS : mc.probProfitablePct < 50 ? NEG : undefined} big />
            <Metric label="Median" raw={mc.median} format={money} color={signColor(mc.median)} />
            <Metric label="5th pct" raw={mc.p5} format={money} color={NEG} hint="A bad-luck ordering of the same trades" />
            <Metric label="95th pct" raw={mc.p95} format={money} color={POS} hint="A good-luck ordering of the same trades" />
            <Metric label="Typical worst DD" raw={mc.medianMaxDrawdown} format={(v) => fmtMoney(-v, symbol, { compact: true })} color={NEG} />
            <Metric label="95th pct DD" raw={mc.p95MaxDrawdown} format={(v) => fmtMoney(-v, symbol, { compact: true })} color={NEG} hint="The drawdown you should be prepared for, not the one you have seen" />
            <Metric label="Your actual" raw={mc.actualFinal} format={money} color={signColor(mc.actualFinal)} />
            <Metric label="Sample" value={`${mc.sampleSize} trades`} />
          </div>
          <Verdict tone={mc.probProfitablePct > 70 ? 'good' : 'warn'}>
            Same trades, different order: {fmtPct(mc.probProfitablePct, 0)} of orderings finish profitable, and the
            worst 5% of them draw down at least {fmtMoney(mc.p95MaxDrawdown, symbol, { compact: true })}.
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F40 randomness of streaks ────────────────────────────────────────
function RandomnessCard({ trades, delay }) {
  const z = useMemo(() => getZScore(trades), [trades])
  return (
    <Card delay={delay}>
      <CardHead icon={Activity} title="Are the streaks real?" hint="Wald-Wolfowitz runs test on the win/loss sequence" />
      {z.z == null ? (
        <Empty>{z.verdict}</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Z score" value={fmtNum(z.z, 2)} color={Math.abs(z.z) >= 1.96 ? 'var(--ta-accent)' : undefined} big />
            <Metric label="Runs seen" raw={z.runs} />
            <Metric label="Runs expected" value={fmtNum(z.expectedRuns, 1)} />
            <Metric label="p-value" value={fmtNum(z.pValue, 3)} hint="Below 0.05 means the pattern is unlikely to be chance" />
          </div>
          <Verdict tone={Math.abs(z.z) >= 1.96 ? 'warn' : 'info'}>
            {z.verdict}. {Math.abs(z.z) < 1.96
              ? 'Treating a run of wins or losses as meaningful is not supported by this data.'
              : z.z < 0
                ? 'Outcomes cluster more than randomness predicts, so reducing size during a losing run has some statistical basis here.'
                : 'Outcomes flip more often than randomness predicts.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F91 outliers ─────────────────────────────────────────────────────
function OutlierCard({ group, delay }) {
  const { trades, symbol, label } = group
  const o = useMemo(() => getOutliers(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={AlertOctagon}
        title={`${label} outliers`}
        badge={o.outliers.length || undefined}
        hint="Trades outside the Tukey fences (1.5× the interquartile range beyond the quartiles)"
      />
      {!o.box ? (
        <NeedsMore have={o.sampleSize} need={4} what="P&L values" />
      ) : !o.outliers.length ? (
        <Empty>No statistical outliers — results sit in a consistent band.</Empty>
      ) : (
        <>
          <TableScroll maxHeight={124}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th className="text-right">P&L</th>
                  <th className="text-right">Side</th>
                </tr>
              </thead>
              <tbody>
                {o.outliers.map((t) => (
                  <tr key={t.id}>
                    <td className="truncate font-semibold" style={{ maxWidth: 120 }} title={t.name}>{t.name}</td>
                    <td className="text-right font-semibold" style={{ color: signColor(t.pnl) }}>{money(t.pnl)}</td>
                    <td className="text-right">
                      <Pill color={t.side === 'high' ? POS : NEG}>{t.side === 'high' ? 'Upside' : 'Downside'}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <div className="mt-1 grid grid-cols-3 border-t pt-1" style={{ gap: 'var(--tad-gap)', borderColor: 'var(--tad-border)' }}>
            <Metric label="With outliers" raw={o.netWith} format={money} color={signColor(o.netWith)} />
            <Metric label="Without" raw={o.netWithout} format={money} color={signColor(o.netWithout)} />
            <Metric label="Trimmed expectancy" raw={o.expectancyWithout} format={money} color={signColor(o.expectancyWithout)} />
          </div>
        </>
      )}
    </Card>
  )
}

// ── Sizing quality (equal-weight replay) ─────────────────────────────
function SizingCard({ group, delay }) {
  const { trades, symbol, label } = group
  const n = useMemo(() => normaliseRisk(trades), [trades])
  const money = (v) => fmtMoney(v, symbol, { signed: true, compact: true })

  return (
    <Card delay={delay}>
      <CardHead
        icon={Anchor}
        title={`${label} sizing quality`}
        hint="Replays the same trades in the same order as if every one had been the same size. The gap is entirely position sizing."
      />
      {!n.available ? (
        <NeedsMore have={n.sampleSize} need={5} what="P&L values" />
      ) : (
        <>
          <Sparkline values={n.curve.map((c) => c.actual)} height={34} baseline={0} />
          <div className="mt-1 grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="As traded" raw={n.actualFinal} format={money} color={signColor(n.actualFinal)} />
            <Metric label="Equal size" raw={n.flatFinal} format={money} color={signColor(n.flatFinal)} />
            <Metric label="Sizing added" raw={n.difference} format={money} color={signColor(n.difference)} />
          </div>
          <Verdict tone={n.sizingHelped ? 'good' : 'warn'}>{n.verdict}</Verdict>
        </>
      )}
    </Card>
  )
}

export default function RiskSection() {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const dual = groups.length > 1

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <SectionTitle icon={Waves} title="Drawdown" sub="how far the balance falls and for how long" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => <DrawdownCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={Scale} title="Risk-adjusted quality" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => <RatiosCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={ShieldAlert} title="Survival & sequence risk" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        {groups.map((g, i) => <SurvivalCard key={g.id} group={g} delay={i * 0.03} />)}
        <RandomnessCard trades={trades} delay={0.06} />
        {groups.map((g, i) => <SizingCard key={g.id} group={g} delay={0.09 + i * 0.03} />)}
      </Grid>

      <SectionTitle icon={Dices} title="Monte Carlo" sub="your own trades, reshuffled" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => <MonteCarloCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={Droplet} title="Extremes" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        {groups.map((g, i) => <OutlierCard key={g.id} group={g} delay={i * 0.03} />)}
      </Grid>
    </div>
  )
}
