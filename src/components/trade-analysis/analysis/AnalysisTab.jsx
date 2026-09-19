import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlignJustify, BarChart3, Brain, CalendarRange, Clock, Gauge, LayoutDashboard, LineChart,
  Rows3, Rows4, Sparkles, Target, Wrench, X,
} from 'lucide-react'
import { useTradeAnalysisStore } from '../../../store/tradeAnalysisStore'
import { EmptyTab } from './primitives'
import { Segmented } from './pro/ui'
import { SCOPE_PRESETS, scopeBounds, useScopedTrades } from './pro/useAnalysisData'

// Trade Analysis — Analysis tab shell.
//
// The dashboard is split into eight sections rather than one endless
// scroll: each can be dense without becoming a thirty-screen page, and
// the section you were last on is remembered between visits.
//
// Sections are code-split. The Tools section alone pulls in every
// calculator, and someone who only ever looks at Overview should not pay
// for that on load.

const OverviewSection = lazy(() => import('./pro/sections/OverviewSection'))
const PerformanceSection = lazy(() => import('./pro/sections/PerformanceSection'))
const RiskSection = lazy(() => import('./pro/sections/RiskSection'))
const BehaviorSection = lazy(() => import('./pro/sections/BehaviorSection'))
const TimeSection = lazy(() => import('./pro/sections/TimeSection'))
const EdgeSection = lazy(() => import('./pro/sections/EdgeSection'))
const InsightsSection = lazy(() => import('./pro/sections/InsightsSection'))
const ToolsSection = lazy(() => import('./pro/sections/ToolsSection'))

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, Component: OverviewSection },
  { id: 'performance', label: 'Performance', icon: BarChart3, Component: PerformanceSection },
  { id: 'risk', label: 'Risk', icon: Gauge, Component: RiskSection },
  { id: 'edge', label: 'Edge', icon: Target, Component: EdgeSection },
  { id: 'behavior', label: 'Behaviour', icon: Brain, Component: BehaviorSection },
  { id: 'time', label: 'Timing', icon: Clock, Component: TimeSection },
  { id: 'insights', label: 'Findings', icon: Sparkles, Component: InsightsSection },
  { id: 'tools', label: 'Tools', icon: Wrench, Component: ToolsSection },
]

const DENSITIES = [
  { id: 'cozy', label: 'Cozy', icon: Rows3, title: 'Larger text and spacing' },
  { id: 'compact', label: 'Compact', icon: Rows4, title: 'Balanced — the default' },
  { id: 'dense', label: 'Dense', icon: AlignJustify, title: 'Smallest text, most on screen' },
]

const isoToday = () => new Date().toISOString().slice(0, 10)

