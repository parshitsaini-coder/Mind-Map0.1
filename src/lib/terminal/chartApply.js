// The one place that pushes chartSettings into a live lightweight-charts chart / series, plus the
// series factories (candles, hollow, bars, line, area, baseline, Heikin Ashi).
// The data transforms (pointOf / HeikinState) are pure and tested in tests/terminal-phase9.test.mjs.
import { css, LINE_STYLE, LINE_TYPE, SCALE_MODE, CROSSHAIR_MODE, formatDate, formatTime, withAlpha } from './chartSettings.js'

const CLEAR = 'rgba(0,0,0,0)'

// ── data transforms ──────────────────────────────────────────────────────
export const isOhlc = (type) => ['candles', 'hollow', 'bars', 'heikin'].includes(type)
export const sourceOf = (k, src) => (src === 'open' ? k.open : src === 'high' ? k.high : src === 'low' ? k.low : src === 'hl2' ? (k.high + k.low) / 2 : k.close)

// Heikin Ashi, one bar at a time. `prev` is the HA bar before this one (or null for the first bar).
export function heikinBar(k, prev) {
  const close = (k.open + k.high + k.low + k.close) / 4
  const open = prev ? (prev.open + prev.close) / 2 : (k.open + k.close) / 2
  return { time: k.time, open, close, high: Math.max(k.high, open, close), low: Math.min(k.low, open, close), volume: k.volume }
}
export function heikinAll(candles) {
  const out = []
  for (const k of candles) out.push(heikinBar(k, out[out.length - 1] || null))
  return out
}

// One chart data point for candle `k` (already tz-shifted time passed separately as `time`).
// `prevClose` is the previous bar's REAL close (used when "colour by previous close" is on).
export function pointOf(type, k, time, cs, prevClose) {
  if (isOhlc(type)) {
    const p = { time, open: k.open, high: k.high, low: k.low, close: k.close }
    if (cs.symbol.colorByPrev && prevClose != null && type !== 'bars') {
      const up = k.close >= prevClose
      const body = up ? cs.symbol.up : cs.symbol.down
      p.color = type === 'hollow' && up ? CLEAR : css(body)
      p.borderColor = css(up ? cs.symbol.borderUp : cs.symbol.borderDown)
      p.wickColor = css(up ? cs.symbol.wickUp : cs.symbol.wickDown)
    } else if (cs.symbol.colorByPrev && prevClose != null) {
      p.color = css(k.close >= prevClose ? cs.symbol.up : cs.symbol.down)
    }
    return p
  }
  return { time, value: sourceOf(k, cs.symbol.lineSource) }
}

// ── series options ───────────────────────────────────────────────────────
// Which lightweight-charts series class a chart type needs.
export const seriesClassOf = (type) => (type === 'bars' ? 'Bar' : type === 'line' ? 'Line' : type === 'area' ? 'Area' : type === 'baseline' ? 'Baseline' : 'Candlestick')

export function seriesOptions(type, cs, inst, extra = {}) {
  const s = cs.symbol, sc = cs.scales
  const precision = s.precision === 'auto' ? inst.digits : Number(s.precision)
  const base = {
    priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
    lastValueVisible: sc.lastLabel,
    priceLineVisible: sc.lastLine,
    priceLineColor: css(sc.lastLineColor),
    priceLineStyle: LINE_STYLE[sc.lastLineStyle],
    priceLineWidth: sc.lastLineWidth,
    priceScaleId: sc.placement === 'left' ? 'left' : 'right',
    ...extra,
  }
  switch (type) {
    case 'bars':
      return { ...base, upColor: css(s.up), downColor: css(s.down), thinBars: s.thinBars, openVisible: true }
    case 'line':
      return { ...base, color: css(s.lineColor), lineWidth: s.lineWidth, lineType: LINE_TYPE[s.lineType] }
    case 'area':
      return { ...base, lineColor: css(s.lineColor), lineWidth: s.lineWidth, lineType: LINE_TYPE[s.lineType], topColor: css(s.areaTop), bottomColor: css(s.areaBottom) }
    case 'baseline': {
      const up = s.baseColorUp, dn = s.baseColorDown
      return {
        ...base, lineWidth: s.lineWidth, topLineColor: css(up), bottomLineColor: css(dn),
        topFillColor1: css(withAlpha(up, 0.28)), topFillColor2: css(withAlpha(up, 0.04)),
        bottomFillColor1: css(withAlpha(dn, 0.04)), bottomFillColor2: css(withAlpha(dn, 0.28)),
      }
    }
    default: { // candles | hollow | heikin
      const hollow = type === 'hollow'
      const bodyUp = hollow ? CLEAR : css(s.up)
      return {
        ...base,
        upColor: s.bodyOn ? bodyUp : CLEAR,
        downColor: s.bodyOn ? css(s.down) : CLEAR,
        borderVisible: s.borderOn || hollow,
        borderUpColor: css(hollow && !s.borderOn ? s.up : s.borderUp),
        borderDownColor: css(hollow && !s.borderOn ? s.down : s.borderDown),
        wickVisible: s.wickOn,
        wickUpColor: css(s.wickUp),
        wickDownColor: css(s.wickDown),
      }
    }
  }
}

