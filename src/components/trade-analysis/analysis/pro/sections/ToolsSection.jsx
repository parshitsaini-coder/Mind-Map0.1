import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calculator, Database, Flag, Shield, Sigma, Wrench } from 'lucide-react'
import { deriveToolDefaults } from '../../../../../utils/tradeTools'
import { getPerformance } from '../../../../../utils/tradeAnalyticsPro'
import { Grid, SectionTitle, Segmented } from '../ui'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'
import {
  AtrStopTool, BreakEvenTool, CurrencyTool, FibonacciTool, LotConverterTool, MarginTool,
  PipValueTool, PivotTool, PositionSizeTool, RiskRewardTool,
} from '../tools/CalculatorTools'
import {
  CompoundingTool, DrawdownRecoveryTool, ExpectancyTool, KellyTool, LossSequenceTool,
  MonteCarloTool, RiskOfRuinTool, RrGridTool, StreakSimulatorTool,
} from '../tools/RiskTools'
import { BackupTool, CsvTool, QueryConsoleTool, ReplayTool, ScreenshotTool } from '../tools/DataTools'
import {
  AlertRulesTool, GoalTool, PeriodCompareTool, PortfolioHeatTool, SessionClockTool,
} from '../tools/PlanningTools'
import {
  CostImpactTool, EdgeConfidenceTool, SampleSizeTool, TradeGraderTool, TrailingStopTool,
} from '../tools/EdgeTools'

// Analysis → Tools. Grouped into four families so the list stays
// navigable. Every calculator defaults from the person's own journal
// where a sensible default exists, and every one of them operates on real
// inputs — nothing here is a preview or a sample.

const GROUPS = [
  { id: 'trade', label: 'Trade setup', icon: Calculator },
  { id: 'risk', label: 'Risk & sizing', icon: Shield },
  { id: 'edge', label: 'Edge & proof', icon: Sigma },
  { id: 'plan', label: 'Planning', icon: Flag },
  { id: 'data', label: 'Data', icon: Database },
]

export default function ToolsSection() {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const [active, setActive] = useState('trade')

  // Calculators need one currency to label their outputs with. The larger
  // group wins when someone trades both, which is the more useful default
  // than always picking Equity.
  const primary = useMemo(() => {
    if (!groups.length) return { symbol: '', label: 'Account', trades: [], id: 'USD' }
    return [...groups].sort((a, b) => b.trades.length - a.trades.length)[0]
  }, [groups])

  const defaults = useMemo(() => deriveToolDefaults(primary.trades), [primary])
  const actualWinRate = useMemo(() => getPerformance(trades).winRate, [trades])

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmented
          value={active}
          onChange={setActive}
          options={GROUPS.map((g) => ({ id: g.id, label: g.label, icon: g.icon }))}
          layoutId="tool-group"
        />
        {defaults.available && (
          <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            Defaults available from your {defaults.sampleSize} logged {primary.label.toLowerCase()} trades
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col"
          style={{ gap: 'var(--tad-gap)' }}
        >
          {active === 'trade' && (
            <>
              <SectionTitle icon={Calculator} title="Before the trade" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <PositionSizeTool delay={0.02} />
                <RiskRewardTool delay={0.05} actualWinRate={actualWinRate} />
                <AtrStopTool delay={0.08} />
                <TrailingStopTool delay={0.11} />
                <BreakEvenTool delay={0.14} />
              </Grid>
              <SectionTitle icon={Wrench} title="Levels & conversions" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <PivotTool delay={0.02} />
                <FibonacciTool delay={0.05} />
                <PipValueTool delay={0.08} />
                <MarginTool delay={0.11} />
                <CurrencyTool delay={0.14} />
                <LotConverterTool delay={0.17} />
              </Grid>
            </>
          )}

          {active === 'risk' && (
            <>
              <SectionTitle icon={Shield} title="How much to risk" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <KellyTool delay={0.02} defaults={defaults} />
                <ExpectancyTool delay={0.05} defaults={defaults} symbol={primary.symbol} />
                <RiskOfRuinTool delay={0.08} defaults={defaults} />
                <LossSequenceTool delay={0.11} symbol={primary.symbol} />
              </Grid>
              <SectionTitle icon={Wrench} title="What could happen" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <MonteCarloTool delay={0.02} defaults={defaults} symbol={primary.symbol} />
                <StreakSimulatorTool delay={0.05} defaults={defaults} />
                <DrawdownRecoveryTool delay={0.08} defaults={defaults} />
                <CompoundingTool delay={0.11} symbol={primary.symbol} />
                <RrGridTool delay={0.14} actualWinRate={actualWinRate} />
              </Grid>
            </>
          )}

          {active === 'edge' && (
            <>
              <SectionTitle icon={Sigma} title="Is the edge real?" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <EdgeConfidenceTool delay={0.02} />
                <SampleSizeTool delay={0.05} />
              </Grid>
              <SectionTitle icon={Wrench} title="Grade & costs" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <TradeGraderTool delay={0.02} />
                {groups.map((g, i) => (
                  <CostImpactTool key={g.id} group={g} delay={0.05 + i * 0.03} />
                ))}
              </Grid>
            </>
          )}

          {active === 'plan' && (
            <>
              <SectionTitle icon={Flag} title="Right now" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <PortfolioHeatTool delay={0.02} symbol={primary.symbol} />
                <SessionClockTool delay={0.05} />
              </Grid>
              <SectionTitle icon={Wrench} title="Targets & thresholds" />
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                {groups.map((g, i) => (
                  <GoalTool key={g.id} group={g} delay={0.02 + i * 0.03} />
                ))}
                <PeriodCompareTool delay={0.08} symbol={primary.symbol} />
              </Grid>
              <Grid cols="grid-cols-1">
                <AlertRulesTool delay={0.02} />
              </Grid>
            </>
          )}

          {active === 'data' && (
            <>
              <SectionTitle icon={Database} title="Search & review" />
              <Grid cols="grid-cols-1">
                <QueryConsoleTool delay={0.02} />
              </Grid>
              <Grid cols="grid-cols-1 lg:grid-cols-2">
                <ReplayTool delay={0.02} />
                <CsvTool delay={0.05} />
                <BackupTool delay={0.08} />
              </Grid>
              <SectionTitle icon={Wrench} title="Charts" />
              <Grid cols="grid-cols-1">
                <ScreenshotTool delay={0.02} />
              </Grid>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