// ── Date scope control ───────────────────────────────────────────────
function ScopeControl() {
  const scope = useTradeAnalysisStore((s) => s.analysisScope)
  const setScope = useTradeAnalysisStore((s) => s.setAnalysisScope)
  const { trades, allTrades, excluded } = useScopedTrades()
  const [customOpen, setCustomOpen] = useState(scope.preset === 'custom')

  const onPreset = (id) => {
    setScope({ preset: id })
    setCustomOpen(id === 'custom')
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <CalendarRange size={11} style={{ color: 'var(--ta-accent)' }} />
      <select
        value={scope.preset}
        onChange={(e) => onPreset(e.target.value)}
        className="ta-tool-input"
        style={{ width: 96, cursor: 'pointer' }}
        aria-label="Date range"
      >
        {SCOPE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      <AnimatePresence>
        {customOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <input
              type="date"
              value={scope.from || ''}
              max={scope.to || isoToday()}
              onChange={(e) => setScope({ from: e.target.value || null })}
              className="ta-tool-input"
              style={{ width: 112 }}
              aria-label="From date"
            />
            <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>to</span>
            <input
              type="date"
              value={scope.to || ''}
              min={scope.from || undefined}
              onChange={(e) => setScope({ to: e.target.value || null })}
              className="ta-tool-input"
              style={{ width: 112 }}
              aria-label="To date"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {excluded > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onPreset('all')}
            title="Clear the date range and show every trade"
            className="flex items-center gap-0.5 rounded-full px-1.5 py-px font-bold"
            style={{
              fontSize: 'var(--tad-micro)',
              color: 'var(--ta-accent)',
              backgroundColor: 'color-mix(in srgb, var(--ta-accent) 14%, transparent)',
            }}
          >
            {trades.length} of {allTrades.length}
            <X size={8} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sticky section navigation ────────────────────────────────────────
function SectionNav({ active, onChange }) {
  const ref = useRef(null)

  // Keep the active pill in view when the bar scrolls sideways on a
  // narrow screen — otherwise the current section can sit off-screen.
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-section="${active}"]`)
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <div ref={ref} className="ta-scroll ta-scroll-x flex min-w-0 flex-1 items-center gap-0.5">
      {SECTIONS.map((s) => {
        const isActive = active === s.id
        return (
          <motion.button
            key={s.id}
            type="button"
            data-section={s.id}
            onClick={() => onChange(s.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26 }}
            className="relative flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-semibold"
            style={{ fontSize: 'var(--tad-label)', color: isActive ? '#fffcf2' : 'var(--ta-ink)' }}
          >
            {isActive && (
              <motion.span
                layoutId="ta-analysis-section-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            <span className="relative flex">
              <s.icon size={10} />
            </span>
            <span className="relative whitespace-nowrap">{s.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
          {[0, 1, 2].map((col) => (
            <div
              key={col}
              className="ta-shimmer"
              style={{ height: 118, border: '1px solid var(--tad-border)', borderRadius: 'var(--tad-radius)' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function AnalysisTab() {
  const allTrades = useTradeAnalysisStore((s) => s.trades)
  const section = useTradeAnalysisStore((s) => s.analysisSection)
  const density = useTradeAnalysisStore((s) => s.density)
  const scope = useTradeAnalysisStore((s) => s.analysisScope)
  const scrollRef = useRef(null)

  const active = SECTIONS.some((s) => s.id === section) ? section : 'overview'
  const current = SECTIONS.find((s) => s.id === active)
  const ActiveComponent = current.Component

  const go = useCallback((id) => {
    useTradeAnalysisStore.getState().setAnalysisSection(id)
    // A new section always starts at the top — carrying the old scroll
    // position into a shorter section strands the reader mid-page.
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Range label for the header, derived so it always matches the filter
  // that is actually being applied.
  const rangeLabel = useMemo(() => {
    const { from, to } = scopeBounds(scope)
    if (!from && !to) return 'all time'
    const fmt = (d) => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    if (from && to) return `${fmt(from)} – ${fmt(to)}`
    if (from) return `since ${fmt(from)}`
    return `up to ${fmt(to)}`
  }, [scope])

  // Alt+1..8 jumps between sections. Alt is used so this can never
  // collide with typing in one of the tool inputs.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > SECTIONS.length) return
      e.preventDefault()
      go(SECTIONS[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (allTrades.length === 0) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto p-4" data-ta-density={density}>
        <EmptyTab
          icon={LineChart}
          title="No trades yet"
          subtitle="Log your first trade from the Table tab. Win rate, drawdown, edge ranking and every calculator here run on your own entries — none of it is sample data."
        />
      </div>
    )
  }

  return (
    <div data-ta-density={density} className="flex h-full min-h-0 flex-col" style={{ backgroundColor: 'var(--ta-bg)' }}>
      {/* Toolbar */}
      <div className="ta-sticky-nav flex shrink-0 flex-wrap items-center gap-1.5 px-2 py-1">
        <SectionNav active={active} onChange={go} />
        <div className="flex shrink-0 items-center gap-1.5">
          <ScopeControl />
          <Segmented
            size="xs"
            value={density}
            onChange={(d) => useTradeAnalysisStore.getState().setDensity(d)}
            options={DENSITIES}
            layoutId="ta-density"
          />
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="ta-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: 'var(--tad-pad)' }}>
        <div className="mx-auto w-full max-w-[1500px]">
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="font-bold uppercase tracking-wider" style={{ fontSize: 'var(--tad-title)', color: 'var(--ta-ink)' }}>
              {current.label}
            </span>
            <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>{rangeLabel}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="pb-8"
            >
              <Suspense fallback={<SectionSkeleton />}>
                <ActiveComponent onNavigate={go} />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
