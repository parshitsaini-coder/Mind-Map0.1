import { useMemo, useState } from 'react'
import { Brain, CheckCircle2, Clock4, Flame, Gauge as GaugeIcon, MessageSquare, Ruler, Scale, Timer, Zap } from 'lucide-react'
import {
  getDisciplineImpact, getDisciplineScore, getNotesKeywords, getOvertrading, getRevengeTrading, getRuleEffectiveness, getSequenceBehavior, getSizeDrift, getThresholdCurve,
} from '../../../../../utils/tradeAnalyticsBehavior'
import { getHoldingPeriodStats } from '../../../../../utils/tradeAnalyticsTime'
import { scorePct, hasPnl, pnlOf } from '../../../../../utils/tradeAnalyticsPro'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import {
  BarRow, Card, CardHead, Empty, Grid, Metric, NeedsMore, Pill, SectionTitle, Segmented,
  StatRow, TableScroll, Verdict,
} from '../ui'
import { NEG, POS, fmtDate, fmtNum, fmtPct, signColor } from '../format'
import { Gauge, Scatter } from '../charts'
import { useScopedTrades } from '../useAnalysisData'

// Analysis → Behaviour. The trader rather than the market: what happens
// after a loss, whether the checklist earns its keep, and which habits
// show up in the numbers.

