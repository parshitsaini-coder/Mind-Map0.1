import { motion } from 'framer-motion'
import { Zap, HeartPulse, Flame } from 'lucide-react'
import { getMarketBias, getHealthScore, getStreak } from '../../../utils/tradeAnalytics'
import { Card, Grid, SectionHeader, CardTitle, EmptyHint, SemiGauge, RingGauge, HBar, fmtPct, CountUp } from './primitives'

export default function ProAnalytics({ trades }) {
  const bias = getMarketBias(trades)
  const health = getHealthScore(trades)
  const streak = getStreak(trades)

  return (
    <div>
      <SectionHeader icon={Zap} title="Pro Analytics" badge="v1" />
      <Grid cols="grid-cols-1 lg:grid-cols-3">
        <Card delay={0.05}>
          <CardTitle title="Market Bias" subtitle="Buy vs Sell" />
          {bias.total === 0 ? (
            <EmptyHint>Log Buy/Sell trades to see market bias.</EmptyHint>
          ) : (
            <>
              <SemiGauge pct={bias.biasPct} leftLabel="Sell" rightLabel="Buy" />
              <div className="mt-1 flex justify-center gap-6 text-center">
                <div>
                  <div className="text-[13px] font-extrabold" style={{ color: '#16a34a' }}><CountUp value={bias.buy} /></div>
                  <div className="text-[7.5px] font-semibold uppercase" style={{ color: 'var(--ta-slate)' }}>Buy</div>
                </div>
                <div>
                  <div className="text-[13px] font-extrabold" style={{ color: '#dc2626' }}><CountUp value={bias.sell} /></div>
                  <div className="text-[7.5px] font-semibold uppercase" style={{ color: 'var(--ta-slate)' }}>Sell</div>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card delay={0.08}>
          <CardTitle icon={HeartPulse} title="Health" />
          {trades.length === 0 ? (
            <EmptyHint>A composite health score builds up as you log trades.</EmptyHint>
          ) : (
            <div className="flex items-center gap-3">
              <RingGauge pct={health.score} centerTop={health.score} centerBottom={`/100 · ${health.grade}`} />
              <div className="flex flex-1 flex-col gap-1.5">
                <HBar label="Win Rate" pct={health.winRatePct ?? 0} value={fmtPct(health.winRatePct)} />
                <HBar label="Avg Score" pct={health.avgScorePct} value={fmtPct(health.avgScorePct)} />
                <HBar label="Diversity" pct={health.diversityPct} value={fmtPct(health.diversityPct)} />
              </div>
            </div>
          )}
        </Card>

        <Card delay={0.11}>
          <CardTitle icon={Flame} title="Streak" />
          {!streak.hasResolved ? (
            <EmptyHint>No resolved trades yet.</EmptyHint>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <motion.div
                initial={{ scale: 0.7, rotate: -8 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: false, amount: 0.6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              >
                <Flame size={22} style={{ color: streak.streak > 0 ? 'var(--ta-accent)' : 'var(--ta-slate)' }} />
              </motion.div>
              <div>
                <div className="text-[18px] font-extrabold leading-none" style={{ color: 'var(--ta-ink)' }}><CountUp value={streak.streak} /></div>
                <div className="text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>consecutive Target Hits</div>
              </div>
            </div>
          )}
        </Card>
      </Grid>
    </div>
  )
}
