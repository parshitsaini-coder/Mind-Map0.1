import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Percent, Scale, CalendarCheck2 } from 'lucide-react'
import { computeStrategyAnalysis } from '../../utils/strategyTesterAnalytics'
import { RRR_OPTIONS } from '../../utils/strategyTesterFields'

const GREEN = '#16a34a'
const RED = '#dc2626'

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col gap-1 rounded-lg border p-2.5"
      style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={12} color={color || 'var(--color-slate)'} />
        <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-slate)' }}>
          {label}
        </span>
      </div>
      <span className="text-base font-semibold" style={{ color: color || 'var(--color-ink)' }}>
        {value}
      </span>
    </motion.div>
  )
}

export default function StrategyAnalysisView({ month }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="flex flex-col gap-4">
        {month.strategies.map((strategy, i) => {
          const stats = computeStrategyAnalysis(month, strategy.id)
          const hasData = stats.loggedDays > 0
          return (
            <motion.div
              key={strategy.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className="rounded-xl border p-3"
              style={{ borderColor: 'var(--color-sage)', backgroundColor: 'rgba(255,255,255,0.35)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold" style={{ color: 'var(--color-ink)' }}>
                  {strategy.name}
                </h3>
                <span className="text-[9px]" style={{ color: 'var(--color-slate)' }}>
                  {stats.loggedDays}/{stats.totalDays} days logged
                </span>
              </div>

              {!hasData ? (
                <p className="text-[10px] italic" style={{ color: 'var(--color-slate)' }}>
                  No data logged yet for this strategy this month — add fields on the grid to start tracking.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatCard
                      icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown}
                      label="Total P&L"
                      value={stats.totalPnl != null ? stats.totalPnl.toLocaleString() : '—'}
                      color={stats.totalPnl == null ? undefined : stats.totalPnl >= 0 ? GREEN : RED}
                      delay={0.05}
                    />
                    <StatCard
                      icon={Percent}
                      label="Win Rate"
                      value={stats.winRate != null ? `${stats.winRate}%` : '—'}
                      color={stats.winRate == null ? undefined : stats.winRate >= 50 ? GREEN : RED}
                      delay={0.1}
                    />
                    <StatCard icon={Scale} label="Avg RRR" value={stats.avgRrr != null ? `1:${stats.avgRrr}` : '—'} delay={0.15} />
                    <StatCard
                      icon={CalendarCheck2}
                      label="Trades Logged"
                      value={stats.pnlCount}
                      delay={0.2}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {RRR_OPTIONS.filter((o) => stats.rrrCounts[o] > 0).map((o) => (
                      <span
                        key={o}
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ backgroundColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
                      >
                        {o} × {stats.rrrCounts[o]}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex gap-3 text-[9px]" style={{ color: 'var(--color-slate)' }}>
                    {stats.bestDay && (
                      <span>
                        Best day: <span style={{ color: GREEN, fontWeight: 600 }}>Day {stats.bestDay.day} ({stats.bestDay.value})</span>
                      </span>
                    )}
                    {stats.worstDay && (
                      <span>
                        Worst day: <span style={{ color: RED, fontWeight: 600 }}>Day {stats.worstDay.day} ({stats.worstDay.value})</span>
                      </span>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
