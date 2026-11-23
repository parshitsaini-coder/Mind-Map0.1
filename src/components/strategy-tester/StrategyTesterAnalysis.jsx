import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck, Target, Scale, IndianRupee, ArrowLeftRight, Sparkles } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { RRR_OPTIONS, MONTH_NAMES } from '../../utils/strategyTesterFields'
import { computeStats } from '../../utils/strategyStats'
import { Card, Grid, Stat, HBar, SectionHeader, EmptyHint, fmtPct } from '../trade-analysis/analysis/primitives'
import StrategyCalendar from './StrategyCalendar'
import StrategyCompare from './StrategyCompare'

export default function StrategyTesterAnalysis() {
  const strategies = useStrategyTesterStore((s) => s.strategies)
  const entries = useStrategyTesterStore((s) => s.entries)
  const year = useStrategyTesterStore((s) => s.year)
  const month = useStrategyTesterStore((s) => s.month)
  const analysisStrategyId = useStrategyTesterStore((s) => s.analysisStrategyId)

  // Hidden strategies are hidden everywhere in Analysis too — they never
  // show up in the picker, and a strategy hidden while it was the active
  // one falls back to the first still-visible strategy instead of
  // rendering stale data for something the person just tucked away.
  const visibleStrategies = strategies.filter((st) => !st.hidden)

  const activeId =
    analysisStrategyId && visibleStrategies.some((s) => s.id === analysisStrategyId)
      ? analysisStrategyId
      : visibleStrategies[0]?.id
  const strategy = visibleStrategies.find((s) => s.id === activeId)

  const stats = useMemo(() => {
    if (!strategy) return null
    return computeStats(strategy, entries?.[strategy.id], year, month)
  }, [strategy, entries, year, month])

  if (!strategy || !stats) {
    return (
      <EmptyHint>
        {strategies.length === 0 ? 'Add a strategy first.' : 'All strategies are hidden — unhide one in Table view to see its analysis.'}
      </EmptyHint>
    )
  }

  const hasAnyMetric = stats.hasOutcome || stats.hasPnl || stats.hasRrr || stats.hasBuysell

  return (
    <div className="h-full overflow-y-auto ta-scroll px-1 pb-6">
      {/* Strategy picker — same segmented-pill idea as Trade Analysis's
          ViewSwitch, just driven by the strategy list instead of a fixed
          pair of tabs. */}
      <div className="mb-3 flex flex-wrap items-center gap-1 pt-1">
        {visibleStrategies.map((st) => {
          const active = st.id === activeId
          return (
            <motion.button
              key={st.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
              onClick={() => useStrategyTesterStore.getState().setAnalysisStrategyId(st.id)}
              className="relative rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ backgroundColor: active ? 'transparent' : 'var(--ta-bg)', color: active ? '#fffcf2' : 'var(--ta-ink)', transition: 'color 0.18s ease' }}
            >
              {active && (
                <motion.span
                  layoutId="st-analysis-strategy-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'var(--ta-accent)' }}
                />
              )}
              <span className="relative">{st.name}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Content re-fades when the active strategy changes (opacity only — the
          cards below already run their own scroll-in reveals). */}
      <motion.div
        key={activeId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
      <SectionHeader
        icon={CalendarCheck}
        title="Monthly progress"
        subtitle={`${MONTH_NAMES[month]} ${year} · ${stats.filledDays}/${stats.numDays} days logged`}
      />
      <Card>
        <div className="flex items-center gap-3">
          <Stat label="Progress" value={stats.progressPct} formatter={(v) => fmtPct(v)} accent />
          <div className="flex-1">
            <HBar pct={stats.progressPct} color="var(--ta-accent)" height={8} />
          </div>
        </div>
      </Card>

      <SectionHeader icon={CalendarCheck} title="Calendar" subtitle="Tap a day for details" />
      <StrategyCalendar strategy={strategy} entries={entries} />

      {!hasAnyMetric && (
        <div className="mt-3">
          <EmptyHint>
            Add a Result, RRR, Buy/Sell or P&amp;L field to "{strategy.name}" in the Table view to see it analysed here.
          </EmptyHint>
        </div>
      )}

      {stats.hasOutcome && (
        <>
          <SectionHeader icon={Target} title="Win rate" subtitle={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`} />
          <Grid cols="grid-cols-2 sm:grid-cols-4">
            <Card>
              <Stat label="Win rate" value={stats.winRatePct} formatter={(v) => fmtPct(v)} accent />
            </Card>
            <Card>
              <Stat label="Wins" value={stats.wins} />
            </Card>
            <Card>
              <Stat label="Losses" value={stats.losses} />
            </Card>
            <Card>
              <Stat label="Breakeven" value={stats.breakevens} />
            </Card>
          </Grid>
        </>
      )}

      {stats.hasPnl && (
        <>
          <SectionHeader icon={IndianRupee} title="P&amp;L" subtitle={`${stats.pnlCount} entries logged`} />
          <Grid cols="grid-cols-2 sm:grid-cols-3">
            <Card>
              <Stat label="Total P&L" value={stats.pnlTotal} decimals={0} accent formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`} />
            </Card>
            <Card>
              <Stat
                label="Avg / entry"
                value={stats.pnlAvg ?? 0}
                formatter={(v) => (stats.pnlAvg == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`)}
              />
            </Card>
            <Card>
              <Stat label="Entries" value={stats.pnlCount} />
            </Card>
          </Grid>
        </>
      )}

      {stats.hasRrr && (
        <>
          <SectionHeader icon={Scale} title="RRR distribution" subtitle={`${stats.rrrTotal} tagged`} />
          <Card>
            <div className="flex flex-col gap-1.5">
              {RRR_OPTIONS.map((r) => (
                <HBar
                  key={r}
                  label={r}
                  pct={stats.rrrTotal > 0 ? (stats.rrrCounts[r] / stats.rrrTotal) * 100 : 0}
                  value={stats.rrrCounts[r]}
                />
              ))}
            </div>
          </Card>
        </>
      )}

      {stats.hasBuysell && (
        <>
          <SectionHeader icon={ArrowLeftRight} title="Buy vs Sell" subtitle={`${stats.buys + stats.sells} tagged`} />
          <Card>
            <div className="flex flex-col gap-1.5">
              <HBar label="Buy" pct={stats.buys + stats.sells > 0 ? (stats.buys / (stats.buys + stats.sells)) * 100 : 0} value={stats.buys} color="#16a34a" />
              <HBar label="Sell" pct={stats.buys + stats.sells > 0 ? (stats.sells / (stats.buys + stats.sells)) * 100 : 0} value={stats.sells} color="#dc2626" />
            </div>
          </Card>
        </>
      )}

      <StrategyCompare strategy={strategy} strategyEntries={entries?.[strategy.id]} year={year} month={month} />

      {hasAnyMetric && (
        <div className="mt-4 flex items-center gap-1.5 px-1 text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>
          <Sparkles size={9} />
          Numbers update live as you fill in the Table view.
        </div>
      )}
      </motion.div>
    </div>
  )
}
