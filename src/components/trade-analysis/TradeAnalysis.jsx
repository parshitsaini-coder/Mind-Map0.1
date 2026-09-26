import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, SlidersHorizontal, Settings, ChevronLeft, ChevronRight, Table2, LineChart, Wallet, Target, List, LayoutGrid, FileDown, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import TradeForm from './TradeForm'
import TradesTable from './TradesTable'
import TradeCards from './TradeCards'
import ValidationSettingsPanel from './ValidationSettingsPanel'
import EditTradeModal from './EditTradeModal'
import FiltersPopover, { countActiveFilters } from './FiltersPopover'
import ReportFiltersModal from './ReportFiltersModal'
import ThemePicker from './ThemePicker'
import AnalysisTab from './analysis/AnalysisTab'
import { tradeThemeCssVars, isGlassTheme, isClayTheme } from '../../theme/tradeAnalysisThemes'
import { getKpis } from '../../utils/tradeAnalytics'
import { splitTradesByCurrency } from '../../utils/currency'
import { generateTradeReport } from '../../utils/generateTradeReport'
import { useUiStore } from '../../store/uiStore'

const SIDEBAR_WIDTH = 230
const SIDEBAR_SPRING = { type: 'spring', stiffness: 340, damping: 32 }

// Step 1 of trade-analysis-analytics-master-prompt.md — Table/Analysis
// segmented toggle for the top bar. Sits between the title and the
// Filters button/Add Validation Rule group ("Add Validation Rule" still
// only makes sense in Table view, since it edits rows the Analysis tab
// doesn't show — Filters itself applies in both views now).
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
                layoutId="ta-view-switch-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            <motion.span
              className="relative flex"
              animate={active ? { rotate: [0, -12, 0] } : { rotate: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <tab.icon size={10} />
            </motion.span>
            <span className="relative">{tab.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// Table view only — small List/Cards segmented switch so entries can
// render as the classic row table or a responsive card grid (3-up on a
// wide screen). Sits right before the Filters/Add Validation Rule group,
// same pill-segment styling as ViewSwitch above.
function EntriesViewSwitch({ activeEntriesView, onChange }) {
  const options = [
    { id: 'list', label: 'List', icon: List },
    { id: 'cards', label: 'Cards', icon: LayoutGrid },
  ]
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
      style={{ backgroundColor: 'var(--ta-bg)' }}
    >
      {options.map((opt) => {
        const active = activeEntriesView === opt.id
        return (
          <motion.button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            title={opt.id === 'list' ? 'Row table view' : 'Card grid view'}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            className="relative flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: active ? '#fffcf2' : 'var(--ta-ink)' }}
          >
            {active && (
              <motion.span
                layoutId="ta-entries-view-switch-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              />
            )}
            <motion.span
              className="relative flex"
              animate={active ? { scale: [0.7, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <opt.icon size={10} />
            </motion.span>
            <span className="relative hidden sm:inline">{opt.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// One currency-scoped "Total P&L" pill — used twice below (Equity ₹,
// Forex+Commodity $) instead of a single pill that summed both
// currencies into one meaningless number. Hidden entirely when the
// person hasn't logged any trade of that instrument group yet, so an
// equity-only trader never sees an empty "$0" pill.
function PnlPill({ label, symbol, groupTrades, delay = 0 }) {
  const { totalPnl, tradesWithPnl } = getKpis(groupTrades)
  const pnlPositive = tradesWithPnl > 0 && totalPnl > 0
  const pnlNegative = tradesWithPnl > 0 && totalPnl < 0

  if (groupTrades.length === 0) return null

  return (
    <motion.div
      key={`pnl-${label}-${totalPnl}-${tradesWithPnl}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.06, y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 20, delay }}
      title={tradesWithPnl ? `${label} P&L across ${tradesWithPnl} logged trade${tradesWithPnl === 1 ? '' : 's'}` : `No ${label} P&L logged yet`}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
      style={
        pnlPositive
          ? { backgroundColor: 'rgba(22,163,74,0.14)', color: '#16a34a' }
          : pnlNegative
            ? { backgroundColor: 'rgba(220,38,38,0.14)', color: '#dc2626' }
            : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
      }
    >
      <motion.span
        className="flex"
        animate={pnlPositive ? { y: [0, -2, 0] } : pnlNegative ? { y: [0, 2, 0] } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Wallet size={11} />
      </motion.span>
      {label} P&L
      <span>{tradesWithPnl ? `${totalPnl > 0 ? '+' : ''}${symbol}${Math.abs(totalPnl).toLocaleString('en-IN')}` : '—'}</span>
    </motion.div>
  )
}

// "Pow" pass — Total P&L (now split by currency — Equity trades in ₹
// can never be added to Forex/Commodity trades in $) and Win Rate
// summary pills, sitting between the Table/Analysis toggle and the
// Filters / Add Validation Rule group so they're visible in both views.
// Purely derived from `trades` via getKpis; re-pop with a little spring
// whenever the underlying number changes (new trade, edited P&L, status
// flip).
function StatsPills({ trades }) {
  const { INR: equityTrades, USD: fxTrades } = splitTradesByCurrency(trades)
  const { winRatePct } = getKpis(trades)

  return (
    <div className="ml-2 flex shrink-0 items-center gap-1.5">
      <PnlPill label="Equity" symbol="₹" groupTrades={equityTrades} />
      <PnlPill label="Forex/Comm." symbol="$" groupTrades={fxTrades} delay={0.03} />

      <motion.div
        key={`wr-${winRatePct}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06, y: -1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.03 }}
        title="Win rate across resolved trades (Target Hit vs SL Hit)"
        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
        style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
      >
        <motion.span
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          whileHover={{ rotate: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="flex"
          style={{ color: 'var(--ta-accent)' }}
        >
          <Target size={11} />
        </motion.span>
        Win Rate
        <span>{winRatePct == null ? '—' : `${winRatePct.toFixed(0)}%`}</span>
      </motion.div>
    </div>
  )
}


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
  const entriesView = useTradeAnalysisStore((s) => s.entriesView)
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const validationCategories = useTradeAnalysisStore((s) => s.validationCategories)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const activeFilterCount = countActiveFilters(filters)
  const isGlass = isGlassTheme(theme)
  const isClay = isClayTheme(theme)
  const isMobile = useIsMobile()
  const hasAutoCollapsed = useRef(false)

  // "Download Report" no longer generates immediately — it opens
  // ReportFiltersModal so the person can scope the PDF to a date range
  // (quick preset or custom) and/or instrument type first. The modal
  // hands back the already-filtered trade list.
  const handleDownloadReport = async (filteredTrades, reportMeta) => {
    if (reportBusy || filteredTrades.length === 0) return
    setReportBusy(true)
    try {
      await generateTradeReport(filteredTrades, validationRules, validationCategories, reportMeta)
      setReportModalOpen(false)
    } catch (err) {
      console.error('Report generation failed:', err)
      useUiStore.getState().showToast('Could not build the report — please try again.')
    } finally {
      setReportBusy(false)
    }
  }

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
          data-ta-theme={theme}
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

            <StatsPills trades={trades} />

            {/* Report button lives outside the table-only group below so
                it's reachable from both Table and Analysis view — it acts
                on all logged trades, not just the ones currently visible
                in the table. Filters now renders in both views too (right
                below); only "Add Validation Rule" stays Table-only. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.04, y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                disabled={reportBusy || trades.length === 0}
                title={trades.length === 0 ? 'Log at least one trade first' : 'Choose a date range and type, then download a PDF report'}
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: '#0f172a' }}
              >
                <motion.span
                  className="flex"
                  animate={reportBusy ? { rotate: 360 } : { rotate: 0 }}
                  transition={reportBusy ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                >
                  {reportBusy ? <Loader2 size={11} /> : <FileDown size={11} />}
                </motion.span>
                {reportBusy ? 'Building…' : 'Download Report'}
              </motion.button>

              {/* Filters applies to every view — Table/Cards rows and every
                  Analysis widget both read trades through the same
                  filtered set, so it lives outside the Table-only group
                  below and stays visible regardless of activeView. */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                  title="Filters"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium shadow-sm"
                  style={
                    filtersOpen || activeFilterCount > 0
                      ? { backgroundColor: 'var(--ta-accent)', color: '#fffcf2' }
                      : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
                  }
                >
                  <motion.span
                    className="flex"
                    animate={{ rotate: filtersOpen ? 90 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    <SlidersHorizontal size={11} />
                  </motion.span>
                  Filters
                  <AnimatePresence mode="popLayout">
                    {activeFilterCount > 0 && (
                      <motion.span
                        key={activeFilterCount}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="flex h-3 min-w-[12px] items-center justify-center rounded-full px-1 text-[8px] font-bold"
                        style={{ backgroundColor: '#fffcf2', color: 'var(--ta-accent)' }}
                      >
                        {activeFilterCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <FiltersPopover open={filtersOpen} onClose={() => setFiltersOpen(false)} />
              </div>

              {activeView === 'table' && (
                <>
                  <EntriesViewSwitch
                    activeEntriesView={entriesView}
                    onChange={(v) => useTradeAnalysisStore.getState().setEntriesView(v)}
                  />
                  <motion.button
                    whileHover={{ scale: 1.04, y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                    title="Manage validation categories & rules"
                    onClick={() => setRulesModalOpen(true)}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-white"
                    style={{ backgroundColor: 'var(--ta-accent)' }}
                  >
                    <motion.span className="flex" whileHover={{ rotate: 90 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
                      <Settings size={11} />
                    </motion.span>
                    Validation Settings
                  </motion.button>
                </>
              )}
            </div>
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
          <div className="relative flex min-h-0 flex-1 gap-2 p-2" style={isGlass ? undefined : { backgroundColor: '#ffffff' }}>
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
              {entriesView === 'cards' ? <TradeCards /> : <TradesTable />}
            </motion.div>
          </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>
      <ValidationSettingsPanel open={rulesModalOpen} onClose={() => setRulesModalOpen(false)} />
      <EditTradeModal />
      <ReportFiltersModal
        open={reportModalOpen}
        onClose={() => (reportBusy ? null : setReportModalOpen(false))}
        trades={trades}
        busy={reportBusy}
        onGenerate={handleDownloadReport}
      />
    </>
  )
}
