// Phase 9 (pure logic): chart settings validation / merge / themes, Heikin Ashi + colour-by-previous-close
// transforms (hand-calculated), the option objects pushed into the chart (stub chart), time zone + format helpers.
import './fixtures/legacyInstruments.js'
import * as C from '../src/lib/terminal/chartSettings.js'
import * as A from '../src/lib/terminal/chartApply.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol
const D = C.DEFAULT_CHART_SETTINGS

// ── defaults & validation ────────────────────────────────────────────────
check('defaults are a fixpoint of cleanChartSettings', JSON.stringify(C.cleanChartSettings(D)) === JSON.stringify(D))
check('cleanChartSettings(null / junk / array) = defaults', JSON.stringify(C.cleanChartSettings(null)) === JSON.stringify(D) && JSON.stringify(C.cleanChartSettings('x')) === JSON.stringify(D) && JSON.stringify(C.cleanChartSettings([1])) === JSON.stringify(D))
const bad = C.cleanChartSettings({ theme: 'nope', symbol: { up: 'red', down: '#12345', lineWidth: 99, precision: '12', tz: 'Mars/Base', colorByPrev: 'yes' }, canvas: { fontSize: 2, bg: '#ABCDEF', wmOpacity: 5, wmText: 'x'.repeat(200), gridVStyle: 'wavy' }, scales: { barSpacing: -4, mode: 'sqrt', dateFormat: 'x' }, extra: { a: 1 } })
check('bad enum falls back', bad.theme === 'dark' && bad.symbol.precision === 'auto' && bad.symbol.tz === 'local' && bad.scales.mode === 'normal' && bad.scales.dateFormat === 'dd MMM yy' && bad.canvas.gridVStyle === 'solid')
check('bad colour falls back, good hex is kept (lower-cased)', bad.symbol.up === D.symbol.up && bad.symbol.down === D.symbol.down && bad.canvas.bg === '#abcdef')
check('numbers are clamped to their range', bad.symbol.lineWidth === 6 && bad.canvas.fontSize === 8 && bad.canvas.wmOpacity === 0.5 && bad.scales.barSpacing === 2)
check('non-boolean for a boolean falls back; long text is cut; unknown keys dropped', bad.symbol.colorByPrev === false && bad.canvas.wmText.length === 60 && bad.extra === undefined)
check('8-digit hex (with alpha) is accepted', C.cleanChartSettings({ symbol: { areaTop: '#11223344' } }).symbol.areaTop === '#11223344')
check('every leaf of the defaults has a validator (enum/range/hex/bool)', (() => {
  // flipping every boolean / mutating every leaf to garbage must always come back to a valid object
  const junk = JSON.parse(JSON.stringify(D), (k, v) => (typeof v === 'boolean' ? 'x' : typeof v === 'number' ? 'x' : typeof v === 'string' ? 12 : v))
  return JSON.stringify(C.cleanChartSettings(junk)) === JSON.stringify(D)
})())

// ── merge ────────────────────────────────────────────────────────────────
const m = C.mergeChartSettings(D, { canvas: { bg: '#000000' }, scales: { mode: 'log' } })
check('merge changes only the given leaves', m.canvas.bg === '#000000' && m.scales.mode === 'log' && m.canvas.textColor === D.canvas.textColor && m.symbol.up === D.symbol.up)
check('merge re-validates and keeps the previous value on a bad one', C.mergeChartSettings(D, { scales: { mode: 'nope' } }).scales.mode === 'normal' && C.mergeChartSettings(m, { scales: { mode: 'nope' } }).scales.mode === 'log' && C.mergeChartSettings(m, { canvas: { bg: 'banana' } }).canvas.bg === '#000000')
check('merge does not mutate its input', D.canvas.bg === '#0f1419' && D.scales.mode === 'normal')

// ── themes ───────────────────────────────────────────────────────────────
for (const id of C.THEME_IDS) {
  const t = C.withTheme(D, id)
  check(`theme ${id}: result is valid and records the id`, t.theme === id && JSON.stringify(C.cleanChartSettings(t)) === JSON.stringify(t))
}
check('dark theme leaves the default look unchanged', JSON.stringify(C.withTheme(D, 'dark')) === JSON.stringify(D))
check('light theme: light chrome + white canvas', C.chromeOf(C.withTheme(D, 'light')).light === true && C.withTheme(D, 'light').canvas.bg === '#ffffff')
check('theme keeps the person\'s candle colours (except matrix)', C.withTheme(C.mergeChartSettings(D, { symbol: { up: '#00ff00' } }), 'midnight').symbol.up === '#00ff00' && C.withTheme(D, 'matrix').symbol.up === '#22ff88')
check("'system' follows the OS", C.chromeOf(C.withTheme(D, 'system', false), false).light === true && C.chromeOf(C.withTheme(D, 'system', true), true).light === false && C.withTheme(D, 'system', false).theme === 'system')
check('withTheme(unknown) is a no-op', C.withTheme(D, 'zzz') === D)

