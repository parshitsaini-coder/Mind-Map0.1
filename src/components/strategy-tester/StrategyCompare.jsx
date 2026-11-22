import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GitCompare, Layers } from 'lucide-react'
import { Card, CardTitle, Grid, SectionHeader, HBar, EmptyHint } from '../trade-analysis/analysis/primitives'
import { computeBreakdown } from '../../utils/strategyBreakdown'

const EASE = [0.16, 1, 0.3, 1]
const FALLBACK = 'var(--ta-accent)'

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0)

// Analysis → "Compare options": count every option of every Select /
// Multi-select / Checkbox / Buy-Sell / SL-Target / Result / RRR field over
// the month's entries, pick any number of options (from any fields) to line
// them up against each other, and see a per-field breakdown below.
export default function StrategyCompare({ strategy, strategyEntries, year, month }) {
  const data = useMemo(() => computeBreakdown(strategy, strategyEntries, year, month), [strategy, strategyEntries, year, month])
  const [picked, setPicked] = useState(() => new Set())

  const allOptions = data.categories.flatMap((c) => c.options)
  const keyOf = (o) => `${o.fieldId}::${o.key}`
  // Drop picks that no longer exist (option deleted / strategy switched).
  const valid = new Set(allOptions.map(keyOf))
  const active = [...picked].filter((k) => valid.has(k))
  const activeSet = new Set(active)

  const toggle = (o) =>
    setPicked((prev) => {
      const next = new Set(prev)
      const k = keyOf(o)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  if (data.categories.length === 0) {
    return (
      <>
        <SectionHeader icon={GitCompare} title="Compare options" />
        <EmptyHint>
          Add a Select, Multi-select, Buy/Sell, SL/Target or Result field to "{strategy.name}" to compare its options here.
        </EmptyHint>
      </>
    )
  }

  const compared = allOptions.filter((o) => activeSet.has(keyOf(o))).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...compared.map((o) => o.count))

  return (
    <>
      <SectionHeader icon={GitCompare} title="Compare options" subtitle={`${data.total} entr${data.total === 1 ? 'y' : 'ies'} this month`} />

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <CardTitle icon={Layers} title="Pick options to compare" subtitle="select as many as you like" />
          {active.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="rounded-full px-2 py-0.5 text-[8.5px] font-semibold"
              style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-slate)' }}
            >
              Clear ({active.length})
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {data.categories.map((cat) => (
            <div key={cat.fieldId} className="flex flex-wrap items-center gap-1">
              <span className="w-24 shrink-0 truncate text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                {cat.label}
              </span>
              {cat.options.map((o) => {
                const on = activeSet.has(keyOf(o))
                const c = o.color || FALLBACK
                return (
                  <motion.button
                    key={o.key}
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                    onClick={() => toggle(o)}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={{
                      backgroundColor: on ? c : 'var(--ta-bg)',
                      color: on ? '#fffcf2' : 'var(--ta-ink)',
                      boxShadow: on ? 'none' : `inset 0 0 0 1px ${c}55`,
                    }}
                  >
                    {o.label}
                    <span className="tabular-nums" style={{ opacity: 0.75 }}>
                      {o.count}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          ))}
        </div>
      </Card>

      <AnimatePresence initial={false}>
        {compared.length > 0 && (
          <motion.div
            key="compare-result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="mt-2"
          >
            <Card>
              <CardTitle icon={GitCompare} title="Comparison" subtitle={`${compared.length} selected · ranked by count`} />
              <div className="mt-2 flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {compared.map((o) => {
                    const c = o.color || FALLBACK
                    const decided = o.wins + o.losses
                    return (
                      <motion.div
                        key={keyOf(o)}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      >
                        <div className="mb-0.5 flex items-baseline justify-between gap-2">
                          <span className="truncate text-[9.5px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
                            <span style={{ color: 'var(--ta-slate)', fontWeight: 500 }}>{o.fieldLabel} · </span>
                            {o.label}
                          </span>
                          <span className="shrink-0 text-[9.5px] font-bold tabular-nums" style={{ color: 'var(--ta-ink)' }}>
                            {o.count}
                            <span className="ml-1 font-medium" style={{ color: 'var(--ta-slate)' }}>
                              {pct(o.count, data.total).toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ta-bg)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct(o.count, maxCount)}%` }}
                            transition={{ duration: 0.6, ease: EASE }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: c }}
                          />
                        </div>
                        {data.hasOutcome && o.count > 0 && (
                          <div className="mt-0.5 text-[8px] tabular-nums" style={{ color: 'var(--ta-slate)' }}>
                            <span style={{ color: '#16a34a' }}>{o.wins}W</span> · <span style={{ color: '#dc2626' }}>{o.losses}L</span>
                            {decided > 0 && <> · win rate {pct(o.wins, decided).toFixed(0)}%</>}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionHeader icon={Layers} title="By field" subtitle="share of this month's entries" />
      <Grid cols="grid-cols-1 sm:grid-cols-2">
        {data.categories.map((cat) => (
          <Card key={cat.fieldId}>
            <CardTitle icon={Layers} title={cat.label} />
            <div className="mt-2 flex flex-col gap-1.5">
              {cat.options.map((o) => (
                <HBar key={o.key} label={o.label} pct={pct(o.count, data.total)} value={o.count} color={o.color || FALLBACK} />
              ))}
            </div>
          </Card>
        ))}
      </Grid>
    </>
  )
}