// ── chart-level options ──────────────────────────────────────────────────
export function chartOptions(cs, { tzSec = 0 } = {}) {
  const c = cs.canvas, sc = cs.scales
  const grad = c.bgType === 'gradient'
  const grid = (on, color, style) => ({ visible: on, color: css(color), style: LINE_STYLE[style] })
  const cross = (labels) => ({
    color: css(sc.crosshairColor), width: sc.crosshairWidth, style: LINE_STYLE[sc.crosshairStyle], labelVisible: labels,
    labelBackgroundColor: css(sc.crosshairColor),
  })
  const margins = { top: sc.marginTop, bottom: sc.marginBottom }
  const scale = (visible) => ({
    visible, mode: SCALE_MODE[sc.mode], autoScale: sc.autoScale, invertScale: sc.invert, alignLabels: sc.noOverlap,
    borderVisible: sc.borderVisible, borderColor: css(c.borderColor), scaleMargins: margins, textColor: css(c.textColor),
  })
  const left = sc.placement === 'left'
  return {
    layout: {
      background: grad ? { type: 'gradient', topColor: css(c.bg), bottomColor: css(c.bg2) } : { type: 'solid', color: css(c.bg) },
      textColor: css(c.textColor), fontSize: c.fontSize,
      panes: { separatorColor: css(c.paneSep), separatorHoverColor: css(c.borderColor) },
    },
    grid: { vertLines: grid(c.gridV, c.gridVColor, c.gridVStyle), horzLines: grid(c.gridH, c.gridHColor, c.gridHStyle) },
    crosshair: { mode: CROSSHAIR_MODE[sc.crosshairMode], vertLine: cross(sc.crosshairLabels), horzLine: cross(sc.crosshairLabels) },
    rightPriceScale: scale(!left),
    leftPriceScale: scale(left),
    handleScale: { axisPressedMouseMove: { time: true, price: !sc.lock }, axisDoubleClickReset: { time: true, price: !sc.lock } },
    handleScroll: { vertTouchDrag: !sc.lock },
    timeScale: {
      borderVisible: sc.borderVisible, borderColor: css(c.borderColor), timeVisible: true, secondsVisible: sc.seconds,
      barSpacing: sc.barSpacing, rightOffset: sc.rightOffset, shiftVisibleRangeOnNewBar: true, rightBarStaysOnScroll: sc.lockLast,
      tickMarkFormatter: (time, type) => {
        const t = typeof time === 'number' ? time : 0
        if (type === 3 || type === 4) return formatTime(t, sc.h24, type === 4)
        return formatDate(t, sc.dateFormat)
      },
    },
    localization: {
      dateFormat: sc.dateFormat === 'dd MMM yy' ? "dd MMM 'yy" : sc.dateFormat,
      timeFormatter: (time) => `${formatDate(time, sc.dateFormat)}  ${formatTime(time, sc.h24, sc.seconds)}`,
    },
    _tzSec: tzSec, // not an option — kept so callers can see which offset the data was built with
  }
}

export function applyChartSettings(chart, series, cs, { type, inst, tzSec = 0 } = {}) {
  if (chart) {
    const { _tzSec, ...opts } = chartOptions(cs, { tzSec })
    void _tzSec
    chart.applyOptions(opts)
  }
  if (series && type && inst) {
    const { priceScaleId, ...rest } = seriesOptions(type, cs, inst)
    void priceScaleId // the scale a series lives on cannot change after creation (the series is rebuilt)
    series.applyOptions(rest)
  }
}

// The text lines of the watermark for the current symbol / timeframe ([] = hidden).
export function watermarkLines(cs, symbol, tfLabel) {
  const c = cs.canvas
  const text = c.wmMode === 'symbol' ? symbol : c.wmMode === 'symbolTf' ? `${symbol} · ${tfLabel}` : c.wmMode === 'custom' ? c.wmText : ''
  if (!text) return []
  return [{ text, color: css(withAlpha(c.wmColor, c.wmOpacity)), fontSize: c.wmSize }]
}
export const WM_ALIGN = { center: ['center', 'center'], tl: ['left', 'top'], tr: ['right', 'top'], bl: ['left', 'bottom'], br: ['right', 'bottom'] }