// ── helpers ──────────────────────────────────────────────────────────────
check('css(#rrggbbaa) -> rgba()', C.css('#ff000080') === 'rgba(255,0,0,0.502)' && C.css('#ff0000') === '#ff0000')
check('withAlpha / alphaOf round trip', C.withAlpha('#336699', 1) === '#336699' && C.withAlpha('#336699', 0).endsWith('00') && near(C.alphaOf(C.withAlpha('#336699', 0.5)), 128 / 255))
check('tz offsets: UTC = 0, India = +19800, New York in {-18000,-14400}', C.tzOffsetSec('UTC') === 0 && C.tzOffsetSec('Asia/Kolkata') === 19800 && [-18000, -14400].includes(C.tzOffsetSec('America/New_York')))
check('tz offset follows DST (London summer +3600, winter 0)', C.tzOffsetSec('Europe/London', Date.UTC(2026, 6, 1)) === 3600 && C.tzOffsetSec('Europe/London', Date.UTC(2026, 0, 15)) === 0)
check('unknown zone -> 0 (no crash)', C.tzOffsetSec('Mars/Base') === 0)
const ts = Date.UTC(2026, 9, 12, 15, 5, 9) / 1000 // 2026-10-12 15:05:09
check('formatDate: all four formats', C.formatDate(ts, 'dd MMM yy') === '12 Oct 26' && C.formatDate(ts, 'dd-MM-yyyy') === '12-10-2026' && C.formatDate(ts, 'MM-dd-yyyy') === '10-12-2026' && C.formatDate(ts, 'yyyy-MM-dd') === '2026-10-12')
check('formatTime: 24h / 12h / seconds', C.formatTime(ts, true, false) === '15:05' && C.formatTime(ts, true, true) === '15:05:09' && C.formatTime(ts, false, false) === '3:05 PM' && C.formatTime(Date.UTC(2026, 0, 1, 0, 7) / 1000, false, false) === '12:07 AM')

// ── Heikin Ashi (hand-calculated) ────────────────────────────────────────
{
  const bars = [
    { time: 1, open: 10, high: 12, low: 9, close: 11 },
    { time: 2, open: 11, high: 14, low: 10, close: 13 },
  ]
  const ha = A.heikinAll(bars)
  // bar 1: close = (10+12+9+11)/4 = 10.5 ; open = (10+11)/2 = 10.5
  check('HA bar 1: close = avg(OHLC), open = avg(open, close)', near(ha[0].close, 10.5) && near(ha[0].open, 10.5) && near(ha[0].high, 12) && near(ha[0].low, 9))
  // bar 2: close = (11+14+10+13)/4 = 12 ; open = (10.5+10.5)/2 = 10.5 ; high = max(14, 10.5, 12) = 14 ; low = min(10, 10.5, 12) = 10
  check('HA bar 2 uses the previous HA bar', near(ha[1].close, 12) && near(ha[1].open, 10.5) && near(ha[1].high, 14) && near(ha[1].low, 10))
  check('incremental heikinBar equals heikinAll', JSON.stringify(A.heikinBar(bars[1], ha[0])) === JSON.stringify(ha[1]))
  check('HA of an empty list', A.heikinAll([]).length === 0)
}

