import { ListOrdered, Clock } from 'lucide-react'
import { getKpis, getTopStocks, getTimeframeUsage } from '../../../utils/tradeAnalytics'
import { Card, Grid, HBar, CardTitle, EmptyHint, fmtPct, STATUS_COLOR, CountUp } from './primitives'

// Step 3 — KPI strip (Total / Pending / Target Hit / SL Hit / Win Rate)
// plus the Top Stocks and Timeframe Usage bar-list cards underneath.
export default function KpiStrip({ trades }) {
  const kpis = getKpis(trades)
  const topStocks = getTopStocks(trades)
  const tfUsage = getTimeframeUsage(trades)
  const topStockMax = topStocks[0]?.count || 1
  const tfMax = tfUsage[0]?.count || 1

  const kpiCards = [
    { label: 'Total Trades', value: kpis.total },
    { label: 'Pending', value: kpis.pending, underline: STATUS_COLOR.Pending.solid },
    { label: 'Target Hit', value: kpis.targetHit, underline: STATUS_COLOR['Target Hit'].solid },
    { label: 'SL Hit', value: kpis.slHit, underline: STATUS_COLOR['SL Hit'].solid },
    { label: 'Win Rate', value: fmtPct(kpis.winRatePct), accent: true },
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpiCards.map((c, i) => (
          <Card key={c.label} delay={i * 0.03} className={c.accent ? 'ta-card-glow' : ''}>
            <div
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center"
              style={c.accent ? { background: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                {c.label}
              </span>
              <span className="text-[18px] font-extrabold leading-none" style={{ color: c.accent ? 'var(--ta-accent)' : 'var(--ta-ink)' }}>
                <CountUp value={c.value} />
              </span>
              {c.underline && (
                <span className="mt-0.5 h-[2.5px] w-8 rounded-full" style={{ backgroundColor: c.underline, opacity: 0.7 }} />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Grid cols="grid-cols-1 sm:grid-cols-2">
        <Card delay={0.12}>
          <CardTitle icon={ListOrdered} title="Top Stocks" subtitle="by frequency" />
          {topStocks.length === 0 ? (
            <EmptyHint>Log a trade to see your most-used stocks.</EmptyHint>
          ) : (
            <div className="flex flex-col gap-1.5">
              {topStocks.map((s) => (
                <HBar key={s.name} label={s.name} pct={(s.count / topStockMax) * 100} value={s.count} />
              ))}
            </div>
          )}
        </Card>

        <Card delay={0.15}>
          <CardTitle icon={Clock} title="Timeframe Usage" subtitle="distribution" />
          {tfUsage.length === 0 ? (
            <EmptyHint>Timeframe usage shows up once you log a trade.</EmptyHint>
          ) : (
            <div className="flex flex-col gap-1.5">
              {tfUsage.map((s) => (
                <HBar key={s.name} label={s.name} pct={(s.count / tfMax) * 100} value={s.count} />
              ))}
            </div>
          )}
        </Card>
      </Grid>
    </>
  )
}
