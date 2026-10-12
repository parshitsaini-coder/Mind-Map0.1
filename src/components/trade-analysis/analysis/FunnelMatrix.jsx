import { motion } from 'framer-motion'
import { Filter, History, Grid3x3 } from 'lucide-react'
import { getTradeFunnel, getTradeAgeList, getTfDirectionMatrix } from '../../../utils/tradeAnalytics'
import { Card, Grid, CardTitle, EmptyHint, Stat, fmtPct, CountUp, AnimatedBar } from './primitives'

export default function FunnelMatrix({ trades }) {
  const funnel = getTradeFunnel(trades)
  const ageList = getTradeAgeList(trades)
  const matrix = getTfDirectionMatrix(trades)

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-2">
      <Card delay={0.05}>
        <CardTitle icon={Filter} title="Trade Funnel" subtitle="conversion" />
        {funnel.total === 0 ? (
          <EmptyHint>Your resolution funnel appears once you log trades.</EmptyHint>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <FunnelRow label="All Trades" pct={100} count={funnel.total} width={100} />
              <FunnelRow label="Resolved" pct={funnel.resolvedPct} count={funnel.resolved} width={Math.max(20, funnel.resolvedPct)} />
              <FunnelRow label="Target Hit" pct={funnel.targetHitPct} count={funnel.targetHit} width={Math.max(20, funnel.targetHitPct)} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 border-t pt-2" style={{ borderColor: 'var(--ta-bg)' }}>
              <Stat label="Win Rate" value={fmtPct(funnel.winRatePct)} />
              <Stat label="Loss Rate" value={fmtPct(funnel.lossRatePct)} />
              <Stat label="Pending" value={funnel.pendingCount} />
            </div>
          </>
        )}
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={History} title="Trade Age" subtitle="freshness" />
        {ageList.oldestList.length === 0 ? (
          <EmptyHint>No pending trades right now.</EmptyHint>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-3 gap-1">
              <Stat label="Fresh ≤7D" value={ageList.fresh} />
              <Stat label="Avg Days" value={ageList.avgDays} />
              <Stat label="Old >30D" value={ageList.old} />
            </div>
            <ul className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--ta-bg)' }}>
              {ageList.oldestList.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-[9px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: '#b3503a' }} />
                    <span className="truncate font-medium" style={{ color: 'var(--ta-ink)' }}>{r.name}</span>
                    <span className="shrink-0 rounded px-1 text-[7.5px]" style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}>{r.timeframe}</span>
                  </span>
                  <span className="shrink-0 font-semibold" style={{ color: 'var(--ta-slate)' }}>{r.days}d</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card delay={0.11} span="lg:col-span-2">
        <CardTitle icon={Grid3x3} title="TF x Direction Matrix" subtitle="win rate grid" />
        {matrix.length === 0 ? (
          <EmptyHint>A per-timeframe Buy/Sell win-rate grid appears here.</EmptyHint>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-[9.5px]">
              <thead>
                <tr style={{ color: 'var(--ta-slate)' }}>
                  <th className="pb-1 text-left font-semibold">TF</th>
                  <th className="pb-1 text-center font-semibold">Buy</th>
                  <th className="pb-1 text-center font-semibold">Sell</th>
                  <th className="pb-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.tf} className="border-t" style={{ borderColor: 'var(--ta-bg)' }}>
                    <td className="py-1.5 font-medium" style={{ color: 'var(--ta-ink)' }}>{row.tf}</td>
                    <MatrixCell cell={row.buy} />
                    <MatrixCell cell={row.sell} />
                    <td className="py-1.5 text-right font-semibold" style={{ color: 'var(--ta-ink)' }}><CountUp value={row.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Grid>
  )
}

function FunnelRow({ label, pct, count, width }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[9px] font-medium" style={{ color: 'var(--ta-ink)' }}>{label}</span>
      <AnimatedBar pct={width} height={14} trackClassName="flex-1">
        <span className="text-[8px] font-bold text-white">
          <CountUp value={Math.round(pct)} suffix="%" />
        </span>
      </AnimatedBar>
      <span className="w-6 shrink-0 text-right text-[9px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
        <CountUp value={count} />
      </span>
    </div>
  )
}

function MatrixCell({ cell }) {
  const opacity = cell.count === 0 ? 0 : Math.max(0.12, (cell.winRatePct ?? 0) / 100)
  return (
    <td className="py-1.5 text-center">
      {cell.count === 0 ? (
        <span style={{ color: 'var(--ta-slate)' }}>—</span>
      ) : (
        <motion.span
          className="inline-block min-w-[52px] rounded-md px-1.5 py-0.5"
          style={{ backgroundColor: `color-mix(in srgb, var(--ta-accent) ${opacity * 100}%, var(--ta-surface))`, color: opacity > 0.5 ? '#fffcf2' : 'var(--ta-ink)' }}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 0.6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-semibold">{cell.winRatePct == null ? '—' : <CountUp value={Math.round(cell.winRatePct)} suffix="%" />}</span>
          <span className="ml-1 text-[8px] opacity-80">×<CountUp value={cell.count} /></span>
        </motion.span>
      )}
    </td>
  )
}
