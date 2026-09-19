import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb, Sparkles } from 'lucide-react'
import { getInsights, SEVERITY_META } from '../../../../../utils/tradeInsights'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import { Card, CardHead, Empty, Grid, SectionTitle, Segmented } from '../ui'
import { useScopedTrades } from '../useAnalysisData'

// Analysis → Findings. The insights engine's full output, filterable by
// severity. Each card carries the statistic it was derived from, so a
// finding can always be traced back to a number elsewhere in the tab.

const ORDER = ['critical', 'warning', 'opportunity', 'positive', 'info']

export default function InsightsSection() {
  const { trades } = useScopedTrades()
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const [filter, setFilter] = useState('all')

  const insights = useMemo(() => getInsights(trades, rules, categories), [trades, rules, categories])

  const counts = useMemo(() => {
    const c = {}
    insights.forEach((i) => {
      c[i.severity] = (c[i.severity] || 0) + 1
    })
    return c
  }, [insights])

  const shown = filter === 'all' ? insights : insights.filter((i) => i.severity === filter)

  const options = [
    { id: 'all', label: `All ${insights.length}` },
    ...ORDER.filter((s) => counts[s]).map((s) => ({ id: s, label: `${SEVERITY_META[s].label} ${counts[s]}` })),
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <SectionTitle
        icon={Sparkles}
        title="Findings"
        count={insights.length || undefined}
        sub="generated from this trade log only"
      />

      {insights.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <Segmented value={filter} onChange={setFilter} options={options} layoutId="insight-filter" />
        </div>
      )}

      {!insights.length ? (
        <Card>
          <CardHead icon={Lightbulb} title="Nothing to flag yet" />
          <Empty height={80}>
            Findings appear once there is enough history to say something honestly. Most checks need eight to twenty
            trades before they will fire — a conclusion drawn from four trades is worse than no conclusion.
          </Empty>
        </Card>
      ) : (
        <Grid cols="grid-cols-1 lg:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {shown.map((ins, i) => {
              const meta = SEVERITY_META[ins.severity]
              return (
                <motion.div
                  key={ins.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.32, delay: Math.min(i * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3 }}
                  className="ta-pro-card flex min-w-0 flex-col"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div className="flex min-w-0 items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="shrink-0 rounded px-1 py-px font-bold uppercase tracking-wide"
                          style={{ fontSize: 'var(--tad-micro)', color: meta.color, backgroundColor: meta.bg }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <span
                        className="mt-0.5 block font-bold leading-snug"
                        style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}
                      >
                        {ins.title}
                      </span>
                    </div>
                    {ins.metric && (
                      <div className="flex shrink-0 flex-col items-end">
                        <span className="ta-num font-extrabold leading-none" style={{ fontSize: 'var(--tad-value)', color: meta.color }}>
                          {ins.metric}
                        </span>
                        {ins.metricLabel && (
                          <span className="text-right" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                            {ins.metricLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 leading-relaxed" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                    {ins.body}
                  </p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </Grid>
      )}
    </div>
  )
}
