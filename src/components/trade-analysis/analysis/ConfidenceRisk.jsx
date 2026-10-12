import { Gauge, Scale } from 'lucide-react'
import { getConfidence, getRiskReward } from '../../../utils/tradeAnalytics'
import { Card, Grid, CardTitle, EmptyHint, Stat, fmtPct, CountUp, AnimatedBar } from './primitives'

export default function ConfidenceRisk({ trades }) {
  const c = getConfidence(trades)
  const rr = getRiskReward(trades)

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-2">
      <Card delay={0.05}>
        <CardTitle icon={Gauge} title="Confidence" subtitle="prediction strength" />
        {trades.length === 0 ? (
          <EmptyHint>Confidence builds up as trades resolve.</EmptyHint>
        ) : (
          <>
            <div className="mb-2">
              <AnimatedBar
                pct={c.strengthPct ?? 100}
                height={12}
                color={c.strengthPct == null ? 'var(--ta-slate)' : 'var(--ta-accent)'}
              >
                {c.strengthPct == null && <span className="text-[7px] font-bold text-white">—</span>}
              </AnimatedBar>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <Stat label="Win Rate" value={fmtPct(c.winRatePct)} />
              <Stat label="Avg Score" value={fmtPct(c.avgScorePct)} />
              <Stat label="Resolved" value={c.resolvedCount} />
              <Stat label="Total" value={c.totalCount} />
            </div>
          </>
        )}
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={Scale} title="Risk/Reward" subtitle="trade outcome mix" />
        {trades.length === 0 ? (
          <EmptyHint>Outcome mix and R:R will show here.</EmptyHint>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[15px] font-extrabold" style={{ color: 'var(--ta-ink)' }}><CountUp value={rr.avgRR ?? '—'} decimals={rr.avgRR != null && !Number.isInteger(rr.avgRR) ? 2 : 0} /></div>
              <div className="text-[7.5px] font-semibold uppercase" style={{ color: 'var(--ta-slate)' }}>Avg R:R Ratio</div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <RRBar label="Wins" pct={rr.winsPct} color="#5f8a52" />
              <RRBar label="Losses" pct={rr.lossesPct} color="#b3503a" />
              <RRBar label="Pending" pct={rr.pendingPct} color="var(--ta-accent)" />
            </div>
          </div>
        )}
      </Card>
    </Grid>
  )
}

function RRBar({ label, pct, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[9px] font-medium" style={{ color: 'var(--ta-ink)' }}>{label}</span>
      <AnimatedBar pct={pct} color={color} height={6} trackClassName="flex-1" />
      <span className="w-9 shrink-0 text-right text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>
        <CountUp value={Math.round(pct)} suffix="%" />
      </span>
    </div>
  )
}
