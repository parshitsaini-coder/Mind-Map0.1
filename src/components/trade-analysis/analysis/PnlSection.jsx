import { motion } from 'framer-motion'
import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { getPnlStats, getPnlTrend } from '../../../utils/tradeAnalytics'
import { splitTradesByCurrency, CURRENCY_GROUP_LABEL } from '../../../utils/currency'
import { Card, Grid, CardTitle, EmptyHint, Stat, CountUp } from './primitives'

// Currency-aware signed money formatter — every value passed in here
// already belongs to a single currency group (Equity ₹ trades never
// mixed with Forex/Commodity $ trades), so the symbol is always correct
// and the sign always sits before it, e.g. "+₹1,200", "-$450".
function formatSigned(v, symbol) {
  const n = Math.round(v)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(n).toLocaleString('en-IN')}`
}

// One currency group's "P&L Overview" card — Total / Avg / Best / Worst
// plus the winning/losing/break-even counts, all computed only from that
// group's trades.
function PnlOverviewCard({ label, symbol, trades, delay }) {
  const stats = getPnlStats(trades)
  const hasAnyPnl = stats.tradesWithPnl > 0
  const money = (v) => formatSigned(v, symbol)

  return (
    <Card delay={delay}>
      <CardTitle
        icon={Wallet}
        title={`${label} P&L (${symbol})`}
        subtitle={hasAnyPnl ? `${stats.tradesWithPnl} trade${stats.tradesWithPnl === 1 ? '' : 's'} logged` : undefined}
      />
      {trades.length === 0 ? (
        <EmptyHint>No {label.toLowerCase()} trades logged yet.</EmptyHint>
      ) : !hasAnyPnl ? (
        <EmptyHint>Log a P&amp;L value on a {label.toLowerCase()} trade to see totals here.</EmptyHint>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total P&L" value={stats.totalPnl} formatter={money} accent />
          <Stat
            label="Avg / Trade"
            value={stats.avgPnl == null ? '—' : stats.avgPnl}
            formatter={stats.avgPnl == null ? undefined : money}
          />
          <Stat
            label="Best Trade"
            value={stats.bestTrade ? stats.bestTrade.pnl : '—'}
            formatter={stats.bestTrade ? money : undefined}
            sub={stats.bestTrade ? (stats.bestTrade.instrumentName || stats.bestTrade.pair) : undefined}
          />
          <Stat
            label="Worst Trade"
            value={stats.worstTrade ? stats.worstTrade.pnl : '—'}
            formatter={stats.worstTrade ? money : undefined}
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
  )
}

// One currency group's month-wise P&L bar chart.
function PnlTrendCard({ label, symbol, trades, delay }) {
  const trend = getPnlTrend(trades)
  const trendMaxAbs = Math.max(1, ...trend.map((m) => Math.abs(m.pnl)))
  const hasAnyPnl = getPnlStats(trades).tradesWithPnl > 0

  return (
    <Card delay={delay}>
      <CardTitle icon={BarChart3} title={`${label} P&L Trend (${symbol})`} subtitle="month-wise" />
      {trades.length === 0 ? (
        <EmptyHint>No {label.toLowerCase()} trades logged yet.</EmptyHint>
      ) : !hasAnyPnl ? (
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
                  {m.pnl === 0 ? '—' : <CountUp value={m.pnl} formatter={(v) => formatSigned(v, symbol)} />}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// "Pow" pass — dedicated P&L section for the Analysis tab. Equity trades
// settle in ₹ and Forex/Commodity trades settle in $ (see
// utils/currency.js) — summing them into one "Total P&L" produces a
// number with no real meaning, so this section always keeps the two
// currency groups in their own cards: one Overview + one Trend chart per
// group, four cards total, instead of a single pair that silently mixed
// both currencies together.
export default function PnlSection({ trades }) {
  const { INR: equityTrades, USD: fxTrades } = splitTradesByCurrency(trades)

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-2">
      <PnlOverviewCard label={CURRENCY_GROUP_LABEL.INR} symbol="₹" trades={equityTrades} delay={0.05} />
      <PnlOverviewCard label={CURRENCY_GROUP_LABEL.USD} symbol="$" trades={fxTrades} delay={0.08} />
      <PnlTrendCard label={CURRENCY_GROUP_LABEL.INR} symbol="₹" trades={equityTrades} delay={0.11} />
      <PnlTrendCard label={CURRENCY_GROUP_LABEL.USD} symbol="$" trades={fxTrades} delay={0.14} />
    </Grid>
  )
}
