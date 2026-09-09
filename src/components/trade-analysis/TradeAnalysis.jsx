import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, SlidersHorizontal, ShieldPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import TradeForm from './TradeForm'
import TradesTable from './TradesTable'
import ValidationRulesModal from './ValidationRulesModal'
import FiltersPopover, { countActiveFilters } from './FiltersPopover'

const SIDEBAR_WIDTH = 300
const SIDEBAR_SPRING = { type: 'spring', stiffness: 340, damping: 32 }

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
          style={{ backgroundColor: 'var(--ta-bg)' }}
        >
          {/* Top bar */}
          <div
            className="flex h-11 shrink-0 items-center gap-2 border-b px-3"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => useTradeAnalysisStore.getState().close()}
              title="Back to mind map (Esc)"
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5"
              style={{ color: 'var(--ta-ink)' }}
            >
              <ArrowLeft size={14} />
              Back
            </motion.button>

            <div className="mx-1 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--ta-slate)', opacity: 0.25 }} />

            <span className="shrink-0 text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
              📊 Trade Analysis
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  title="Filters"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:brightness-95"
                  style={
                    filtersOpen || activeFilterCount > 0
                      ? { backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }
                      : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
                  }
                >
                  <SlidersHorizontal size={14} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span
                      className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
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
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                <ShieldPlus size={14} />
                Add Validation Rule
              </motion.button>
            </div>
          </div>

          {/* Body */}
          <div className="relative flex min-h-0 flex-1">
            {/* Left panel — "New Trade" form (Step 3). Collapsible shell
                from Step 2; TradeForm.jsx owns the actual fields. */}
            <motion.aside
              animate={{ width: sidebarOpen ? SIDEBAR_WIDTH : 0 }}
              transition={SIDEBAR_SPRING}
              className="h-full shrink-0 overflow-hidden border-r"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
            >
              <motion.div
                animate={{ opacity: sidebarOpen ? 1 : 0 }}
                transition={{ duration: 0.15, delay: sidebarOpen ? 0.12 : 0 }}
                style={{ width: SIDEBAR_WIDTH }}
                className="h-full overflow-y-auto p-3"
              >
                <TradeForm />
              </motion.div>
            </motion.aside>

            {/* Sidebar collapse/expand tab — stays put on the panel's
                trailing edge regardless of open/closed state. */}
            <motion.button
              onClick={() => useTradeAnalysisStore.getState().toggleSidebar()}
              animate={{ left: sidebarOpen ? SIDEBAR_WIDTH - 12 : 0 }}
              transition={SIDEBAR_SPRING}
              whileTap={{ scale: 0.88 }}
              title={sidebarOpen ? 'Hide panel' : 'Show panel'}
              className="absolute top-1/2 z-10 flex h-7 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border shadow-sm"
              style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
            >
              {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </motion.button>

            {/* Right panel — entries table (Step 6). */}
            <div className="min-w-0 flex-1">
              <TradesTable />
            </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
      <ValidationRulesModal open={rulesModalOpen} onClose={() => setRulesModalOpen(false)} />
    </>
  )
}
