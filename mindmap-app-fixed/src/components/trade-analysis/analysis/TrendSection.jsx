import { BarChart3, Layers } from 'lucide-react'
import { getDirectionTrend, getTimeframeBreakdown } from '../../../utils/tradeAnalytics'
import { Card, Grid, CardTitle, EmptyHint, DIRECTION_COLOR } from './primitives'

export default function TrendSection({ trades }) {
  const trend = getDirectionTrend(trades)
  const trendMax = Math.max(1, ...trend.map((m) => Math.max(m.buy, m.sell)))
  const tfBreakdown = getTimeframeBreakdown(trades)

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-2">
      <Card delay={0.05}>
        <CardTitle icon={BarChart3} title="Buy vs Sell Trend" subtitle="month-wise comparison" />
        {trades.length === 0 ? (
          <EmptyHint>Month-over-month Buy vs Sell split appears here.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            {trend.map((m) => (
              <div key={m.key} className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[8.5px] font-medium" style={{ color: 'var(--ta-slate)' }}>{m.label}</span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(m.buy / trendMax) * 100}%`, backgroundColor: DIRECTION_COLOR.Buy }} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(m.sell / trendMax) * 100}%`, backgroundColor: DIRECTION_COLOR.Sell }} />
                  </div>
                </div>
                <span className="w-14 shrink-0 text-right text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>
                  {m.buy}B / {m.sell}S
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={Layers} title="Timeframe Breakdown" subtitle="all timeframes used" />
        {tfBreakdown.length === 0 ? (
          <EmptyHint>Every timeframe you've used will show as a chip here.</EmptyHint>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tfBreakdown.map((tf) => (
              <span
                key={tf.name}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-semibold"
                style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
              >
                {tf.name}
                <span
                  className="flex h-3.5 min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
                  style={{ backgroundColor: 'var(--ta-accent)' }}
                >
                  {tf.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </Card>
    </Grid>
  )
}
