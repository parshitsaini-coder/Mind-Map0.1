import { useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { TIMEFRAMES, INSTRUMENTS } from '../../lib/terminal/instruments'
import { useLiveHistory } from './hooks'
import { tzOffsetSec } from '../../lib/terminal/chartSettings'
import { fmtMoney } from './format'

// Hover tooltip for the execution arrows: price, lots and P/L of the trade(s) on the bar under the cursor.
export default function ExecTooltip({ chartRef, symbol, timeframe, tz }) {
  const show = useTerminalStore((s) => s.chartSettings.trading.showExecutions)
  const history = useLiveHistory()
  const positions = useTerminalStore((s) => s.positions)
  const [tip, setTip] = useState(null)
  const dataRef = useRef([])

  useEffect(() => {
    const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]
    const sec = tf.minutes * 60
    const off = tzOffsetSec(tz)
    const at = (t) => Math.floor(t / sec) * sec + off
    const d = INSTRUMENTS[symbol].digits
    const out = []
    for (const h of history.filter((x) => x.symbol === symbol).slice(0, 150)) {
      out.push({ time: at(h.openTime), text: `${h.side.toUpperCase()} ${h.lots} opened @ ${h.entry?.toFixed(d) ?? '—'}` })
      out.push({ time: at(h.closeTime), text: `Closed ${h.lots} @ ${h.exit?.toFixed(d) ?? '—'} · ${fmtMoney(h.pnl, { sign: true })}` })
    }
    for (const p of positions.filter((x) => x.symbol === symbol)) out.push({ time: at(p.openTime), text: `${p.side.toUpperCase()} ${p.lots} opened @ ${p.entry.toFixed(d)} (open)` })
    dataRef.current = out
  }, [history, positions, symbol, timeframe, tz])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !show) { setTip(null); return undefined }
    const onMove = (param) => {
      if (!param?.point || param.time == null) { setTip(null); return }
      const hits = dataRef.current.filter((x) => x.time === param.time)
      setTip(hits.length ? { x: param.point.x, y: param.point.y, lines: hits.map((h) => h.text) } : null)
    }
    chart.subscribeCrosshairMove(onMove)
    return () => { try { chart.unsubscribeCrosshairMove(onMove) } catch { /* disposed */ } }
  }, [chartRef, show, symbol])

  if (!tip) return null
  return (
    <div role="tooltip" data-testid="exec-tooltip" className="pointer-events-none absolute z-[9] max-w-[260px] rounded-md border px-2 py-1 text-[11px] shadow-lg"
      style={{ left: Math.max(4, tip.x + 12), top: Math.max(4, tip.y - 40), backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>
      {tip.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}
