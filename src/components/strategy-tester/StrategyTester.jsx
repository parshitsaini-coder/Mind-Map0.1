import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, LineChart, Table2 } from 'lucide-react'
import { useEffect } from 'react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { tradeThemeCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
import { MONTH_NAMES } from '../../utils/strategyTesterFields'
import StrategyTesterThemePicker from './StrategyTesterThemePicker'
import StrategyTesterTable from './StrategyTesterTable'
import StrategyTesterAnalysis from './StrategyTesterAnalysis'

function ViewSwitch({ activeView, onChange }) {
  const tabs = [
    { id: 'table', label: 'Table', icon: Table2 },
    { id: 'analysis', label: 'Analysis', icon: LineChart },
  ]
  return (
    <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
      {tabs.map((tab) => {
        const active = activeView === tab.id
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="relative flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
          >
            {active && (
              <motion.span
                layoutId="st-view-switch-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            <span className="relative flex">
              <tab.icon size={10} />
            </span>
            <span className="relative">{tab.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function MonthNav() {
  const year = useStrategyTesterStore((s) => s.year)
  const month = useStrategyTesterStore((s) => s.month)
  return (
    <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5" style={{ backgroundColor: 'var(--ta-bg)' }}>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => useStrategyTesterStore.getState().goToMonth(-1)}
        title="Previous month"
        className="flex items-center justify-center rounded-full p-0.5"
        style={{ color: 'var(--ta-ink)' }}
      >
        <ChevronLeft size={12} />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => useStrategyTesterStore.getState().goToToday()}
        title="Jump to current month"
        className="whitespace-nowrap px-1 text-[10px] font-semibold"
        style={{ color: 'var(--ta-ink)' }}
      >
        {MONTH_NAMES[month]} {year}
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => useStrategyTesterStore.getState().goToMonth(1)}
        title="Next month"
        className="flex items-center justify-center rounded-full p-0.5"
        style={{ color: 'var(--ta-ink)' }}
      >
        <ChevronRight size={12} />
      </motion.button>
    </div>
  )
}

// Step 1 shell — toolbar entry point (see TopToolbar.jsx), overlay
// open/close, top bar with Back / Theme / Table·Analysis switch / month
// nav, and the two view bodies. Mirrors TradeAnalysis.jsx's overlay
// conventions (own --ta-* themed root, Esc to close, spring open/close)
// so it feels like part of the same family of features rather than a
// bolted-on tool.
export default function StrategyTester() {
  const isOpen = useStrategyTesterStore((s) => s.isOpen)
  const theme = useStrategyTesterStore((s) => s.theme)
  const activeView = useStrategyTesterStore((s) => s.activeView)
  const isGlass = isGlassTheme(theme)
  const isClay = isClayTheme(theme)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        useStrategyTesterStore.getState().close()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          data-ta-theme={theme}
          data-ta-density="dense"
          className={`fixed inset-0 z-[60] flex flex-col ${isGlass ? 'ta-liquid-bg' : isClay ? 'ta-clay-bg' : ''}`}
          style={isGlass || isClay ? { ...tradeThemeCssVars(theme) } : { backgroundColor: '#ffffff', ...tradeThemeCssVars(theme) }}
        >
          {/* Top bar */}
          <div
            className="flex h-8 shrink-0 items-center gap-1.5 border-b px-2"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              onClick={() => useStrategyTesterStore.getState().close()}
              title="Back to mind map (Esc)"
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-black/5"
              style={{ color: 'var(--ta-ink)' }}
            >
              <ArrowLeft size={11} />
              Back
            </motion.button>

            <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: 'var(--ta-slate)', opacity: 0.25 }} />

            <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
              🧪 Strategy Tester
            </span>

            <StrategyTesterThemePicker />

            <ViewSwitch activeView={activeView} onChange={(v) => useStrategyTesterStore.getState().setActiveView(v)} />

            {activeView === 'table' && <MonthNav />}

            <div className="ml-auto hidden shrink-0 text-[9px] sm:block" style={{ color: 'var(--ta-slate)' }}>
              One row per day — click a strategy's <span style={{ color: 'var(--ta-accent)', fontWeight: 700 }}>+</span> to add a
              field
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {activeView === 'table' ? <StrategyTesterTable /> : <StrategyTesterAnalysis />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
