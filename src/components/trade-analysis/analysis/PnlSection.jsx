import { motion } from 'framer-motion'
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { getPnlStats, getPnlTrend } from '../../../utils/tradeAnalytics'
import { Card, Grid, CardTitle, EmptyHint, Stat, CountUp } from './primitives'

const fmtMoney = (v) => `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-IN')}`

// "Pow" pass — dedicated P&L section for the Analysis tab: a KPI row
// (Total P&L / Avg per trade / Best trade / Worst trade) plus a
// month-wise P&L bar chart, same plain-div bar convention as
// TrendSection.jsx (no chart library, just widths + framer-motion).
export default function PnlSection({ trades }) {
  const stats = getPnlStats(trades)
  const trend = getPnlTrend(trades)
  const trendMaxAbs = Math.max(1, ...trend.map((m) => Math.abs(m.pnl)))
  const hasAnyPnl = stats.tradesWithPnl > 0

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-2">
      <Card delay={0.05}>
        <CardTitle icon={Wallet} title="P&L Overview" subtitle={hasAnyPnl ? `${stats.tradesWithPnl} trade${stats.tradesWithPnl === 1 ? '' : 's'} logged` : undefined} />
        {!hasAnyPnl ? (
          <EmptyHint>Log a P&amp;L value on any trade (Table tab, or the form) to see totals here.</EmptyHint>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Total P&L"
              value={stats.totalPnl}
              formatter={fmtMoney}
              accent
            />
            <Stat
              label="Avg / Trade"
              value={stats.avgPnl == null ? '—' : stats.avgPnl}
              formatter={stats.avgPnl == null ? undefined : fmtMoney}
            />
            <Stat
              label="Best Trade"
              value={stats.bestTrade ? stats.bestTrade.pnl : '—'}
              formatter={stats.bestTrade ? fmtMoney : undefined}
              sub={stats.bestTrade ? (stats.bestTrade.instrumentName || stats.bestTrade.pair) : undefined}
            />
            <Stat
              label="Worst Trade"
              value={stats.worstTrade ? stats.worstTrade.pnl : '—'}
              formatter={stats.worstTrade ? fmtMoney : undefined}
              sub={stats.worstTrade ? (stats.worstTrade.instrumentName || stats.worstTrade.pair) : undefined}
            />
          </div>
        )}
        {hasAnyPnl && (
          <div className="mt-2.5 flex items-center gap-3 border-t pt-2" style={{ borderColor: 'var(--ta-slate)', opacity: 0.9 }}>
            <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: '#16a34a' }}>
              <TrendingUp size={11} /> <CountUp value={stats.winningTrades} /> winning
            </span>
            <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color: '#dc2626' }}>
              <TrendingDown size={11} /> <CountUp value={stats.losingTrades} /> losing
            </span>
            {stats.breakEvenTrades > 0 && (
              <span className="text-[9px] font-semibold" style={{ color: 'var(--ta-slate)' }}>
                <CountUp value={stats.breakEvenTrades} /> break-even
              </span>
            )}
          </div>
        )}
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={BarChart3} title="P&L Trend" subtitle="month-wise" />
        {!hasAnyPnl ? (
          <EmptyHint>A month-by-month P&amp;L bar chart appears here once you log some values.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            {trend.map((m) => {
              const pct = (Math.abs(m.pnl) / trendMaxAbs) * 100
              const positive = m.pnl > 0
              const negative = m.pnl < 0
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-[8.5px] font-medium" style={{ color: 'var(--ta-slate)' }}>{m.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: false, amount: 0.5 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: positive ? '#16a34a' : negative ? '#dc2626' : 'var(--ta-slate)' }}
                    />
                  </div>
                  <span
                    className="w-16 shrink-0 text-right text-[8.5px] font-semibold"
                    style={{ color: positive ? '#16a34a' : negative ? '#dc2626' : 'var(--ta-slate)' }}
                  >
                    {m.pnl === 0 ? '—' : <CountUp value={m.pnl} formatter={fmtMoney} />}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </Grid>
  )
}