// ── F65, F66 ─────────────────────────────────────────────────────────
function TiltCard({ trades, delay }) {
  const seq = useMemo(() => getSequenceBehavior(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Brain} title="After a win vs after a loss" hint="Splits every trade by what the previous trade did" />
      {!seq.afterWin.count && !seq.afterLoss.count ? (
        <Empty>Two or more resolved trades in sequence are needed.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
            <div className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
              <span className="block font-bold uppercase" style={{ fontSize: 'var(--tad-micro)', color: POS }}>After a win</span>
              <Metric label="Win rate" value={fmtPct(seq.afterWin.winRate, 0)} sub={`${seq.afterWin.count} trades`} color={POS} big />
              <StatRow label="Avg checklist" value={fmtPct(seq.afterWin.avgScore, 0)} />
            </div>
            <div className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <span className="block font-bold uppercase" style={{ fontSize: 'var(--tad-micro)', color: NEG }}>After a loss</span>
              <Metric label="Win rate" value={fmtPct(seq.afterLoss.winRate, 0)} sub={`${seq.afterLoss.count} trades`} color={NEG} big />
              <StatRow label="Avg checklist" value={fmtPct(seq.afterLoss.avgScore, 0)} />
            </div>
          </div>
          <Verdict tone={seq.reliable && Math.abs(seq.winRateGap || 0) >= 15 ? 'warn' : 'info'}>
            {seq.verdict}
            {seq.reliable && seq.winRateGap != null && ` — a ${Math.abs(seq.winRateGap).toFixed(0)} point gap on the same setups.`}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F63 ──────────────────────────────────────────────────────────────
function RevengeCard({ trades, delay }) {
  const r = useMemo(() => getRevengeTrading(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Flame}
        title="Quick re-entries"
        badge={r.count || undefined}
        badgeColor={r.penalty != null && r.penalty < -10 ? NEG : undefined}
        hint="Trades opened the same day as, or the day after, a loss"
      />
      {!r.count ? (
        <Empty>No trades were opened within a day of a loss.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Flagged" raw={r.count} big />
            <Metric label="Their win rate" value={fmtPct(r.flaggedWinRate, 0)} color={NEG} />
            <Metric label="Everything else" value={fmtPct(r.baselineWinRate, 0)} color={POS} />
          </div>
          <div className="mt-1">
            <TableScroll maxHeight={112}>
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th className="text-right">Gap</th>
                    <th className="text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {r.flagged.map((f) => (
                    <tr key={f.id}>
                      <td className="truncate font-semibold" style={{ maxWidth: 120 }} title={`${f.name} · ${fmtDate(f.date)}`}>{f.name}</td>
                      <td className="text-right">{f.gapDays === 0 ? 'same day' : '1 day'}</td>
                      <td className="text-right">
                        <Pill color={f.outcome === 'win' ? POS : f.outcome === 'loss' ? NEG : 'var(--ta-slate)'}>
                          {f.outcome === 'win' ? 'Win' : f.outcome === 'loss' ? 'Loss' : 'Open'}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
          <Verdict tone={r.penalty != null && r.penalty < -10 ? 'bad' : 'info'}>
            {!r.reliable
              ? 'Fewer than four flagged trades — not enough to call a pattern yet.'
              : r.penalty < -10
                ? `These trades win ${Math.abs(r.penalty).toFixed(0)} points less often than the rest. Stepping away after a loss would have helped.`
                : 'Re-entering quickly has not hurt your results so far.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F64 ──────────────────────────────────────────────────────────────
function OvertradingCard({ trades, delay }) {
  const o = useMemo(() => getOvertrading(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Zap} title="Busy days" hint="Days with an unusually high trade count, measured against your own average rather than a fixed number" />
      {!o.available ? (
        <NeedsMore have={o.days || 0} need={4} what="active days" />
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Threshold" value={`${o.threshold}+`} hint="One standard deviation above your own average active day" />
            <Metric label="Busy days" raw={o.heavyDays} sub={`of ${o.totalActiveDays}`} color={o.heavyDays ? NEG : undefined} />
            <Metric label="Avg/day" value={fmtNum(o.avgPerActiveDay, 1)} />
            <Metric
              label="Busy vs normal"
              value={
                o.heavyDayAvgPnl == null || o.normalDayAvgPnl == null
                  ? '—'
                  : o.heavyDayAvgPnl < o.normalDayAvgPnl
                    ? 'Worse'
                    : 'Better'
              }
              color={o.heavyDayAvgPnl != null && o.normalDayAvgPnl != null && o.heavyDayAvgPnl < o.normalDayAvgPnl ? NEG : POS}
            />
          </div>
          {o.heavyList.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5 border-t pt-1" style={{ borderColor: 'var(--tad-border)' }}>
              {o.heavyList.map((d) => (
                <StatRow
                  key={d.key}
                  label={fmtDate(d.date)}
                  value={`${d.count} trades`}
                  color={d.pnl != null ? signColor(d.pnl) : undefined}
                />
              ))}
            </div>
          )}
          <Verdict tone={o.heavyDayAvgPnl != null && o.normalDayAvgPnl != null && o.heavyDayAvgPnl < o.normalDayAvgPnl ? 'warn' : 'good'}>
            {o.heavyDayAvgPnl == null || o.normalDayAvgPnl == null
              ? 'Log P&L on more days to compare busy days against quiet ones.'
              : o.heavyDayAvgPnl < o.normalDayAvgPnl
                ? 'Heavy days average a worse result than quiet ones — volume is not converting into edge.'
                : 'Busy days hold up as well as quiet ones.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F67, F71 ─────────────────────────────────────────────────────────
function DisciplineCard({ trades, delay }) {
  const impact = useMemo(() => getDisciplineImpact(trades), [trades])
  const score = useMemo(() => getDisciplineScore(trades), [trades])

  const points = useMemo(
    () =>
      trades
        .filter((t) => scorePct(t) !== null && hasPnl(t))
        .map((t) => ({
          id: t.id,
          x: scorePct(t),
          y: pnlOf(t),
          title: `${t.instrumentName || t.pair}: ${scorePct(t).toFixed(0)}% checklist`,
        })),
    [trades]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={CheckCircle2} title="Does the checklist work?" hint="Correlates each trade's validation score against how it actually turned out" />
      <div className="flex items-center gap-2">
        <Gauge
          pct={score.score || 0}
          size={62}
          centerTop={score.score == null ? '—' : `${score.score}`}
          centerBottom={score.grade ? `grade ${score.grade}` : 'discipline'}
        />
        <div className="min-w-0 flex-1">
          <StatRow label="Avg checklist score" value={fmtPct(score.avgScore, 0)} strong />
          <StatRow label="Trades carrying a score" value={fmtPct(score.coverage, 0)} color={score.coverage < 60 ? NEG : undefined} />
          <StatRow label="Score consistency" value={fmtPct(score.consistency, 0)} hint="How tightly your scores cluster — a steady process scores similarly each time" />
        </div>
      </div>

      {impact.available ? (
        <>
          <div className="mt-1.5 grid grid-cols-3 border-t pt-1.5" style={{ gap: 'var(--tad-gap)', borderColor: 'var(--tad-border)' }}>
            <Metric label={`≥ ${impact.cut.toFixed(0)}%`} value={fmtPct(impact.highScoreWinRate, 0)} sub={`${impact.highCount} trades`} color={POS} />
            <Metric label={`< ${impact.cut.toFixed(0)}%`} value={fmtPct(impact.lowScoreWinRate, 0)} sub={`${impact.lowCount} trades`} color={NEG} />
            <Metric
              label="Lift"
              value={impact.lift == null ? '—' : `${impact.lift > 0 ? '+' : ''}${impact.lift.toFixed(0)}pt`}
              color={impact.lift > 0 ? POS : NEG}
              big
            />
          </div>
          {points.length >= 3 && (
            <div className="mt-1.5">
              <Scatter points={points} xLabel="Checklist score →" yLabel="↑ P&L" height={92} />
            </div>
          )}
          <Verdict tone={impact.outcomeCorr > 0.25 ? 'good' : impact.outcomeCorr < -0.25 ? 'bad' : 'info'}>
            {impact.verdict}
            {impact.outcomeCorr != null && ` (correlation ${fmtNum(impact.outcomeCorr, 2)} across ${impact.sampleSize} resolved trades)`}
          </Verdict>
        </>
      ) : (
        <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--tad-border)' }}>
          <NeedsMore have={impact.sampleSize} need={5} what="scored & resolved trades" />
        </div>
      )}
    </Card>
  )
}

// ── F70 threshold optimiser ──────────────────────────────────────────
function ThresholdCard({ trades, delay }) {
  const t = useMemo(() => getThresholdCurve(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Scale} title="Best checklist cut-off" hint="Win rate at every possible minimum score, with the number of trades each cut-off would leave" />
      {!t.available ? (
        <NeedsMore have={t.sampleSize} need={6} what="scored & resolved trades" />
      ) : (
        <>
          <TableScroll maxHeight={168}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Min score</th>
                  <th className="text-right">Kept</th>
                  <th className="text-right">Win %</th>
                  <th>Shape</th>
                </tr>
              </thead>
              <tbody>
                {t.curve.filter((c) => c.kept > 0).map((c) => (
                  <tr key={c.cut} style={t.best && c.cut === t.best.cut ? { backgroundColor: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}>
                    <td className="font-semibold">{c.cut}%+</td>
                    <td className="text-right">{c.kept}</td>
                    <td className="text-right font-semibold" style={{ color: c.winRate >= 50 ? POS : NEG }}>{fmtPct(c.winRate, 0)}</td>
                    <td style={{ width: 80 }}>
                      <BarRow pct={c.winRate} color={c.winRate >= 50 ? POS : NEG} labelWidth={0} valueWidth={0} value={null} label={null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <Verdict tone={t.gain > 5 ? 'good' : 'info'}>
            {t.best
              ? `Taking only ${t.best.cut}%+ setups keeps ${t.best.kept} of ${t.sampleSize} trades and moves win rate from ${fmtPct(t.baseline.winRate, 0)} to ${fmtPct(t.best.winRate, 0)}. Cut-offs that leave under a third of your trades are excluded — a perfect record on two trades is not a strategy.`
              : 'No cut-off improves things while keeping enough trades to matter.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F68, F69 per-rule effectiveness ──────────────────────────────────
function RuleEffectivenessCard({ trades, delay }) {
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const [filter, setFilter] = useState('reliable')

  const data = useMemo(() => getRuleEffectiveness(trades, rules, categories), [trades, rules, categories])
  const rows = useMemo(() => {
    if (filter === 'reliable') return data.rows.filter((r) => r.reliable)
    if (filter === 'unused') return data.rows.filter((r) => r.usedCount === 0)
    return data.rows
  }, [data, filter])

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={Ruler}
        title="Rule effectiveness"
        sub={`${data.resolvedCount} resolved trades`}
        hint="Win rate on trades where each rule was ticked, against trades where it wasn't. The difference is the rule's lift."
        right={
          <Segmented
            size="xs"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'reliable', label: `Reliable ${data.reliableCount}` },
              { id: 'all', label: `All ${data.rows.length}` },
              { id: 'unused', label: `Unused ${data.rows.filter((r) => r.usedCount === 0).length}` },
            ]}
            layoutId="rule-filter"
          />
        }
      />
      {!rows.length ? (
        <Empty>
          {filter === 'reliable'
            ? 'No rule yet has five or more trades both with and without it ticked — that is the floor for a trustworthy comparison.'
            : filter === 'unused'
              ? 'Every rule has been used at least once.'
              : 'No validation rules defined yet.'}
        </Empty>
      ) : (
        <TableScroll maxHeight={280}>
          <table className="ta-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Category</th>
                <th className="text-right">Used</th>
                <th className="text-right">With</th>
                <th className="text-right">Without</th>
                <th className="text-right">Lift</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="truncate font-semibold" style={{ maxWidth: 190 }} title={r.label}>
                    {r.label}
                    {!r.reliable && r.usedCount > 0 && (
                      <span style={{ color: 'var(--ta-slate)', fontSize: 'var(--tad-micro)' }}> · thin</span>
                    )}
                  </td>
                  <td className="truncate" style={{ maxWidth: 90, color: 'var(--ta-slate)' }}>{r.category}</td>
                  <td className="text-right">{r.usedCount}</td>
                  <td className="text-right">{fmtPct(r.winRateWith, 0)}</td>
                  <td className="text-right">{fmtPct(r.winRateWithout, 0)}</td>
                  <td className="text-right font-bold" style={{ color: r.lift == null ? 'var(--ta-slate)' : r.lift > 0 ? POS : NEG }}>
                    {r.lift == null ? '—' : `${r.lift > 0 ? '+' : ''}${r.lift.toFixed(0)}pt`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {data.unused.length > 0 && filter !== 'unused' && (
        <Verdict tone="warn">
          {data.unused.length} active rule{data.unused.length > 1 ? 's have' : ' has'} never been ticked — they lengthen the
          checklist without adding signal.
        </Verdict>
      )}
    </Card>
  )
}

// ── F62 holding behaviour ────────────────────────────────────────────
function HoldingCard({ trades, delay }) {
  const h = useMemo(() => getHoldingPeriodStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Timer} title="How long you hold" hint="Measured from when a trade was logged to when its status was last changed" />
      {!h.available ? (
        <Empty>Resolve some trades in the app so the time between entry and outcome is recorded.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Average" value={`${fmtNum(h.avgDays, 1)}d`} big />
            <Metric label="Winners" value={h.avgWinDays == null ? '—' : `${fmtNum(h.avgWinDays, 1)}d`} color={POS} />
            <Metric label="Losers" value={h.avgLossDays == null ? '—' : `${fmtNum(h.avgLossDays, 1)}d`} color={NEG} />
            <Metric label="Longest" value={`${fmtNum(h.longest, 1)}d`} />
          </div>
          <Verdict tone={h.holdsLosersLonger ? 'warn' : 'good'}>
            {h.holdsLosersLonger == null
              ? 'Needs both wins and losses with recorded outcomes.'
              : h.holdsLosersLonger
                ? 'Losers are held longer than winners — the textbook disposition effect: hope on the losers, impatience on the winners.'
                : 'Winners are held at least as long as losers, which is the right way round.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F72 size drift ───────────────────────────────────────────────────
function SizeDriftCard({ trades, delay }) {
  const d = useMemo(() => getSizeDrift(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={GaugeIcon} title="Size drift" hint="Whether position price creeps up after wins or after losses, normalised per instrument" />
      {!d.available ? (
        <NeedsMore have={d.sampleSize || 0} need={6} what="trades with a price" />
      ) : (
        <>
          <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="After a win" value={`${fmtNum(d.relAfterWin, 2)}×`} sub={`${d.afterWinCount} trades`} color={POS} />
            <Metric label="After a loss" value={`${fmtNum(d.relAfterLoss, 2)}×`} sub={`${d.afterLossCount} trades`} color={NEG} />
            <Metric label="Overall spread" value={fmtNum(d.overallSpread, 2)} hint="Standard deviation of normalised position size" />
          </div>
          <Verdict tone={Math.abs((d.relAfterLoss || 1) - (d.relAfterWin || 1)) > 0.08 ? 'warn' : 'good'}>
            {Math.abs((d.relAfterLoss || 1) - (d.relAfterWin || 1)) > 0.08
              ? 'Position size shifts noticeably depending on the previous result — a sign the plan is being adjusted emotionally rather than systematically.'
              : 'Position size stays steady regardless of the last result.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── Notes keyword analysis ───────────────────────────────────────────
function NotesCard({ trades, delay }) {
  const k = useMemo(() => getNotesKeywords(trades), [trades])
  const maxCount = Math.max(...k.rows.map((r) => r.total), 1)

  return (
    <Card delay={delay}>
      <CardHead icon={MessageSquare} title="Your own words" sub={`${k.notesCount} notes`} hint="Words appearing in two or more notes, with the win rate of the trades that mention them" />
      {!k.rows.length ? (
        <Empty>Write notes on a few trades and recurring words will be ranked here by outcome.</Empty>
      ) : (
        <TableScroll maxHeight={200}>
          <table className="ta-table">
            <thead>
              <tr>
                <th>Word</th>
                <th className="text-right">Notes</th>
                <th className="text-right">Win %</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {k.rows.map((r) => (
                <tr key={r.word}>
                  <td className="font-semibold">{r.word}</td>
                  <td className="text-right">{r.total}</td>
                  <td className="text-right font-semibold" style={{ color: r.winRate == null ? 'var(--ta-slate)' : r.winRate >= 50 ? POS : NEG }}>
                    {fmtPct(r.winRate, 0)}
                  </td>
                  <td style={{ width: 70 }}>
                    <BarRow pct={(r.total / maxCount) * 100} color="var(--ta-accent)" labelWidth={0} valueWidth={0} value={null} label={null} />
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

export default function BehaviorSection() {
  const { trades } = useScopedTrades()

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <SectionTitle icon={Brain} title="Emotional carry-over" sub="what the last trade does to the next one" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <TiltCard trades={trades} delay={0.02} />
        <RevengeCard trades={trades} delay={0.05} />
        <OvertradingCard trades={trades} delay={0.08} />
        <SizeDriftCard trades={trades} delay={0.11} />
      </Grid>

      <SectionTitle icon={CheckCircle2} title="Process & discipline" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <DisciplineCard trades={trades} delay={0.02} />
        <ThresholdCard trades={trades} delay={0.05} />
      </Grid>
      <Grid cols="grid-cols-1">
        <RuleEffectivenessCard trades={trades} delay={0.02} />
      </Grid>

      <SectionTitle icon={Clock4} title="Habits" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <HoldingCard trades={trades} delay={0.02} />
        <NotesCard trades={trades} delay={0.05} />
      </Grid>
    </div>
  )
}
