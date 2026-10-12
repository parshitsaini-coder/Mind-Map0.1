import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CandlestickChart, LineChart as LineIcon, Crosshair, Activity, PencilRuler, Square, Columns2, LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { createChart, CandlestickSeries, LineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, SYMBOLS, TIMEFRAMES } from '../../lib/terminal/instruments'
import { getCandles, subscribe, getDayOpen } from '../../lib/terminal/feed/simulatedFeed'
import TradingEngine from './TradingEngine'
import AccountBar from './AccountBar'
import OrderTicket from './OrderTicket'
import PositionsPanel from './PositionsPanel'
import Toasts from './Toasts'
import HistoryScreen from './HistoryScreen'
import ChartTrading from './ChartTrading'
import IndicatorLayer from './IndicatorLayer'
import DrawingLayer from './DrawingLayer'
import IndicatorPanel from './IndicatorPanel'
import DrawToolbar from './DrawToolbar'
import SettingsPanel from './SettingsPanel'
import { useTerminalHotkeys, useWakeLock } from './phase8Hooks'
import { TZ, BG } from './chartConst'
import { useMediaQuery, useQuote } from './hooks'

const UP = '#16a34a'
const DOWN = '#dc2626'

// Some browsers/environments report an invalid language tag; the chart would then
// fail to draw. Use the browser's locale only when it is valid, else en-US.
const SAFE_LOCALE = (() => {
  try {
    const l = navigator.language
    return l && Intl.DateTimeFormat.supportedLocalesOf([l]).length ? l : 'en-US'
  } catch {
    return 'en-US'
  }
})()

const fmt = (n, digits) => (Number.isFinite(n) ? n.toFixed(digits) : '—')

// ─── The chart itself ───────────────────────────────────────────────────
const ChartView = memo(function ChartView({ symbol, timeframe, chartType, onQuote, active, index, showLabel, onActivate }) {
  const hostRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const extraRef = useRef([]) // prices of SL/TP/order lines — kept inside the visible price range
  const candlesRef = useRef(null) // the candles the series was loaded with (indicators + drawings read them)
  const busRef = useRef(null) // IndicatorLayer registers here to receive every live candle update
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const [ver, setVer] = useState(0)

  // Keyboard + / − : zoom the active chart, keeping the newest bar where it is.
  useEffect(() => {
    const onZoom = (e) => {
      if (!activeRef.current) return
      const ts = chartRef.current?.timeScale()
      const r = ts?.getVisibleLogicalRange()
      if (!r) return
      const width = Math.max(8, (r.to - r.from) * (e.detail > 0 ? 0.75 : 1.33))
      ts.setVisibleLogicalRange({ from: r.to - width, to: r.to })
    }
    window.addEventListener('tm-zoom', onZoom)
    return () => window.removeEventListener('tm-zoom', onZoom)
  }, [])

  useEffect(() => {
    const chart = createChart(hostRef.current, {
      autoSize: true,
      localization: { locale: SAFE_LOCALE },
      layout: { background: { type: ColorType.Solid, color: BG }, textColor: '#9aa4b2', fontSize: 11, panes: { separatorColor: '#27313d', separatorHoverColor: '#334155' } },
      grid: { vertLines: { color: '#1b232d' }, horzLines: { color: '#1b232d' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#27313d' },
      timeScale: { borderColor: '#27313d', timeVisible: true, secondsVisible: false, rightOffset: 6 },
    })
    chartRef.current = chart
    setVer((v) => v + 1)
    return () => {
      // stop the resize observer first: a resize landing after remove() throws "Object is disposed"
      try { chart.applyOptions({ autoSize: false }) } catch { /* ignore */ }
      chart.remove()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const inst = INSTRUMENTS[symbol]
    const tfSec = (TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).minutes * 60
    const priceFormat = { type: 'price', precision: inst.digits, minMove: 10 ** -inst.digits }
    const autoscaleInfoProvider = (base) => {
      const r = base()
      const ex = extraRef.current
      if (!r || !ex.length) return r
      return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...ex), maxValue: Math.max(r.priceRange.maxValue, ...ex) } }
    }
    const isLine = chartType === 'line'
    const series = isLine
      ? chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, priceFormat, autoscaleInfoProvider })
      : chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN, priceFormat, autoscaleInfoProvider })

    const candles = getCandles(symbol, timeframe, 1500)
    candlesRef.current = candles
    const toPoint = (k) => (isLine ? { time: k.time + TZ, value: k.close } : { time: k.time + TZ, open: k.open, high: k.high, low: k.low, close: k.close })
    seriesRef.current = series
    setVer((v) => v + 1)
    series.setData(candles.map(toPoint))
    chart.timeScale().scrollToRealTime()
    let last = candles[candles.length - 1]

    const unsub = subscribe(symbol, (q) => {
      const bucket = Math.floor(q.time / tfSec) * tfSec
      const px = q.bid
      const isNew = !last || bucket > last.time
      if (isNew) {
        const open = last ? last.close : px
        last = { time: bucket, open, high: Math.max(open, px), low: Math.min(open, px), close: px, volume: 1 }
      } else {
        last = { ...last, high: Math.max(last.high, px), low: Math.min(last.low, px), close: px, volume: (last.volume || 0) + 1 }
      }
      series.update(toPoint(last))
      if (busRef.current) busRef.current(last, isNew)
      if (activeRef.current) onQuote(q)
    })

    return () => {
      unsub()
      seriesRef.current = null
      candlesRef.current = null
      try { chart.removeSeries(series) } catch { /* chart already disposed (terminal closing) */ }
    }
  }, [symbol, timeframe, chartType, onQuote])

  return (
    <div className="relative h-full w-full" onPointerDownCapture={() => { if (!active) onActivate(index) }}>
      <div ref={hostRef} className="h-full w-full" />
      <IndicatorLayer chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} busRef={busRef} symbol={symbol} timeframe={timeframe} ver={ver} />
      <ChartTrading hostRef={hostRef} chartRef={chartRef} seriesRef={seriesRef} extraRef={extraRef} symbol={symbol} ver={ver} active={active} />
      <DrawingLayer hostRef={hostRef} chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} symbol={symbol} timeframe={timeframe} ver={ver} active={active} />
      {showLabel && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-[5] rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: active ? 'rgba(37,99,235,0.85)' : 'rgba(30,41,59,0.8)', color: '#fff' }}>
          {symbol} · {(TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).label}
        </div>
      )}
      {showLabel && active && <div className="pointer-events-none absolute inset-0 z-[4] border" style={{ borderColor: 'rgba(37,99,235,0.7)' }} />}
    </div>
  )
})

