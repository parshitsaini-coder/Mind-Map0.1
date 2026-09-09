import { TrendingUp, Clock3, ShieldCheck } from 'lucide-react'
import { getWinRateByDirection, getWinRateByTimeframe, getSetupStrength } from '../../../utils/tradeAnalytics'
import { Card, Grid, HBar, CardTitle, EmptyHint, fmtPct, DIRECTION_COLOR } from './primitives'

export default function WinRateSection({ trades }) {
  const byDirection = getWinRateByDirection(trades)
  const byTf = getWinRateByTimeframe(trades)
  const strength = getSetupStrength(trades)
  const strengthMax = strength[0]?.avgScorePct || 100

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-3">
      <Card delay={0.05} span="lg:col-span-1">
        <CardTitle icon={TrendingUp} title="Win Rate: Buy vs Sell" subtitle="by direction" />
        <div className="grid grid-cols-2 gap-2">
          {['Buy', 'Sell'].map((dir) => {
            const d = byDirection[dir]
            return (
              <div key={dir} className="rounded-xl border px-2 py-2 text-center" style={{ borderColor: 'var(--ta-bg)' }}>
                <div className="mb-1 flex items-center justify-center gap-1 text-[9px] font-bold uppercase" style={{ color: DIRECTION_COLOR[dir] }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DIRECTION_COLOR[dir] }} />
                  {dir}
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: 'var(--ta-ink)' }}>{fmtPct(d.winRatePct)}</div>
                <div className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>{d.won}W / {d.lost}L</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={Clock3} title="Win Rate by Timeframe" subtitle="which TF works best" />
        {byTf.length === 0 ? (
          <EmptyHint>Resolve a few trades to see win rate by timeframe.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-1.5">
            {byTf.slice(0, 6).map((row) => (
              <div key={row.tf} className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[9px] font-medium" style={{ color: 'var(--ta-ink)' }}>{row.tf}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${row.winRatePct ?? 0}%`, backgroundColor: 'var(--ta-accent)' }} />
                </div>
                <span className="w-16 shrink-0 text-right text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>
                  {row.won}W-{row.lost}L
                </span>
                <span className="w-9 shrink-0 text-right text-[9.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                  {fmtPct(row.winRatePct)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card delay={0.11}>
        <CardTitle icon={ShieldCheck} title="Setup Strength" subtitle="avg validation score" />
        {strength.length === 0 ? (
          <EmptyHint>Score trades against your validation rules to rank setups here.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-1.5">
            {strength.map((s) => (
              <HBar key={s.name} label={s.name} pct={(s.avgScorePct / strengthMax) * 100} value={`${Math.round(s.avgScorePct)}%`} />
            ))}
          </div>
        )}
      </Card>
    </Grid>
  )
}
