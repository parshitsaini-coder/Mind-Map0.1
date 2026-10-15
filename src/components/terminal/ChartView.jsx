import { memo, useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries, BaselineSeries, createTextWatermark, createSeriesMarkers } from 'lightweight-charts'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import { getCandles, subscribe, getDayOpen } from '../../lib/terminal/feed/simulatedFeed'
import { chartOptions, seriesOptions, seriesClassOf, applyChartSettings, pointOf, heikinAll, heikinBar, sourceOf, watermarkLines, WM_ALIGN } from '../../lib/terminal/chartApply'
import { tzOffsetSec, css, LINE_STYLE } from '../../lib/terminal/chartSettings'
import IndicatorLayer from './IndicatorLayer'
import ChartTrading from './ChartTrading'
import DrawingLayer from './DrawingLayer'
import ObjectTree from './ObjectTree'
import ChartHud from './ChartHud'
import PositionPills from './PositionPills'
import ChartAccountStrip from './ChartAccountStrip'
import ChartFx from './ChartFx'
import ExecTooltip from './ExecTooltip'
import { setTz } from './chartConst'
import { createLiveBar } from '../../lib/terminal/liveBar'

const CLASSES = { Candlestick: CandlestickSeries, Bar: BarSeries, Line: LineSeries, Area: AreaSeries, Baseline: BaselineSeries }

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

const stripPrivate = ({ _tzSec, ...o }) => { void _tzSec; return o }

// Series that must be REBUILT when these change (a scale / colour-per-bar choice cannot be patched in place).
const dataKeyOf = (cs, chartType) => {
  const s = cs.symbol
  const per = s.colorByPrev ? JSON.stringify([s.up, s.down, s.borderUp, s.borderDown, s.wickUp, s.wickDown, s.bodyOn, s.borderOn, s.wickOn]) : 0
  return `${chartType}|${per}|${s.lineSource}|${s.tz}|${cs.scales.placement}`
}

const bucketOf = (t, tfSec) => Math.floor(t / tfSec) * tfSec