// 1, 2 (side by side) or 4 (2×2) charts. The active chart drives the order ticket, header and shortcuts.
function ChartGrid({ layout, charts, activeChart, chartType, onQuote, onActivate }) {
  const n = layout
  const cells = n === 1 ? [activeChart] : Array.from({ length: n }, (_, i) => i)
  const cols = n === 1 ? 1 : 2
  const rows = n === 4 ? 2 : 1
  return (
    <div className="grid h-full w-full gap-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, backgroundColor: '#27313d' }}>
      {cells.map((i) => (
        <div key={i} className="relative min-h-0 min-w-0" style={{ backgroundColor: BG }}>
          <ChartView symbol={charts[i].symbol} timeframe={charts[i].timeframe} chartType={chartType} onQuote={onQuote} active={i === activeChart} index={i} showLabel={n > 1} onActivate={onActivate} />
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
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-2" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
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
  const [indOpen, setIndOpen] = useState(false)
  const [drawOpen, setDrawOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(false)
  useEffect(() => { settingsRef.current = settingsOpen }, [settingsOpen])
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

  const openHelp = useCallback(() => setSettingsOpen(true), [])
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
      if (e.key !== 'Escape') return
      if (settingsRef.current) setSettingsOpen(false)
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
  const priceColor = dir > 0 ? '#4ade80' : dir < 0 ? '#f87171' : '#e5e7eb'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="tm-root fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: BG, color: '#e5e7eb', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Row 1 — back + symbols + live price */}
      <div className="no-scrollbar flex min-h-10 shrink-0 items-center gap-2 overflow-x-auto border-b px-2" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
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
            style={{ backgroundColor: s === symbol ? '#2563eb' : 'transparent', color: s === symbol ? '#fff' : '#9aa4b2' }}
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
        <div className="no-scrollbar flex min-h-8 items-center gap-1 overflow-x-auto border-b px-2" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => st.setTimeframe(t.id)}
              className="tm-tap shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: t.id === timeframe ? '#334155' : 'transparent', color: t.id === timeframe ? '#fff' : '#9aa4b2' }}
            >
              {t.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
          <button type="button" title="Candles" aria-label="Candlestick chart" aria-pressed={chartType === 'candles'} onClick={() => st.setChartType('candles')} className="shrink-0 rounded p-1" style={{ backgroundColor: chartType === 'candles' ? '#334155' : 'transparent' }}>
            <CandlestickChart size={14} />
          </button>
          <button type="button" title="Line" aria-label="Line chart" aria-pressed={chartType === 'line'} onClick={() => st.setChartType('line')} className="shrink-0 rounded p-1" style={{ backgroundColor: chartType === 'line' ? '#334155' : 'transparent' }}>
            <LineIcon size={14} />
          </button>
          <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
          <button type="button" title="Indicators" aria-expanded={indOpen} onClick={() => setIndOpen((v) => !v)} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: indOpen ? '#334155' : 'transparent', color: indCount ? '#7dd3fc' : '#9aa4b2' }}>
            <Activity size={13} /> Indicators{indCount ? ` (${indCount})` : ''}
          </button>
          <button type="button" title="Drawing tools" aria-pressed={drawOpen} onClick={() => { if (drawOpen) st.setDrawTool('cursor'); setDrawOpen((v) => !v) }} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: drawOpen ? '#334155' : 'transparent', color: drawOpen || drawTool !== 'cursor' ? '#7dd3fc' : '#9aa4b2' }}>
            <PencilRuler size={13} /> Draw
          </button>
          {isDesktop && (
            <>
              <div className="mx-1 h-4 w-px shrink-0 bg-white/15" />
              {[[1, Square, 'One chart'], [2, Columns2, 'Two charts'], [4, LayoutGrid, 'Four charts']].map(([n, Icon, title]) => (
                <button key={n} type="button" title={title} aria-label={title} aria-pressed={layoutPref === n} onClick={() => st.setLayout(n)} className="shrink-0 rounded p-1" style={{ backgroundColor: layoutPref === n ? '#334155' : 'transparent', color: layoutPref === n ? '#fff' : '#9aa4b2' }}>
                  <Icon size={14} />
                </button>
              ))}
            </>
          )}
          <button type="button" title="Settings  (?)" aria-label="Terminal settings" onClick={openHelp} className="tm-tap ml-auto shrink-0 rounded p-1 text-slate-300 hover:bg-white/10">
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
      {drawOpen && <DrawToolbar symbol={symbol} />}

      <AccountBar />

      {/* Chart + positions | order ticket (desktop) */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ChartGrid layout={layout} charts={charts} activeChart={activeChart} chartType={chartType} onQuote={onQuote} onActivate={st.setActiveChart} />
          </div>
          <PositionsPanel />
        </div>
        {isDesktop && (
          <aside className="w-[300px] shrink-0 overflow-y-auto border-l" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
            <OrderTicket key={symbol} symbol={symbol} />
          </aside>
        )}
      </div>
      {!isDesktop && <MobileTradeBar symbol={symbol} onOpen={() => setSheet(true)} />}

      {!isDesktop && (
        <>
          <motion.div initial={false} animate={{ opacity: sheet ? 1 : 0 }} onClick={() => setSheet(false)} className="absolute inset-0 z-20 bg-black/60" style={{ pointerEvents: sheet ? 'auto' : 'none' }} />
          <motion.div initial={false} animate={{ y: sheet ? 0 : '105%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }} aria-hidden={!sheet}
            className="absolute inset-x-0 bottom-0 z-30 max-h-[88%] overflow-y-auto rounded-t-2xl border-t" style={{ backgroundColor: '#131a22', borderColor: '#27313d', paddingBottom: 'env(safe-area-inset-bottom, 0px)', pointerEvents: sheet ? 'auto' : 'none' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 pt-2" style={{ backgroundColor: '#131a22' }}>
              <div className="mx-auto h-1 w-10 rounded-full bg-white/25" />
              <button type="button" onClick={() => setSheet(false)} className="absolute right-2 top-1.5 rounded px-2 py-1 text-[11px] font-bold text-slate-300">Close</button>
            </div>
            <OrderTicket key={symbol} symbol={symbol} onExecuted={() => setSheet(false)} onPickStart={() => setSheet(false)} />
          </motion.div>
        </>
      )}

      <HistoryScreen />
      <Toasts />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <TradingEngine symbol={symbol} extra={visibleSymbols} />

      <div className="flex h-6 shrink-0 items-center justify-center border-t text-[10px] text-slate-400" style={{ borderColor: '#27313d', backgroundColor: '#131a22' }}>
        DEMO · simulated prices · virtual money
      </div>
    </motion.div>
  )
}
