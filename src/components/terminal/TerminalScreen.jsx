import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CandlestickChart, ChevronDown, Crosshair, Activity, PencilRuler, Square, Columns2, LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, SYMBOLS, TIMEFRAMES } from '../../lib/terminal/instruments'
import { CHART_TYPES } from '../../lib/terminal/chartSettings'
import { getDayOpen } from '../../lib/terminal/feed/simulatedFeed'
import TradingEngine from './TradingEngine'
import AccountBar from './AccountBar'
import OrderTicket from './OrderTicket'
import PositionsPanel from './PositionsPanel'
import Toasts from './Toasts'
import HistoryScreen from './HistoryScreen'
import ChartView from './ChartView'
import IndicatorPanel from './IndicatorPanel'
import IndicatorDialog from './IndicatorDialog'
import SoundChip from './SoundChip'
import OrderPopup from './OrderPopup'
import StopoutBanner from './StopoutBanner'
import { useMotion } from './motionHooks'
import EffectsLab from './EffectsLab'
import DrawToolbar from './DrawToolbar'
import SettingsDialog from './SettingsDialog'
import { useTerminalHotkeys, useWakeLock } from './phase8Hooks'
import { useChartTheme, themeVars } from './chartTheme'
import { useMediaQuery, useQuote } from './hooks'

const fmt = (n, digits) => (Number.isFinite(n) ? n.toFixed(digits) : '—')

// Chart type picker (candles, hollow, bars, line, area, baseline, Heikin Ashi) + a shortcut to its settings.
function ChartTypeMenu({ chartType, onSettings }) {
  const [open, setOpen] = useState(false)
  const cur = CHART_TYPES.find((t) => t.id === chartType) || CHART_TYPES[0]
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!e.target.closest?.('[data-chart-type-menu]')) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="relative shrink-0" data-chart-type-menu>
      <button type="button" title="Chart type" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tm-tap flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: open ? 'var(--tm-active)' : 'transparent' }}>
        <CandlestickChart size={14} /> {cur.label} <ChevronDown size={11} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-44 rounded-lg border py-1 shadow-xl" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border2)' }}>
          {CHART_TYPES.map((t) => (
            <button key={t.id} type="button" role="menuitemradio" aria-checked={chartType === t.id} onClick={() => { useTerminalStore.getState().setChartType(t.id); setOpen(false) }} className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-white/10" style={{ color: chartType === t.id ? '#38bdf8' : 'var(--tm-text)' }}>
              {t.label}{chartType === t.id ? ' ✓' : ''}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings() }} className="w-full border-t px-3 py-2 text-left text-[12px] hover:bg-white/10" style={{ borderColor: 'var(--tm-border)', color: 'var(--tm-muted)' }}>Chart settings…</button>
        </div>
      )}
    </div>
  )
}

// 1, 2 (side by side) or 4 (2×2) charts. The active chart drives the order ticket, header and shortcuts.
function ChartGrid({ layout, charts, activeChart, chartType, onQuote, onActivate, cs }) {
  const n = layout
  const cells = n === 1 ? [activeChart] : Array.from({ length: n }, (_, i) => i)
  const cols = n === 1 ? 1 : 2
  const rows = n === 4 ? 2 : 1
  return (
    <div className="grid h-full w-full gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, backgroundColor: 'var(--tm-border)' }}>
      {cells.map((i) => (
        <div key={i} className="relative min-h-0 min-w-0" style={{ backgroundColor: 'var(--tm-chart-bg)' }}>
          <ChartView cs={cs} symbol={charts[i].symbol} timeframe={charts[i].timeframe} chartType={chartType} onQuote={onQuote} active={i === activeChart} index={i} showLabel={n > 1} onActivate={onActivate} />
        </div>
      ))}
    </div>
  )
}