// ── point builders ───────────────────────────────────────────────────────
{
  const k = { open: 10, high: 12, low: 9, close: 11 }
  check('candle point: plain OHLC, no per-bar colours by default', JSON.stringify(A.pointOf('candles', k, 100, D, 10)) === JSON.stringify({ time: 100, open: 10, high: 12, low: 9, close: 11 }))
  const cs = C.mergeChartSettings(D, { symbol: { colorByPrev: true } })
  const upBar = A.pointOf('candles', { open: 10, high: 12, low: 9, close: 9.5 }, 1, cs, 9) // red candle but closes ABOVE previous close -> up colour
  check('colour by previous close: close above prev close = up colour even when the bar is red', upBar.color === cs.symbol.up && upBar.wickColor === cs.symbol.wickUp)
  const dnBar = A.pointOf('candles', { open: 10, high: 12, low: 9, close: 11 }, 1, cs, 11.5)
  check('…close below prev close = down colour', dnBar.color === cs.symbol.down)
  check('…first bar (no previous close) keeps default colouring', A.pointOf('candles', k, 1, cs, null).color === undefined)
  check('hollow + colour-by-prev: up bars have a transparent body', A.pointOf('hollow', k, 1, cs, 10).color === 'rgba(0,0,0,0)')
  check('bars + colour-by-prev: only the bar colour is set', A.pointOf('bars', k, 1, cs, 12).color === cs.symbol.down && A.pointOf('bars', k, 1, cs, 12).borderColor === undefined)
  check('line / area / baseline points follow the price source', A.pointOf('line', k, 5, D, 0).value === 11 && A.pointOf('area', k, 5, C.mergeChartSettings(D, { symbol: { lineSource: 'hl2' } }), 0).value === 10.5 && A.pointOf('baseline', k, 5, C.mergeChartSettings(D, { symbol: { lineSource: 'open' } }), 0).value === 10)
}

// ── series options ───────────────────────────────────────────────────────
{
  const inst = { digits: 5 }
  const so = (type, patch = {}) => A.seriesOptions(type, C.mergeChartSettings(D, patch), inst)
  check('series class per chart type', A.seriesClassOf('candles') === 'Candlestick' && A.seriesClassOf('hollow') === 'Candlestick' && A.seriesClassOf('heikin') === 'Candlestick' && A.seriesClassOf('bars') === 'Bar' && A.seriesClassOf('line') === 'Line' && A.seriesClassOf('area') === 'Area' && A.seriesClassOf('baseline') === 'Baseline')
  check('precision: auto = instrument digits, explicit overrides', so('candles').priceFormat.precision === 5 && so('candles', { symbol: { precision: '2' } }).priceFormat.precision === 2 && so('candles', { symbol: { precision: '2' } }).priceFormat.minMove === 0.01)
  check('hollow candles: up body transparent, border drawn in the up colour', so('hollow').upColor === 'rgba(0,0,0,0)' && so('hollow').borderVisible === true && so('hollow').borderUpColor === D.symbol.up)
  check('candle toggles: body off -> transparent, wick off -> hidden, border on -> visible', so('candles', { symbol: { bodyOn: false } }).upColor === 'rgba(0,0,0,0)' && so('candles', { symbol: { wickOn: false } }).wickVisible === false && so('candles', { symbol: { borderOn: true } }).borderVisible === true && so('candles').borderVisible === false)
  check('last price label / line options', so('line', { scales: { lastLabel: false, lastLine: false } }).lastValueVisible === false && so('line', { scales: { lastLine: false } }).priceLineVisible === false)
  check('placement left puts the series on the left scale', so('line', { scales: { placement: 'left' } }).priceScaleId === 'left' && so('line').priceScaleId === 'right')
  check('line type / width map to the library values', so('line', { symbol: { lineType: 'curved', lineWidth: 3 } }).lineType === 2 && so('line', { symbol: { lineType: 'steps' } }).lineType === 1 && so('line', { symbol: { lineWidth: 3 } }).lineWidth === 3)
  check('area alpha colours are converted to rgba()', so('area').topColor.startsWith('rgba(') )
  check('baseline has both fills', typeof so('baseline').topFillColor1 === 'string' && typeof so('baseline').bottomFillColor2 === 'string')
}

