import { useEffect } from 'react'
import { LineSeries, HistogramSeries } from 'lightweight-charts'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import { INDICATOR_DEFS } from '../../lib/terminal/indicators'
import { createIndicatorEngine } from '../../lib/terminal/indicatorClient'
import { CANDLE_CAP, CANDLE_TRIM } from '../../lib/terminal/indicatorCore'
import { createFillPrimitive } from './chartPrimitives'
import { TZ } from './chartConst'

const hexA = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return `rgba(148,163,184,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

// Renders nothing in the DOM. Builds the indicator series (and sub-panes) on the chart, asks the
// worker for the maths, paints the result and keeps the last point live as ticks arrive.
export default function IndicatorLayer({ chartRef, seriesRef, candlesRef, busRef, symbol, timeframe, ver }) {
  const indicators = useTerminalStore((s) => s.indicators)

  useEffect(() => {
    const chart = chartRef.current
    const main = seriesRef.current
    const initial = candlesRef.current
    const active = indicators.filter((i) => i.visible && INDICATOR_DEFS[i.type])
    if (!chart || !main || !initial?.length || !active.length) return undefined

    const inst = INSTRUMENTS[symbol]
    const tfMin = (TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).minutes
    const tfSec = tfMin * 60
    const digits = inst.digits
    const priceFormat = { type: 'price', precision: digits, minMove: 10 ** -digits }
    const smallFormat = { type: 'price', precision: 2, minMove: 0.01 }

    let cs = initial.slice() // raw candles, grows as new bars open
    const plotTime = (idx) => (idx < cs.length ? cs[idx].time + TZ : cs[cs.length - 1].time + TZ + (idx - (cs.length - 1)) * tfSec)

    // ── build the series ──
    const built = [] // { cfg, def, lines: { key: { series, shift, kind } }, fill?, fillPrim? }
    let paneIdx = 0
    const created = []
    try {
      for (const cfg of active) {
        const def = INDICATOR_DEFS[cfg.type]
        const pane = def.where === 'pane' ? ++paneIdx : 0
        const lines = {}
        for (const ln of def.lines) {
          const color = cfg.colors?.[ln.key] || ln.color
          const common = { priceLineVisible: false, lastValueVisible: pane > 0 && ln.kind !== 'hist', crosshairMarkerVisible: false }
          if (def.fixed) common.autoscaleInfoProvider = () => ({ priceRange: { minValue: def.fixed[0], maxValue: def.fixed[1] } })
          else if (def.noAutoscale) common.autoscaleInfoProvider = () => null
          const fmt = cfg.type === 'rsi' || cfg.type === 'stoch' ? smallFormat : priceFormat
          const s = ln.kind === 'hist'
            ? chart.addSeries(HistogramSeries, { ...common, priceFormat: fmt, base: 0 }, pane)
            : chart.addSeries(LineSeries, { ...common, priceFormat: fmt, color, lineWidth: ln.width || 1, lineStyle: ln.dash ? 2 : 0 }, pane)
          created.push(s)
          lines[ln.key] = { series: s, kind: ln.kind || 'line', color }
        }
        if (def.levels) {
          const first = lines[def.lines[def.lines.length > 1 && def.lines[0].kind === 'hist' ? 1 : 0].key].series
          for (const lv of def.levels) first.createPriceLine({ price: lv, color: '#475569', lineWidth: 1, lineStyle: 2, axisLabelVisible: false })
        }
        const entry = { cfg, def, lines, shifts: {}, vals: {} }
        if (def.fill) {
          entry.fillPrim = createFillPrimitive()
          lines[def.fill.top].series.attachPrimitive(entry.fillPrim.prim)
        }
        if (def.cloud) {
          entry.fillPrim = createFillPrimitive()
          lines[def.cloud.a].series.attachPrimitive(entry.fillPrim.prim)
        }
        built.push(entry)
      }
      if (paneIdx > 0) {
        const panes = chart.panes()
        panes[0].setStretchFactor(3)
        for (let i = 1; i <= paneIdx; i++) panes[i]?.setStretchFactor(1)
      }
    } catch (err) {
      console.warn('[terminal] indicator setup failed', err)
    }

    // value array indexed by logical bar (applies the line's shift)
    const placed = (vals, shift, n) => {
      const out = new Array(Math.max(0, n + Math.max(0, shift))).fill(null)
      for (let i = 0; i < vals.length; i++) {
        const idx = i + shift
        if (idx >= 0 && idx < out.length) out[idx] = vals[i]
      }
      return out
    }

    const histColor = (v, prev) => {
      const up = v >= 0
      const grow = prev == null || Math.abs(v) >= Math.abs(prev)
      return up ? (grow ? '#22c55e' : 'rgba(34,197,94,0.5)') : grow ? '#ef4444' : 'rgba(239,68,68,0.5)'
    }

    const paintFull = (results, n) => {
      for (const r of results) {
        const e = built.find((b) => b.cfg.id === r.id)
        if (!e) continue
        for (const ln of e.def.lines) {
          const vals = r.lines[ln.key]
          const L = e.lines[ln.key]
          if (!vals || !L) continue
          const shift = r.shifts?.[ln.key] || 0
          e.shifts[ln.key] = shift
          e.vals[ln.key] = placed(vals, shift, n)
          const data = []
          for (let i = 0; i < vals.length; i++) {
            const idx = i + shift
            if (idx < 0) continue
            const time = plotTime(idx)
            const v = vals[i]
            if (v == null) data.push({ time })
            else if (L.kind === 'hist') data.push({ time, value: v, color: histColor(v, vals[i - 1]) })
            else data.push({ time, value: v })
          }
          try { L.series.setData(data) } catch { /* series removed while the reply was in flight */ }
        }
        if (e.fillPrim) {
          const f = e.def.fill
          const c = e.def.cloud
          const ka = f ? f.top : c.a
          const kb = f ? f.bottom : c.b
          e.fillPrim.set({
            n: Math.max(e.vals[ka].length, e.vals[kb].length), a: e.vals[ka], b: e.vals[kb], mode: f ? 'band' : 'cloud',
            color: hexA(e.lines[ka].color, 0.1), up: hexA('#22c55e', 0.16), down: hexA('#ef4444', 0.16),
          })
        }
      }
    }

    const paintTail = (tail, n) => {
      for (const t of tail) {
        const e = built.find((b) => b.cfg.id === t.id)
        if (!e) continue
        for (const ln of e.def.lines) {
          const L = e.lines[ln.key]
          const v = t.v[ln.key]
          const shift = e.shifts[ln.key] || 0
          const idx = n - 1 + shift
          if (!L || idx < 0) continue
          const time = plotTime(idx)
          try {
            if (v == null) L.series.update({ time })
            else if (L.kind === 'hist') L.series.update({ time, value: v, color: histColor(v, e.vals[ln.key]?.[idx - 1]) })
            else L.series.update({ time, value: v })
          } catch { /* ignore: older than the last point */ }
          if (e.vals[ln.key] && idx < e.vals[ln.key].length) e.vals[ln.key][idx] = v
        }
        e.fillPrim?.prim.refresh()
      }
    }

    const ctx = { tz: TZ, tfMinutes: tfMin }
    const cfgs = built.map((b) => ({ id: b.cfg.id, type: b.cfg.type, params: b.cfg.params }))
    const engine = createIndicatorEngine((msg) => {
      if (msg.error) { console.warn('[terminal] indicator error', msg.error); return }
      if (msg.n !== cs.length) { engine.init(cs, cfgs, ctx); return } // out of step -> recompute from scratch
      if (msg.full) paintFull(msg.results, msg.n)
      else paintTail(msg.tail, msg.n)
    })
    engine.init(cs, cfgs, ctx)

    busRef.current = (candle, isNew) => {
      if (isNew) {
        cs.push(candle)
        if (cs.length > CANDLE_CAP) cs = cs.slice(CANDLE_TRIM)
      } else if (cs.length) cs[cs.length - 1] = candle
      engine.tick(candle, isNew)
    }

    return () => {
      busRef.current = null
      engine.dispose()
      for (const s of created) { try { chart.removeSeries(s) } catch { /* chart already disposed */ } }
      try { for (let i = chart.panes().length - 1; i > 0; i--) chart.removePane(i) } catch { /* ignore */ }
    }
  }, [indicators, symbol, timeframe, ver, chartRef, seriesRef, candlesRef, busRef])

  return null
}
