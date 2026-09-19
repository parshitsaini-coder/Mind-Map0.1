import { motion } from 'framer-motion'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Flame,
  Gauge as GaugeIcon, LineChart, ListChecks, Percent, Scale, Target, TrendingUp, Trophy, Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import {
  getDrawdownStats, getEquityCurve, getPerformance, getStreakStats, hasPnl, isPending, outcomeOf, pnlOf,
} from '../../../../../utils/tradeAnalyticsPro'
import { getKpis } from '../../../../../utils/tradeAnalytics'
import { getDisciplineScore } from '../../../../../utils/tradeAnalyticsBehavior'
import { getConcentration, getPerformerSpotlight } from '../../../../../utils/tradeAnalyticsEdge'
import { getCadenceStats, getDayOfWeekStats } from '../../../../../utils/tradeAnalyticsTime'
import { getInsights, SEVERITY_META } from '../../../../../utils/tradeInsights'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import { BarRow, Card, CardHead, Empty, Grid, Metric, Pill, SectionTitle, StatRow, Verdict } from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { Donut, EquityCurve, Sparkline } from '../charts'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Analysis → Overview. The page that answers "how am I doing" in under
// five seconds, then gives progressively more detail down the scroll.
// Everything here is scoped by the toolbar's date range and split by
// currency wherever money is involved.

