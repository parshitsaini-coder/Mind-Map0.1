import { useEffect, useState } from 'react'
import { LineSeries, HistogramSeries, LineStyle } from 'lightweight-charts'
import { INDICATORS } from '../../lib/terminal/indicators'
import { computeAll } from '../../lib/terminal/indicatorClient'
import { toSeriesData, lastValue, fmtIndicator } from '../../lib/terminal/indicatorSeries'
import { TZ } from './chartConst'

const REFRESH_MS = 500 // live candles → indicators at most twice a second

// Draws the active indicators on the chart: overlays share the candles' pane, each
// oscillator gets its own pane underneath. Maths runs in a Worker (see indicatorClient).
// Series are rebuilt only when the configuration / symbol / timeframe changes;
// live ticks just refresh their data. Returns { [indicatorId]: "last value text" } for the legend.
export default function useIndicatorSeries({ chartRef, seriesRef, dataRef, indicators, symbol, timeframe, chartType }) {
  const [legend, setLegend] = useState({})

  useEffect(() => {
    const chart = chartRef.current
    const main = seriesRef.current
    if (!chart || !main) return undefined
    const visible = indicators.filter((i) => i.visible && INDICATORS[i.type])
    if (!visible.length) {
      setLegend((l) => (Object.keys(l).length ? {} : l))
      return undefined
    }

    const made = []
    let sub = 0
    for (const cfg of visible) {
      const def = INDICATORS[cfg.type]
      const pane = def.pane === 'sub' ? ++sub : 0
      const lines = def.lines.map((spec) => {
        const color = spec.fixed || cfg.color
        let series
        if (spec.kind === 'hist') {
          series = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, base: 0 }, pane)
        } else {
          series = chart.addSeries(
            LineSeries,
            {
              color, lineWidth: spec.dim ? 1 : 2, priceLineVisible: false, lastValueVisible: pane > 0 && !spec.dim, crosshairMarkerVisible: false,
              ...(def.noAutoscale ? { autoscaleInfoProvider: () => null } : {}),
              ...(def.range ? { autoscaleInfoProvider: () => ({ priceRange: { minValue: def.range[0], maxValue: def.range[1] } }) } : {}),
            },
            pane,
          )
        }
        return { spec, series }
      })
      if (def.levels && lines[0]) for (const price of def.levels) lines[0].series.createPriceLine({ price, color: '#475569', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' })
      made.push({ cfg, def, lines })
    }
    try {
      const panes = chart.panes()
      panes[0]?.setStretchFactor(sub ? 3 : 1)
      for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1)
    } catch { /* older chart build without pane API */ }

    let alive = true
    let lastVer = -1
    let busy = false
    const run = async () => {
      const d = dataRef.current
      if (!alive || busy || !d.candles.length || d.ver === lastVer) return
      busy = true
      const ver = d.ver
      const snapshot = d.candles.slice()
      const results = await computeAll(made.map((m) => ({ id: m.cfg.id, type: m.cfg.type, params: m.cfg.params })), snapshot, { tfSec: d.tfSec })
      busy = false
      if (!alive) return
      lastVer = ver
      const times = snapshot.map((k) => k.time)
      const leg = {}
      for (const m of made) {
        const res = results[m.cfg.id]
        const vals = []
        for (const { spec, series } of m.lines) {
          const arr = res?.[spec.key]
          try {
            series.setData(arr ? toSeriesData(arr, times, d.tfSec, { shift: spec.shift || 0, offset: TZ, hist: spec.kind === 'hist' ? { up: '#22c55e99', down: '#ef444499' } : null }) : [])
          } catch { /* series removed while computing */ }
          if (arr && !spec.dim && spec.kind !== 'hist' && vals.length < 2) vals.push(fmtIndicator(lastValue(arr)))
        }
        leg[m.cfg.id] = res ? vals.join('  ') : m.def.needsVolume ? 'no volume data' : ''
      }
      setLegend(leg)
    }
    run()
    const timer = setInterval(run, REFRESH_MS)

    return () => {
      alive = false
      clearInterval(timer)
      if (!chartRef.current) return // whole chart already disposed
      for (const m of made) for (const { series } of m.lines) {
        try { chart.removeSeries(series) } catch { /* already gone */ }
      }
    }
  }, [chartRef, seriesRef, dataRef, indicators, symbol, timeframe, chartType])

  return legend
}