// ─── The chart itself ───────────────────────────────────────────────────
function ChartView({ symbol, timeframe, chartType, onQuote, active, index, showLabel, onActivate, cs }) {
  const hostRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const extraRef = useRef([]) // prices of SL/TP/order lines — kept inside the visible price range
  const candlesRef = useRef(null) // the candles the series was loaded with (indicators + drawings read them)
  const valsRef = useRef(null) // IndicatorLayer publishes its computed values here (legend reads them)
  const busRef = useRef(null) // IndicatorLayer registers here to receive every live candle update
  const [live] = useState(createLiveBar) // newest real candle (the status line + countdown read it)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const csRef = useRef(cs)
  csRef.current = cs
  const [ver, setVer] = useState(0)
  const history = useTerminalStore((s) => s.history)
  const positions = useTerminalStore((s) => s.positions)

  setTz(cs.symbol.tz) // idempotent; keeps the shared TZ binding in step with the setting
  const dataKey = dataKeyOf(cs, chartType)

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
    const opts = stripPrivate(chartOptions(csRef.current))
    const chart = createChart(hostRef.current, { autoSize: true, ...opts, localization: { locale: SAFE_LOCALE, ...opts.localization } })
    chartRef.current = chart
    setVer((v) => v + 1)
    return () => {
      // stop the resize observer first: a resize landing after remove() throws "Object is disposed"
      try { chart.applyOptions({ autoSize: false }) } catch { /* ignore */ }
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // ── the price series (rebuilt on symbol / timeframe / chart type / structural settings) ──
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return undefined
    const cur = csRef.current
    const inst = INSTRUMENTS[symbol]
    const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]
    const tfSec = tf.minutes * 60
    const tz = tzOffsetSec(cur.symbol.tz)
    const autoscaleInfoProvider = (base) => {
      const r = base()
      const ex = extraRef.current
      if (!r || !ex.length) return r
      return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...ex), maxValue: Math.max(r.priceRange.maxValue, ...ex) } }
    }
    const candles = getCandles(symbol, timeframe, 1500)
    candlesRef.current = candles
    const ha = chartType === 'heikin'
    const shown = ha ? heikinAll(candles) : candles
    const extra = { autoscaleInfoProvider }
    if (chartType === 'baseline' && candles.length) {
      extra.baseValue = { type: 'price', price: sourceOf(candles[Math.max(0, candles.length - 120)], cur.symbol.lineSource) }
    }
    const series = chart.addSeries(CLASSES[seriesClassOf(chartType)], seriesOptions(chartType, cur, inst, extra))
    seriesRef.current = series
    setVer((v) => v + 1)

    const points = shown.map((k, i) => pointOf(chartType, k, k.time + tz, csRef.current, i ? shown[i - 1].close : null))
    series.setData(points)
    chart.timeScale().scrollToRealTime()

    let last = candles[candles.length - 1]
    let haPrev = ha ? shown[shown.length - 2] || null : null // HA bar before the live one
    let haLast = ha ? shown[shown.length - 1] || null : null
    let prevShownClose = shown.length > 1 ? shown[shown.length - 2].close : null
    let prevClose = candles.length > 1 ? candles[candles.length - 2].close : null
    live.set({ last, prevClose })

    const unsub = subscribe(symbol, (q) => {
      const bucket = bucketOf(q.time, tfSec)
      const px = q.bid
      const isNew = !last || bucket > last.time
      if (isNew) {
        prevClose = last ? last.close : null
        if (ha) { haPrev = haLast; prevShownClose = haLast ? haLast.close : null } else prevShownClose = last ? last.close : null
        const open = last ? last.close : px
        last = { time: bucket, open, high: Math.max(open, px), low: Math.min(open, px), close: px, volume: 1 }
      } else {
        last = { ...last, high: Math.max(last.high, px), low: Math.min(last.low, px), close: px, volume: (last.volume || 0) + 1 }
      }
      live.set({ last, prevClose })
      const disp = ha ? (haLast = heikinBar(last, haPrev)) : last
      series.update(pointOf(chartType, disp, last.time + tz, csRef.current, prevShownClose))
      if (busRef.current) busRef.current(last, isNew)
      if (activeRef.current) onQuote(q)
    })

    return () => {
      unsub()
      seriesRef.current = null
      candlesRef.current = null
      try { chart.removeSeries(series) } catch { /* chart already disposed (terminal closing) */ }
    }
  }, [symbol, timeframe, chartType, dataKey, onQuote, live])

  // ── settings -> chart + series (cheap, in place) ──
  useEffect(() => {
    if (!chartRef.current) return
    try { applyChartSettings(chartRef.current, seriesRef.current, cs, { type: chartType, inst: INSTRUMENTS[symbol] }) } catch { /* chart disposed */ }
  }, [cs, chartType, symbol, ver])

  // ── extra price lines: previous close, bid, ask, visible-range high / low ──
  const sc = cs.scales
  const linesKey = JSON.stringify([sc.prevClose, sc.prevCloseColor, sc.prevCloseStyle, sc.prevCloseWidth, sc.bid, sc.bidColor, sc.bidStyle, sc.bidWidth, sc.ask, sc.askColor, sc.askStyle, sc.askWidth, sc.hiLo, sc.hiLoColor])
  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return undefined
    const c = csRef.current.scales
    const made = []
    const mk = (opts) => { const l = series.createPriceLine({ axisLabelVisible: true, ...opts }); made.push(l); return l }
    const style = (s) => LINE_STYLE[s]
    if (c.prevClose) {
      const px = getDayOpen(symbol)
      if (Number.isFinite(px)) mk({ price: px, color: css(c.prevCloseColor), lineStyle: style(c.prevCloseStyle), lineWidth: c.prevCloseWidth, title: 'Prev' })
    }
    let bid = null, ask = null, unsub = null
    if (c.bid || c.ask) {
      const q0 = (() => { let first = null; const u = subscribe(symbol, (q) => { first = q }); u(); return first })()
      if (c.bid) bid = mk({ price: q0?.bid ?? 0, color: css(c.bidColor), lineStyle: style(c.bidStyle), lineWidth: c.bidWidth, title: 'Bid' })
      if (c.ask) ask = mk({ price: q0?.ask ?? 0, color: css(c.askColor), lineStyle: style(c.askStyle), lineWidth: c.askWidth, title: 'Ask' })
      unsub = subscribe(symbol, (q) => { bid?.applyOptions({ price: q.bid }); ask?.applyOptions({ price: q.ask }) })
    }
    let hi = null, lo = null, raf = 0
    const updateHiLo = () => {
      raf = 0
      const cand = candlesRef.current
      const r = chart.timeScale().getVisibleLogicalRange()
      if (!cand || !cand.length || !r) return
      const from = Math.max(0, Math.floor(r.from)), to = Math.min(cand.length - 1, Math.ceil(r.to))
      let h = -Infinity, l = Infinity
      for (let i = from; i <= to; i++) { if (cand[i].high > h) h = cand[i].high; if (cand[i].low < l) l = cand[i].low }
      const lastK = live.get().last
      if (lastK && r.to >= cand.length - 1) { h = Math.max(h, lastK.high); l = Math.min(l, lastK.low) }
      if (!Number.isFinite(h) || !Number.isFinite(l)) return
      if (hi) hi.applyOptions({ price: h }); else hi = mk({ price: h, color: css(c.hiLoColor), lineStyle: 1, lineWidth: 1, title: 'High' })
      if (lo) lo.applyOptions({ price: l }); else lo = mk({ price: l, color: css(c.hiLoColor), lineStyle: 1, lineWidth: 1, title: 'Low' })
    }
    const onRange = () => { if (!raf) raf = requestAnimationFrame(updateHiLo) }
    if (c.hiLo) { chart.timeScale().subscribeVisibleLogicalRangeChange(onRange); onRange() }
    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (c.hiLo) { try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange) } catch { /* disposed */ } }
      unsub?.()
      for (const l of made) { try { series.removePriceLine(l) } catch { /* series replaced */ } }
    }
  }, [symbol, ver, linesKey, live])

  // ── watermark ──
  const wmKey = JSON.stringify([cs.canvas.wmMode, cs.canvas.wmText, cs.canvas.wmColor, cs.canvas.wmOpacity, cs.canvas.wmSize, cs.canvas.wmPos])
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return undefined
    const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]
    const lines = watermarkLines(csRef.current, symbol, tf.label)
    if (!lines.length) return undefined
    const [horzAlign, vertAlign] = WM_ALIGN[csRef.current.canvas.wmPos] || WM_ALIGN.center
    let wm = null
    try { wm = createTextWatermark(chart.panes()[0], { horzAlign, vertAlign, lines }) } catch { /* chart disposed */ }
    return () => { try { wm?.detach() } catch { /* ignore */ } }
  }, [symbol, timeframe, wmKey, ver])

  // ── execution markers: where positions were opened / closed ──
  const showExec = cs.trading.showExecutions
  useEffect(() => {
    const series = seriesRef.current
    if (!series || !showExec) return undefined
    const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]
    const tfSec = tf.minutes * 60
    const tz = tzOffsetSec(csRef.current.symbol.tz)
    const t = csRef.current.trading
    const out = []
    const at = (sec) => bucketOf(sec, tfSec) + tz
    const money = (n) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(2)}`
    for (const h of history.filter((x) => x.symbol === symbol).slice(0, 150)) {
      out.push({ time: at(h.openTime), position: h.side === 'buy' ? 'belowBar' : 'aboveBar', shape: h.side === 'buy' ? 'arrowUp' : 'arrowDown', color: css(h.side === 'buy' ? t.colorBuy : t.colorSell), text: `${h.side === 'buy' ? 'B' : 'S'} ${h.lots}` })
      out.push({ time: at(h.closeTime), position: h.side === 'buy' ? 'aboveBar' : 'belowBar', shape: 'circle', color: css(h.pnl >= 0 ? t.colorBuy : t.colorSell), text: money(h.pnl) })
    }
    for (const p of positions.filter((x) => x.symbol === symbol)) {
      out.push({ time: at(p.openTime), position: p.side === 'buy' ? 'belowBar' : 'aboveBar', shape: p.side === 'buy' ? 'arrowUp' : 'arrowDown', color: css(p.side === 'buy' ? t.colorBuy : t.colorSell), text: `${p.side === 'buy' ? 'B' : 'S'} ${p.lots}` })
    }
    out.sort((a, b) => a.time - b.time)
    let plugin = null
    try { plugin = createSeriesMarkers(series, out) } catch { /* series replaced */ }
    return () => { try { plugin?.detach() } catch { /* ignore */ } }
  }, [symbol, timeframe, showExec, history, positions, ver, cs.trading.colorBuy, cs.trading.colorSell, cs.symbol.tz])

  return (
    <div className="relative h-full w-full" onPointerDownCapture={() => { if (!active) onActivate(index) }}>
      <div ref={hostRef} className="h-full w-full" />
      <IndicatorLayer chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} busRef={busRef} valsRef={valsRef} symbol={symbol} timeframe={timeframe} ver={ver} />
      <ChartTrading hostRef={hostRef} chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} extraRef={extraRef} symbol={symbol} ver={ver} active={active} />
      <PositionPills hostRef={hostRef} seriesRef={seriesRef} candlesRef={candlesRef} symbol={symbol} ver={ver} active={active} />
      <DrawingLayer hostRef={hostRef} chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} symbol={symbol} timeframe={timeframe} ver={ver} active={active} />
      {active && <ObjectTree symbol={symbol} />}
      <ChartFx hostRef={hostRef} chartRef={chartRef} seriesRef={seriesRef} symbol={symbol} active={active} />
      <ExecTooltip chartRef={chartRef} symbol={symbol} timeframe={timeframe} tz={cs.symbol.tz} />
      {active && <ChartAccountStrip />}
      <ChartHud chartRef={chartRef} seriesRef={seriesRef} candlesRef={candlesRef} valsRef={valsRef} live={live} symbol={symbol} timeframe={timeframe} ver={ver} cs={cs} offsetTop={showLabel ? 22 : 0} />
      {showLabel && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-[5] rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: active ? 'rgba(37,99,235,0.85)' : 'rgba(30,41,59,0.8)', color: '#fff' }}>
          {symbol} · {(TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).label}
        </div>
      )}
      {showLabel && active && <div className="pointer-events-none absolute inset-0 z-[4] border" style={{ borderColor: 'rgba(37,99,235,0.7)' }} />}
    </div>
  )
}

export default memo(ChartView)
