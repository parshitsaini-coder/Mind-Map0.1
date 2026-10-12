import { Ruler, Trophy, CalendarCheck2, CalendarRange, Hourglass } from 'lucide-react'
import { getQuickStats } from '../../../utils/tradeAnalytics'
import { Card, SectionHeader, Stat, fmtPct } from './primitives'

export default function QuickStats({ trades }) {
  const q = getQuickStats(trades)

  const cards = [
    { icon: Ruler, label: 'Avg Score', value: fmtPct(q.avgScorePct), sub: 'per trade' },
    { icon: Trophy, label: 'Most Active', value: q.mostActive?.name || '—', sub: q.mostActive ? `${q.mostActive.count} trades` : null },
    { icon: CalendarCheck2, label: "Today's Trades", value: q.todayCount, sub: 'new entries' },
    { icon: CalendarRange, label: 'This Week', value: q.weekCount, sub: 'this week' },
    { icon: Hourglass, label: 'Oldest Pending', value: q.oldestPending ? `${q.oldestPending.days}d` : '—', sub: q.oldestPending?.name || null },
  ]

  return (
    <div>
      <SectionHeader title="Quick Stats" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map((c, i) => (
          <Card key={c.label} delay={i * 0.03}>
            <div className="flex flex-col items-center gap-1 py-0.5">
              <c.icon size={13} style={{ color: 'var(--ta-accent)' }} />
              <Stat label={c.label} value={c.value} sub={c.sub} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
