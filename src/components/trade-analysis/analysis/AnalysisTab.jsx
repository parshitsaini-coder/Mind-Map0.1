import { LineChart } from 'lucide-react'
import { useTradeAnalysisStore } from '../../../store/tradeAnalysisStore'
import { EmptyTab } from './primitives'
import KpiStrip from './KpiStrip'
import ActivitySection from './ActivitySection'
import WinRateSection from './WinRateSection'
import QuickStats from './QuickStats'
import VisualAnalytics from './VisualAnalytics'
import TrendSection from './TrendSection'
import Leaderboards from './Leaderboards'
import ActivityCalendar from './ActivityCalendar'
import ProAnalytics from './ProAnalytics'
import ConfidenceRisk from './ConfidenceRisk'
import FunnelMatrix from './FunnelMatrix'
import AlertsWidget from './AlertsWidget'
import IntensityHeatmap from './IntensityHeatmap'

// Trade Analysis — Analysis tab (Step 2 of
// trade-analysis-analytics-master-prompt.md). Everything here reads
// straight from the store's `trades` array and renders through the pure
// derive functions in src/utils/tradeAnalytics.js — no local state, no
// side effects. Sections render top-to-bottom in the exact order laid out
// in the master prompt (Steps 3-15); each widget owns its own empty state,
// but the whole tab short-circuits to one friendly message when there are
// no trades logged at all yet.
export default function AnalysisTab() {
  const trades = useTradeAnalysisStore((s) => s.trades)

  if (trades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto p-4">
        <EmptyTab
          icon={LineChart}
          title="No trades yet"
          subtitle="Add your first trade from the Table tab to see win rate, streaks, calendars and more here."
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-3" style={{ backgroundColor: 'var(--ta-bg)' }}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 pb-6">
        <KpiStrip trades={trades} />
        <ActivitySection trades={trades} />
        <WinRateSection trades={trades} />
        <QuickStats trades={trades} />
        <VisualAnalytics trades={trades} />
        <TrendSection trades={trades} />
        <Leaderboards trades={trades} />
        <ActivityCalendar trades={trades} />
        <ProAnalytics trades={trades} />
        <ConfidenceRisk trades={trades} />
        <FunnelMatrix trades={trades} />
        <AlertsWidget trades={trades} />
        <IntensityHeatmap trades={trades} />
      </div>
    </div>
  )
}