// ── chart options (what is pushed into the chart) ────────────────────────
{
  const o = (patch = {}) => A.chartOptions(C.mergeChartSettings(D, patch))
  check('solid vs gradient background', o().layout.background.type === 'solid' && o({ canvas: { bgType: 'gradient' } }).layout.background.type === 'gradient' && o({ canvas: { bgType: 'gradient' } }).layout.background.bottomColor === D.canvas.bg2)
  check('grid: visibility, colour and line style per direction', o({ canvas: { gridV: false } }).grid.vertLines.visible === false && o().grid.horzLines.visible === true && o({ canvas: { gridHStyle: 'dotted' } }).grid.horzLines.style === 1 && o({ canvas: { gridHStyle: 'dashed' } }).grid.horzLines.style === 2)
  check('price scale mode / invert / auto / margins', o({ scales: { mode: 'log' } }).rightPriceScale.mode === 1 && o({ scales: { mode: 'percent' } }).rightPriceScale.mode === 2 && o({ scales: { mode: 'index100' } }).rightPriceScale.mode === 3 && o({ scales: { invert: true } }).rightPriceScale.invertScale === true && o({ scales: { autoScale: false } }).rightPriceScale.autoScale === false && o({ scales: { marginTop: 0.2 } }).rightPriceScale.scaleMargins.top === 0.2)
  check('placement left shows the left scale and hides the right', o({ scales: { placement: 'left' } }).leftPriceScale.visible === true && o({ scales: { placement: 'left' } }).rightPriceScale.visible === false && o().rightPriceScale.visible === true)
  check('lock scale disables price-axis dragging', o({ scales: { lock: true } }).handleScale.axisPressedMouseMove.price === false && o().handleScale.axisPressedMouseMove.price === true)
  check('crosshair mode / style / labels', o({ scales: { crosshairMode: 'magnet' } }).crosshair.mode === 3 && o().crosshair.mode === 0 && o({ scales: { crosshairLabels: false } }).crosshair.vertLine.labelVisible === false && o({ scales: { crosshairStyle: 'solid' } }).crosshair.horzLine.style === 0)
  check('time scale: spacing, offset, seconds', o({ scales: { barSpacing: 12, rightOffset: 3, seconds: true } }).timeScale.barSpacing === 12 && o({ scales: { rightOffset: 3 } }).timeScale.rightOffset === 3 && o({ scales: { seconds: true } }).timeScale.secondsVisible === true)
  const tf = o({ scales: { h24: false, dateFormat: 'yyyy-MM-dd', seconds: true } })
  check('tick + crosshair time formatters honour clock / date format', tf.timeScale.tickMarkFormatter(ts, 3) === '3:05 PM' && tf.timeScale.tickMarkFormatter(ts, 4) === '3:05:09 PM' && tf.timeScale.tickMarkFormatter(ts, 2) === '2026-10-12' && tf.localization.timeFormatter(ts) === '2026-10-12  3:05:09 PM')
  check('text colour + font size', o({ canvas: { textColor: '#112233', fontSize: 14 } }).layout.textColor === '#112233' && o({ canvas: { fontSize: 14 } }).layout.fontSize === 14)
}

// ── applyChartSettings drives a (stub) chart + series ────────────────────
{
  const calls = { chart: [], series: [] }
  const chart = { applyOptions: (x) => calls.chart.push(x) }
  const series = { applyOptions: (x) => calls.series.push(x) }
  const cs = C.mergeChartSettings(D, { canvas: { bg: '#010203' }, symbol: { up: '#00ff00' } })
  A.applyChartSettings(chart, series, cs, { type: 'candles', inst: { digits: 2 } })
  check('applyChartSettings pushes ONE chart options object + ONE series options object', calls.chart.length === 1 && calls.series.length === 1)
  check('…with the new colours, and without private / unchangeable keys', calls.chart[0].layout.background.color === '#010203' && calls.series[0].upColor === '#00ff00' && calls.chart[0]._tzSec === undefined && calls.series[0].priceScaleId === undefined)
  A.applyChartSettings(null, null, cs, {})
  check('applyChartSettings tolerates a missing chart / series', true)
}

// ── watermark ────────────────────────────────────────────────────────────
{
  const w = (patch) => A.watermarkLines(C.mergeChartSettings(D, patch), 'EURUSD', '5m')
  check('watermark: off = no lines; symbol; symbol + timeframe; custom; empty custom', w({}).length === 0 && w({ canvas: { wmMode: 'symbol' } })[0].text === 'EURUSD' && w({ canvas: { wmMode: 'symbolTf' } })[0].text === 'EURUSD · 5m' && w({ canvas: { wmMode: 'custom', wmText: 'Hi' } })[0].text === 'Hi' && w({ canvas: { wmMode: 'custom', wmText: '' } }).length === 0)
  check('watermark colour carries the opacity', w({ canvas: { wmMode: 'symbol', wmOpacity: 0.2 } })[0].color.startsWith('rgba(255,255,255,0.2'))
  check('watermark alignment table covers every position', ['center', 'tl', 'tr', 'bl', 'br'].every((p) => A.WM_ALIGN[p]?.length === 2))
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