// Phone: SELL / BUY bar that opens the order ticket as a bottom sheet.
function MobileTradeBar({ symbol, onOpen }) {
  const q = useQuote(symbol)
  const d = INSTRUMENTS[symbol].digits
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-2" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }}>
      <button type="button" onClick={onOpen} className="flex h-12 flex-col items-center justify-center rounded-lg font-extrabold text-white" style={{ backgroundColor: '#b91c1c' }}>
        <span className="text-[10px] tracking-wider">SELL</span><span className="text-[14px] tabular-nums">{fmt(q?.bid, d)}</span>
      </button>
      <button type="button" onClick={onOpen} className="flex h-12 flex-col items-center justify-center rounded-lg font-extrabold text-white" style={{ backgroundColor: '#15803d' }}>
        <span className="text-[10px] tracking-wider">BUY</span><span className="text-[14px] tabular-nums">{fmt(q?.ask, d)}</span>
      </button>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────
export default function TerminalScreen() {
  const isOpen = useTerminalStore((s) => s.isOpen)
  const symbol = useTerminalStore((s) => s.symbol)
  const timeframe = useTerminalStore((s) => s.timeframe)
  const chartType = useTerminalStore((s) => s.chartType)
  const layoutPref = useTerminalStore((s) => s.layout)
  const charts = useTerminalStore((s) => s.charts)
  const activeChart = useTerminalStore((s) => s.activeChart)
  const indCount = useTerminalStore((s) => s.indicators.length)
  const drawTool = useTerminalStore((s) => s.drawTool)
  const { cs, chrome } = useChartTheme()
  const [indOpen, setIndOpen] = useState(false)
  const [drawOpen, setDrawOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState(null) // null = closed, else the tab to show
  const settingsOpen = settingsTab != null
  const settingsRef = useRef(false)
  useEffect(() => { settingsRef.current = settingsOpen }, [settingsOpen])
  const mo = useMotion()
  // dev builds: ?lab=1 opens the effects playground
  useEffect(() => {
    try { if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('lab') === '1') useTerminalStore.getState().setLabOpen(true) } catch { /* ignore */ }
  }, [])
  const wakeLock = useTerminalStore((s) => s.settings.wakeLock)
  const [quote, setQuote] = useState(null)
  const prevBid = useRef(null)
  const [dir, setDir] = useState(0)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [sheet, setSheet] = useState(false)
  const sheetRef = useRef(false)
  sheetRef.current = sheet
  const indRef = useRef(false)
  useEffect(() => { indRef.current = indOpen }, [indOpen])
  const pickRes = useTerminalStore((s) => s.pickRes)
  useEffect(() => { if (pickRes && !isDesktop) setSheet(true) }, [pickRes, isDesktop])
  const ticketPrefill = useTerminalStore((s) => s.ticketPrefill)
  useEffect(() => { if (ticketPrefill && !isDesktop) setSheet(true) }, [ticketPrefill, isDesktop])

  const openHelp = useCallback(() => setSettingsTab('shortcuts'), [])
  useTerminalHotkeys(isOpen && !settingsOpen, openHelp)
  useWakeLock(isOpen && wakeLock)

  const layout = isDesktop ? layoutPref : 1 // several charts are a desktop feature
  const visibleSymbols = useMemo(() => (layout === 1 ? [symbol] : charts.slice(0, layout).map((c) => c.symbol)), [layout, charts, symbol])
  const inst = INSTRUMENTS[symbol]
  const dayOpen = useMemo(() => getDayOpen(symbol), [symbol])

  const onQuote = useMemo(
    () => (q) => {
      if (prevBid.current != null && q.bid !== prevBid.current) setDir(q.bid > prevBid.current ? 1 : -1)
      prevBid.current = q.bid
      setQuote(q)
    },
    [],
  )

  useEffect(() => {
    prevBid.current = null
    setQuote(null)
  }, [symbol])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.altKey && e.key === ',') { setSettingsTab((t) => (t ? t : 'symbol')); e.preventDefault(); return }
      if (e.key !== 'Escape') return
      if (settingsRef.current) window.dispatchEvent(new CustomEvent('tm-settings-cancel'))
      else if (useTerminalStore.getState().popup) useTerminalStore.getState().dismissPopup()
      else if (useTerminalStore.getState().ticketPending) useTerminalStore.getState().fireHotkey('cancel')
      else if (useTerminalStore.getState().historyOpen) useTerminalStore.getState().setHistoryOpen(false)
      else if (indRef.current) setIndOpen(false)
      else if (useTerminalStore.getState().escapeDraw()) { /* left the drawing tool / deselected */ }
      else if (sheetRef.current) setSheet(false)
      else useTerminalStore.getState().close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (!isOpen) return null
  const st = useTerminalStore.getState()
  const change = quote ? ((quote.mid - dayOpen) / dayOpen) * 100 : 0
  const priceColor = dir > 0 ? '#4ade80' : dir < 0 ? '#f87171' : 'var(--tm-text)'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      data-motion={mo.mode}
      className="tm-root fixed inset-0 z-[60] flex flex-col"
      data-tm-light={chrome.light ? 'true' : undefined}
      style={{ ...themeVars(chrome, cs), backgroundColor: 'var(--tm-bg)', color: 'var(--tm-text)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Row 1 — back + symbols + live price */}
      <div className="no-scrollbar flex min-h-10 shrink-0 items-center gap-2 overflow-x-auto border-b px-2" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }}>
        <button type="button" onClick={st.close} className="tm-tap flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium hover:bg-white/10">
          <ArrowLeft size={12} /> Back
        </button>
        <div className="h-4 w-px shrink-0 bg-white/15" />
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => st.setSymbol(s)}
            className="tm-tap shrink-0 rounded-md px-2 py-1 text-[11px] font-bold transition-colors"
            style={{ backgroundColor: s === symbol ? '#2563eb' : 'transparent', color: s === symbol ? '#fff' : 'var(--tm-muted)' }}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-3 pl-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] uppercase tracking-wide text-slate-400">Bid</span>
            <span className="text-[13px] font-extrabold tabular-nums" style={{ color: priceColor }}>{fmt(quote?.bid, inst.digits)}</span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] uppercase tracking-wide text-slate-400">Ask</span>
            <span className="text-[13px] font-extrabold tabular-nums" style={{ color: priceColor }}>{fmt(quote?.ask, inst.digits)}</span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] uppercase tracking-wide text-slate-400">Spread</span>
            <span className="text-[11px] font-semibold tabular-nums text-slate-300">{((quote?.spread ?? inst.spread) / inst.pipSize).toFixed(1)}p</span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] uppercase tracking-wide text-slate-400">24h</span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: change >= 0 ? '#4ade80' : '#f87171' }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 — timeframe, chart type, indicators, drawing tools, layout */}
      <div className="relative shrink-0">
        <div className="no-scrollbar flex min-h-8 items-center gap-1 overflow-x-auto border-b px-2" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }}>
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => st.setTimeframe(t.id)}
              className="tm-tap shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: t.id === timeframe ? 'var(--tm-active)' : 'transparent', color: t.id === timeframe ? '#fff' : 'var(--tm-muted)' }}
            >
              {t.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
          <ChartTypeMenu chartType={chartType} onSettings={() => setSettingsTab('symbol')} />
          <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
          <button type="button" title="Indicators" aria-expanded={indOpen} onClick={() => setIndOpen((v) => !v)} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: indOpen ? 'var(--tm-active)' : 'transparent', color: indCount ? '#7dd3fc' : 'var(--tm-muted)' }}>
            <Activity size={13} /> Indicators{indCount ? ` (${indCount})` : ''}
          </button>
          <button type="button" title="Drawing tools" aria-pressed={drawOpen} onClick={() => { if (drawOpen) st.setDrawTool('cursor'); setDrawOpen((v) => !v) }} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: drawOpen ? 'var(--tm-active)' : 'transparent', color: drawOpen || drawTool !== 'cursor' ? '#7dd3fc' : 'var(--tm-muted)' }}>
            <PencilRuler size={13} /> Draw
          </button>
          {isDesktop && (
            <>
              <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
              {[[1, Square, 'One chart'], [2, Columns2, 'Two charts'], [4, LayoutGrid, 'Four charts']].map(([n, Icon, title]) => (
                <button key={n} type="button" title={title} aria-label={title} aria-pressed={layoutPref === n} onClick={() => st.setLayout(n)} className="shrink-0 rounded p-1" style={{ backgroundColor: layoutPref === n ? 'var(--tm-active)' : 'transparent', color: layoutPref === n ? '#fff' : 'var(--tm-muted)' }}>
                  <Icon size={14} />
                </button>
              ))}
            </>
          )}
          <button type="button" title="Settings  (Alt+, — shortcuts: ?)" aria-label="Terminal settings" onClick={() => setSettingsTab('symbol')} className="tm-tap ml-auto shrink-0 rounded p-1 text-slate-300 hover:bg-white/10">
            <SettingsIcon size={14} />
          </button>
          <span className="flex shrink-0 items-center gap-1 pl-2 text-[10px] text-slate-400">
            <Crosshair size={11} /> {inst.name}
          </span>
        </div>
        {indOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIndOpen(false)} />
            <IndicatorPanel onClose={() => setIndOpen(false)} />
          </>
        )}
      </div>
      <IndicatorDialog />
      <SoundChip />
      <OrderPopup />
      <StopoutBanner />
      <EffectsLab />
      {drawOpen && <DrawToolbar symbol={symbol} />}

      <AccountBar />

      {/* Chart + positions | order ticket (desktop) */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ChartGrid layout={layout} charts={charts} activeChart={activeChart} chartType={chartType} onQuote={onQuote} onActivate={st.setActiveChart} cs={cs} />
          </div>
          <PositionsPanel />
        </div>
        {isDesktop && (
          <aside className="w-[300px] shrink-0 overflow-y-auto border-l" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }}>
            <OrderTicket key={symbol} symbol={symbol} />
          </aside>
        )}
      </div>
      {!isDesktop && <MobileTradeBar symbol={symbol} onOpen={() => setSheet(true)} />}

      {!isDesktop && (
        <>
          <motion.div initial={false} animate={{ opacity: sheet ? 1 : 0 }} onClick={() => setSheet(false)} className="absolute inset-0 z-20 bg-black/60" style={{ pointerEvents: sheet ? 'auto' : 'none' }} />
          <motion.div initial={false} animate={{ y: sheet ? 0 : '105%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }} aria-hidden={!sheet}
            className="absolute inset-x-0 bottom-0 z-30 max-h-[88%] overflow-y-auto rounded-t-2xl border-t" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', pointerEvents: sheet ? 'auto' : 'none' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 pt-2" style={{ backgroundColor: 'var(--tm-panel)' }}>
              <div className="mx-auto h-1 w-10 rounded-full bg-white/25" />
              <button type="button" onClick={() => setSheet(false)} className="absolute right-2 top-1.5 rounded px-2 py-1 text-[11px] font-bold text-slate-300">Close</button>
            </div>
            <OrderTicket key={symbol} symbol={symbol} onExecuted={() => setSheet(false)} onPickStart={() => setSheet(false)} />
          </motion.div>
        </>
      )}

      <HistoryScreen />
      <Toasts />
      {settingsOpen && <SettingsDialog initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
      <TradingEngine symbol={symbol} extra={visibleSymbols} />

      <div className="flex h-6 shrink-0 items-center justify-center border-t text-[10px] text-slate-400" style={{ borderColor: 'var(--tm-border)', backgroundColor: 'var(--tm-panel)' }}>
        DEMO · simulated prices · virtual money
      </div>
    </motion.div>
  )
}