// ── F1-F14: headline performance strip ───────────────────────────────
function HeadlineStrip({ trades }) {
  const kpis = getKpis(trades)
  const streak = getStreakStats(trades)
  const discipline = getDisciplineScore(trades)

  const cards = [
    { label: 'Trades', raw: kpis.total, icon: ListChecks },
    { label: 'Win rate', value: fmtPct(kpis.winRatePct, 0), color: 'var(--ta-accent)', icon: Percent, hint: 'Target Hit vs SL Hit across resolved trades' },
    { label: 'Open', raw: kpis.pending, icon: Activity, hint: 'Still pending — these do not count towards win rate' },
    {
      label: 'Streak',
      value: streak.currentType ? `${streak.current} ${streak.currentType === 'win' ? 'W' : 'L'}` : '—',
      color: streak.currentType === 'loss' ? NEG : streak.currentType === 'win' ? POS : undefined,
      icon: Flame,
      hint: `Best run ${streak.maxWin}W · worst ${streak.maxLoss}L`,
    },
    {
      label: 'Discipline',
      value: discipline.score == null ? '—' : `${discipline.score}`,
      sub: discipline.grade ? `Grade ${discipline.grade}` : undefined,
      color: 'var(--ta-accent)',
      icon: GaugeIcon,
      hint: 'Checklist adherence, coverage and consistency combined',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
      {cards.map((c, i) => (
        <Card key={c.label} delay={i * 0.03}>
          <div className="flex items-center gap-1.5">
            <c.icon size={12} style={{ color: 'var(--ta-accent)', flexShrink: 0 }} />
            <Metric label={c.label} value={c.value} raw={c.raw} sub={c.sub} color={c.color} hint={c.hint} big />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── F15-F26: equity curve per currency ───────────────────────────────
function EquityCard({ group, delay }) {
  const { trades, symbol, label } = group
  const curve = useMemo(() => getEquityCurve(trades), [trades])
  const perf = useMemo(() => getPerformance(trades), [trades])
  const dd = useMemo(() => getDrawdownStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead
        icon={LineChart}
        title={`${label} equity (${symbol})`}
        sub={`${perf.tradesWithPnl} with P&L`}
        hint="Cumulative P&L after every trade, against its own running high-water mark"
      />
      {perf.tradesWithPnl < 2 ? (
        <Empty height={72}>Log a P&amp;L on two or more {label.toLowerCase()} trades to draw the curve.</Empty>
      ) : (
        <>
          <EquityCurve points={curve} symbol={symbol} />
          <div className="mt-1 grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Net" raw={perf.netPnl} format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })} color={signColor(perf.netPnl)} />
            <Metric label="Max DD" raw={dd.maxDrawdown} format={(v) => fmtMoney(v, symbol, { compact: true })} color={NEG} hint="Deepest peak-to-trough fall" />
            <Metric label="Profit factor" value={fmtNum(perf.profitFactor, 2)} hint="Gross profit ÷ gross loss. Above 1.0 is profitable." />
            <Metric label="Expectancy" raw={perf.expectancy} format={(v) => fmtMoney(v, symbol, { signed: true })} color={signColor(perf.expectancy)} hint="Average result per trade taken" />
          </div>
        </>
      )}
    </Card>
  )
}

// ── F87: outcome mix ─────────────────────────────────────────────────
function OutcomeMix({ trades, delay }) {
  const wins = trades.filter((t) => outcomeOf(t) === 'win').length
  const losses = trades.filter((t) => outcomeOf(t) === 'loss').length
  const open = trades.filter(isPending).length
  const flat = trades.length - wins - losses - open
  const resolved = wins + losses

  return (
    <Card delay={delay}>
      <CardHead icon={Target} title="Outcome mix" sub={`${resolved} resolved`} />
      <div className="flex items-center gap-2">
        <Donut
          size={64}
          stroke={9}
          segments={[
            { label: 'Wins', value: wins, color: POS },
            { label: 'Losses', value: losses, color: NEG },
            { label: 'Open', value: open, color: 'var(--ta-slate)' },
            { label: 'Break-even', value: flat, color: 'var(--ta-accent)' },
          ]}
          centerTop={resolved ? `${Math.round((wins / resolved) * 100)}%` : '—'}
          centerBottom="win rate"
          centerColor="var(--ta-accent)"
        />
        <div className="min-w-0 flex-1">
          <StatRow label="Wins" value={wins} color={POS} strong />
          <StatRow label="Losses" value={losses} color={NEG} strong />
          <StatRow label="Still open" value={open} />
          {flat > 0 && <StatRow label="Break-even" value={flat} />}
        </div>
      </div>
    </Card>
  )
}

// ── F82-F83: best & worst instrument ─────────────────────────────────
function SpotlightCard({ trades, delay }) {
  const spot = useMemo(() => getPerformerSpotlight(trades), [trades])
  const conc = useMemo(() => getConcentration(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Trophy} title="Instrument spotlight" sub={spot.available ? `min ${spot.minTrades} trades` : undefined} />
      {!spot.available ? (
        <Empty>Three or more trades in one instrument are needed to rank performers.</Empty>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight size={11} style={{ color: POS, flexShrink: 0 }} />
            <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
              {spot.best.key}
            </span>
            <Pill color={POS}>{fmtPct(spot.best.winRate, 0)}</Pill>
            <span className="ta-num shrink-0 font-bold" style={{ fontSize: 'var(--tad-body)', color: signColor(spot.best.netPnl) }}>
              {spot.best.count}t
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowDownRight size={11} style={{ color: NEG, flexShrink: 0 }} />
            <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
              {spot.worst.key}
            </span>
            <Pill color={NEG}>{fmtPct(spot.worst.winRate, 0)}</Pill>
            <span className="ta-num shrink-0 font-bold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-slate)' }}>
              {spot.worst.count}t
            </span>
          </div>
          <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--tad-border)' }}>
            <StatRow label="Effective instruments" value={fmtNum(conc.effectiveCount, 1)} hint="Inverse Herfindahl index — how many names you genuinely spread across" />
            <StatRow label="Most traded" value={`${spot.mostTraded.key} · ${spot.mostTraded.count}`} />
          </div>
          <Verdict tone={conc.hhi > 0.35 ? 'warn' : 'info'}>{conc.verdict}</Verdict>
        </div>
      )}
    </Card>
  )
}

// ── F51: day-of-week quick read ──────────────────────────────────────
function DayPatternCard({ trades, delay }) {
  const dow = useMemo(() => getDayOfWeekStats(trades), [trades])
  const cadence = useMemo(() => getCadenceStats(trades), [trades])
  const maxTrades = Math.max(...dow.map((d) => d.trades), 1)

  return (
    <Card delay={delay}>
      <CardHead icon={CalendarDays} title="Weekly rhythm" sub={cadence.tradesPerWeek ? `${fmtNum(cadence.tradesPerWeek, 1)}/week` : undefined} />
      <div className="flex flex-col gap-0.5">
        {dow.map((d, i) => (
          <BarRow
            key={d.label}
            label={d.label}
            pct={(d.trades / maxTrades) * 100}
            value={d.winRate == null ? `${d.trades}` : fmtPct(d.winRate, 0)}
            color={d.winRate == null ? 'var(--ta-slate)' : d.winRate >= 50 ? POS : NEG}
            labelWidth={26}
            valueWidth={34}
            delay={i * 0.03}
            title={`${d.trades} trades · ${d.wins}W ${d.losses}L`}
          />
        ))}
      </div>
      <Verdict>Bar length is trade count; the number is that day's win rate.</Verdict>
    </Card>
  )
}

// ── F96: top insights preview ────────────────────────────────────────
function InsightsPreview({ trades, delay, onSeeAll }) {
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const insights = useMemo(() => getInsights(trades, rules, categories), [trades, rules, categories])
  const top = insights.slice(0, 4)

  return (
    <Card delay={delay} span="sm:col-span-2 xl:col-span-2">
      <CardHead
        icon={AlertTriangle}
        title="What stands out"
        badge={insights.length || undefined}
        right={
          insights.length > 4 ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-accent)' }}
            >
              See all {insights.length}
            </button>
          ) : undefined
        }
      />
      {!top.length ? (
        <Empty>Nothing notable yet — findings appear as the log grows.</Empty>
      ) : (
        <div className="flex flex-col" style={{ gap: 'calc(var(--tad-gap) * 0.6)' }}>
          {top.map((ins, i) => {
            const meta = SEVERITY_META[ins.severity]
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="flex min-w-0 items-start gap-1.5 rounded-md px-1.5 py-1"
                style={{ backgroundColor: meta.bg }}
              >
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-bold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
                    {ins.title}
                  </span>
                  <span className="block leading-snug" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                    {ins.body}
                  </span>
                </div>
                {ins.metric && (
                  <span className="ta-num shrink-0 font-extrabold" style={{ fontSize: 'var(--tad-body)', color: meta.color }}>
                    {ins.metric}
                  </span>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── F55-F56: rolling form ────────────────────────────────────────────
function MomentumCard({ group, delay }) {
  const { trades, symbol, label } = group
  const values = useMemo(() => {
    const withPnl = [...trades].filter(hasPnl)
    let acc = 0
    return withPnl.map((t) => {
      acc += pnlOf(t)
      return acc
    })
  }, [trades])

  const last10 = useMemo(() => {
    const recent = trades.slice(-10)
    const wins = recent.filter((t) => outcomeOf(t) === 'win').length
    const losses = recent.filter((t) => outcomeOf(t) === 'loss').length
    const net = recent.filter(hasPnl).reduce((a, t) => a + pnlOf(t), 0)
    return { wins, losses, net, count: recent.length, winRate: wins + losses ? (wins / (wins + losses)) * 100 : null }
  }, [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={TrendingUp} title={`${label} momentum`} sub="last 10 trades" />
      {values.length < 2 ? (
        <Empty>Two or more P&amp;L values are needed to show momentum.</Empty>
      ) : (
        <>
          <Sparkline values={values} height={30} baseline={0} />
          <div className="mt-1 grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Recent W/L" value={`${last10.wins}/${last10.losses}`} />
            <Metric label="Recent rate" value={fmtPct(last10.winRate, 0)} color={last10.winRate != null && last10.winRate >= 50 ? POS : NEG} />
            <Metric label="Recent P&L" raw={last10.net} format={(v) => fmtMoney(v, symbol, { signed: true, compact: true })} color={signColor(last10.net)} />
          </div>
        </>
      )}
    </Card>
  )
}

export default function OverviewSection({ onNavigate }) {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <HeadlineStrip trades={trades} />

      <SectionTitle icon={Wallet} title="Equity & result" sub="split by settlement currency" />
      <Grid cols={groups.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}>
        {groups.map((g, i) => (
          <EquityCard key={g.id} group={g} delay={i * 0.04} />
        ))}
      </Grid>

      <SectionTitle icon={Scale} title="Shape of the record" />
      <Grid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <OutcomeMix trades={trades} delay={0.02} />
        <SpotlightCard trades={trades} delay={0.05} />
        <DayPatternCard trades={trades} delay={0.08} />
        {groups.map((g, i) => (
          <MomentumCard key={g.id} group={g} delay={0.11 + i * 0.03} />
        ))}
      </Grid>

      <SectionTitle icon={AlertTriangle} title="Findings" />
      <Grid cols="grid-cols-1">
        <InsightsPreview trades={trades} delay={0.02} onSeeAll={() => onNavigate?.('insights')} />
      </Grid>
    </div>
  )
}
