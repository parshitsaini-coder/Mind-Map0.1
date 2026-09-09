import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, SlidersHorizontal, ShieldPlus, ChevronLeft, ChevronRight, Table2, LineChart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import TradeForm from './TradeForm'
import TradesTable from './TradesTable'
import ValidationRulesModal from './ValidationRulesModal'
import EditTradeModal from './EditTradeModal'
import FiltersPopover, { countActiveFilters } from './FiltersPopover'
import ThemePicker from './ThemePicker'
import AnalysisTab from './analysis/AnalysisTab'
import { tradeThemeCssVars } from '../../theme/tradeAnalysisThemes'

const SIDEBAR_WIDTH = 230
const SIDEBAR_SPRING = { type: 'spring', stiffness: 340, damping: 32 }

// Step 1 of trade-analysis-analytics-master-prompt.md — Table/Analysis
// segmented toggle for the top bar. Sits between the title and the
// Filters/Add Validation Rule buttons (which only make sense in Table
// view, since they act on rows the Analysis tab doesn't show).
function ViewSwitch({ activeView, onChange }) {
  const tabs = [
    { id: 'table', label: 'Table', icon: Table2 },
    { id: 'analysis', label: 'Analysis', icon: LineChart },
  ]
  return (
    <div
      className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
      style={{ backgroundColor: 'var(--ta-bg)' }}
    >
      {tabs.map((tab) => {
        const active = activeView === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors"
            style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
          >
            {active && (
              <motion.span
                layoutId="ta-view-switch-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            <tab.icon size={10} className="relative" />
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Trade Analysis — a separate full-screen feature (own overlay, own left
// "new trade" form, own entries table), isolated from the mind-map canvas
// underneath. Step 1 of trade-analysis-master-prompt.md: this file is just
// the shell — toolbar entry point, overlay open/close, and the top bar with
// Back / Filters / Add Validation Rule. Steps 2+ fill in the sidebar form,
// the entries table, the filters popover, and the validation-rules popup.
//
// This feature intentionally uses its own --ta-* CSS palette (see
// index.css) instead of the mind-map's --color-* tokens, so it reads as a
// distinct themed module — the one exception is Buy/Sell badges later on,
// which keep standard green/red trading semantics.
export default function TradeAnalysis() {
  const isOpen = useTradeAnalysisStore((s) => s.isOpen)
  const sidebarOpen = useTradeAnalysisStore((s) => s.sidebarOpen)
  const filters = useTradeAnalysisStore((s) => s.filters)
  const theme = useTradeAnalysisStore((s) => s.theme)
  const activeView = useTradeAnalysisStore((s) => s.activeView)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = countActiveFilters(filters)
  const isMobile = useIsMobile()
  const hasAutoCollapsed = useRef(false)

  // Step 10 (responsive pass) — auto-collapse the left form on narrow
  // viewports the first time we detect one, same "don't fight the user"
  // convention as elsewhere: once someone reopens it manually, we leave
  // it alone even if they resize again.
  useEffect(() => {
    if (isMobile && !hasAutoCollapsed.current && sidebarOpen) {
      hasAutoCollapsed.current = true
      useTradeAnalysisStore.getState().toggleSidebar()
    }
  }, [isMobile, sidebarOpen])

  // Esc closes the overlay, same convention as the Whiteboard.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        // Esc closes whichever is "on top" first: the filters popover,
        // then the overlay itself — same layered convention as the
        // validation-rules modal closing independently of the overlay.
        setFiltersOpen((open) => {
          if (open) return false
          useTradeAnalysisStore.getState().close()
          return open
        })
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ backgroundColor: '#ffffff', ...tradeThemeCssVars(theme) }}
        >
          {/* Top bar */}
          <div
            className="flex h-8 shrink-0 items-center gap-1.5 border-b px-2"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => useTradeAnalysisStore.getState().close()}
              title="Back to mind map (Esc)"
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-black/5"
              style={{ color: 'var(--ta-ink)' }}
            >
              <ArrowLeft size={11} />
              Back
            </motion.button>

            <div className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: 'var(--ta-slate)', opacity: 0.25 }} />

            <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--ta-ink)' }}>
              📊 Trade Analysis
            </span>

            <ThemePicker />

            <ViewSwitch
              activeView={activeView}
              onChange={(v) => useTradeAnalysisStore.getState().setActiveView(v)}
            />

            {/* Filters / Add Validation Rule act on table rows, so they
                only make sense (and only render) in Table view — Step 1. */}
            {activeView === 'table' && (
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    title="Filters"
                    onClick={() => setFiltersOpen((o) => !o)}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors hover:brightness-95"
                    style={
                      filtersOpen || activeFilterCount > 0
                        ? { backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }
                        : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
                    }
                  >
                    <SlidersHorizontal size={11} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span
                        className="flex h-3 min-w-[12px] items-center justify-center rounded-full px-1 text-[8px] font-bold"
                        style={{ backgroundColor: '#fffcf2', color: 'var(--ta-accent)' }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </motion.button>
                  <FiltersPopover open={filtersOpen} onClose={() => setFiltersOpen(false)} />
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  title="Add / manage validation rules"
                  onClick={() => setRulesModalOpen(true)}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-white transition-colors hover:brightness-110"
                  style={{ backgroundColor: 'var(--ta-accent)' }}
                >
                  <ShieldPlus size={11} />
                  Add Validation Rule
                </motion.button>
              </div>
            )}
          </div>

          {/* Body — panels sit in a padded gap now so every border has
              room to curve at its corners instead of meeting the
              viewport edge (or each other) as a hard right angle.
              Analysis view (Step 2 of the analytics master prompt)
              replaces the form+table layout entirely with the read-only
              dashboard — it has no left form, so it just fills the row. */}
          {activeView === 'analysis' ? (
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnalysisTab />
            </div>
          ) : (
          <div className="relative flex min-h-0 flex-1 gap-2 p-2" style={{ backgroundColor: '#ffffff' }}>
            {/* Left panel — "New Trade" form (Step 3). Collapsible shell
                from Step 2; TradeForm.jsx owns the actual fields. */}
            <motion.aside
              animate={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0, marginRight: sidebarOpen ? 0 : -8 }}
              whileHover={{ borderColor: 'var(--ta-accent)' }}
              transition={SIDEBAR_SPRING}
              className="ta-card-glow h-full shrink-0 overflow-hidden rounded-2xl border"
              style={{
                background: 'linear-gradient(165deg, var(--ta-surface), color-mix(in srgb, var(--ta-surface) 88%, var(--ta-accent) 12%))',
                borderColor: 'var(--ta-slate)',
              }}
            >
              <motion.div
                animate={{ opacity: sidebarOpen ? 1 : 0 }}
                transition={{ duration: 0.15, delay: sidebarOpen ? 0.12 : 0 }}
                style={{ width: SIDEBAR_WIDTH }}
                className="h-full overflow-y-auto p-2"
              >
                <TradeForm />
              </motion.div>
            </motion.aside>

            {/* Sidebar collapse/expand tab — stays put on the panel's
                trailing edge regardless of open/closed state. Hovering
                nudges it into a fuller, glowing curve (bigger scale +
                accent-colored border) instead of sitting flat. */}
            <motion.button
              onClick={() => useTradeAnalysisStore.getState().toggleSidebar()}
              animate={{ left: sidebarOpen ? SIDEBAR_WIDTH + 8 - 12 : 8 }}
              transition={SIDEBAR_SPRING}
              whileHover={{ scale: 1.12, borderColor: '#eb5e28', boxShadow: '0 2px 10px rgba(235,94,40,0.35)' }}
              whileTap={{ scale: 0.88 }}
              title={sidebarOpen ? 'Hide panel' : 'Show panel'}
              className="absolute top-1/2 z-10 flex h-7 w-6 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-colors"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
            >
              {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </motion.button>

            {/* Right panel — entries table (Step 6). */}
            <motion.div
              whileHover={{ borderColor: '#eb5e28' }}
              transition={{ duration: 0.2 }}
              className="min-w-0 flex-1 overflow-hidden rounded-2xl border shadow-sm"
              style={{ borderColor: 'var(--ta-slate)', backgroundColor: 'var(--ta-surface)' }}
            >
              <TradesTable />
            </motion.div>
          </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>
      <ValidationRulesModal open={rulesModalOpen} onClose={() => setRulesModalOpen(false)} />
      <EditTradeModal />
    </>
  )
}
