import { Star, Award, BarChart2 } from 'lucide-react'
import { getTopScoringTrades, getBestTfWinRate, getStockWinRate } from '../../../utils/tradeAnalytics'
import { Card, Grid, SectionHeader, CardTitle, EmptyHint, fmtPct } from './primitives'

export default function Leaderboards({ trades }) {
  const topScoring = getTopScoringTrades(trades)
  const bestTf = getBestTfWinRate(trades)
  const stockWinRate = getStockWinRate(trades)

  return (
    <div>
      <SectionHeader title="Leaderboards" />
      <Grid cols="grid-cols-1 lg:grid-cols-3">
        <Card delay={0.05}>
          <CardTitle icon={Star} title="Top Scoring Trades" subtitle="highest validation %" />
          {topScoring.length === 0 ? (
            <EmptyHint>Score trades to see them here.</EmptyHint>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {topScoring.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-[9.5px]">
                  <span className="truncate font-medium" style={{ color: 'var(--ta-ink)' }}>{t.name}</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}>{fmtPct(t.pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card delay={0.08}>
          <CardTitle icon={Award} title="Best TF Win Rate" subtitle="which TF performs best" />
          {bestTf.length === 0 ? (
            <EmptyHint>Resolve a few trades to rank timeframes.</EmptyHint>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {bestTf.map((tf) => (
                <li key={tf.tf} className="flex items-center justify-between text-[9.5px]">
                  <span className="font-medium" style={{ color: 'var(--ta-ink)' }}>{tf.tf}</span>
                  <span style={{ color: 'var(--ta-slate)' }}>{tf.won}W-{tf.lost}L</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}>{fmtPct(tf.winRatePct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card delay={0.11}>
          <CardTitle icon={BarChart2} title="Stock Win Rate" subtitle="stock-wise record" />
          {stockWinRate.length === 0 ? (
            <EmptyHint>Win rate per stock/pair shows up here.</EmptyHint>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {stockWinRate.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-[9.5px]">
                  <span className="truncate font-medium" style={{ color: 'var(--ta-ink)' }}>{s.name}</span>
                  <span style={{ color: 'var(--ta-slate)' }}>{s.won}W-{s.lost}L</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}>{fmtPct(s.winRatePct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Grid>
    </div>
  )
}
