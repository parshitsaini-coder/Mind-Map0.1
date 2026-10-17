import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Eye, EyeOff, Settings2, X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import { useFeedStatus } from './hooks'
import { marketStatus } from '../../lib/terminal/marketHours'
import { INDICATOR_DEFS } from '../../lib/terminal/indicators'
import { tzOffsetSec } from '../../lib/terminal/chartSettings'
import * as E from '../../lib/terminal/engine'
import { useQuote } from './hooks'
import { fmtMoney } from './format'

// Binary search of the loaded candles by (UTC) time.
function findCandle(candles, t) {
  let lo = 0, hi = candles.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = candles[mid].time
    if (v === t) return mid
    if (v < t) lo = mid + 1; else hi = mid - 1
  }
  return -1
}

// The status line (top-left of a chart) and the "time to bar close" label on the price scale.
export default function ChartHud({ chartRef, seriesRef, candlesRef, valsRef, live, symbol, timeframe, ver, cs, offsetTop = 0 }) {
  const s = cs.status
  const feed = useFeedStatus()
  const inst = INSTRUMENTS[symbol]
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]
  const quote = useQuote(symbol)
  const liveBar = useSyncExternalStore(live.subscribe, live.get) // newest real candle, updates every tick
  const positions = useTerminalStore((st) => st.positions)
  const indicators = useTerminalStore((st) => st.indicators)
  const [hover, setHover] = useState(null) // { k, prevClose } while the crosshair is over a bar
  const cdRef = useRef(null)
  const tz = tzOffsetSec(cs.symbol.tz)

  // crosshair -> hovered bar (one update per animation frame)
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series || !s.ohlc) return undefined
    let raf = 0, pending = null
    const flush = () => {
      raf = 0
      const p = pending
      if (!p || typeof p.time !== 'number') { setHover(null); return }
      const cand = candlesRef.current || []
      const t = p.time - tz
      const i = findCandle(cand, t)
      if (i >= 0) setHover({ k: cand[i], prevClose: i > 0 ? cand[i - 1].close : null, logical: i })
      else if (live.get().last && live.get().last.time === t) setHover({ k: live.get().last, prevClose: live.get().prevClose })
      else setHover(null)
    }
    const onMove = (p) => { pending = p; if (!raf) raf = requestAnimationFrame(flush) }
    chart.subscribeCrosshairMove(onMove)
    return () => { if (raf) cancelAnimationFrame(raf); try { chart.unsubscribeCrosshairMove(onMove) } catch { /* disposed */ } }
  }, [chartRef, seriesRef, candlesRef, live, ver, tz, s.ohlc])

  // countdown label next to the last price
  useEffect(() => {
    const el = cdRef.current
    if (!el || !cs.scales.countdown) return undefined
    const tfSec = tf.minutes * 60
    const tick = () => {
      const series = seriesRef.current
      const chart = chartRef.current
      const last = live.get().last
      if (!series || !chart || !last) { el.style.display = 'none'; return }
      const y = series.priceToCoordinate(last.close)
      if (y == null) { el.style.display = 'none'; return }
      const left = cs.scales.placement === 'left'
      const w = chart.priceScale(left ? 'left' : 'right').width() || 56
      const rem = tfSec - (Math.floor(Date.now() / 1000) % tfSec)
      const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60), sec = rem % 60
      el.textContent = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      el.style.display = 'block'
      el.style.top = `${Math.max(0, y + 11)}px`
      el.style.width = `${w}px`
      el.style[left ? 'left' : 'right'] = '0px'
      el.style[left ? 'right' : 'left'] = 'auto'
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [cs.scales.countdown, cs.scales.placement, tf.minutes, ver, seriesRef, chartRef, live])

  const bar = hover ? hover.k : liveBar.last
  const prevClose = hover ? hover.prevClose : liveBar.prevClose
  const digits = cs.symbol.precision === 'auto' ? inst.digits : Number(cs.symbol.precision)
  const f = (n) => (Number.isFinite(n) ? n.toFixed(digits) : '—')
  const chg = bar && prevClose ? bar.close - prevClose : null
  const pct = chg != null && prevClose ? (chg / prevClose) * 100 : null
  const up = bar ? (chg != null ? chg >= 0 : bar.close >= bar.open) : true
  const col = up ? cs.symbol.up : cs.symbol.down

  const mine = positions.filter((p) => p.symbol === symbol)
  const floating = quote && mine.length ? mine.reduce((a, p) => a + E.pnl(p.side, p.lots, p.entry, E.exitPrice(p.side, quote), inst), 0) : null
  const inds = indicators.filter((i) => INDICATOR_DEFS[i.type])
  const st = useTerminalStore.getState
  const nBars = (candlesRef.current || []).length
  const at = hover?.logical ?? nBars - 1
  const built = valsRef?.current || []
  const fmtV = (type, v) => (v == null ? '—' : type === 'volume' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v))) : INDICATOR_DEFS[type].where === 'pane' ? v.toFixed(2) : v.toFixed(digits))

  const anyTop = s.symbol || s.desc || s.marketDot
  return (
    <>
      <div className="pointer-events-none absolute left-2 z-[6] flex max-w-[calc(100%-90px)] flex-col gap-0.5 text-[11px] leading-tight" style={{ top: 6 + offsetTop, opacity: s.opacity, color: 'var(--tm-text)', textShadow: '0 0 3px var(--tm-chart-bg)' }} aria-label="Chart status line">
        {anyTop && (
          <div className="flex flex-wrap items-center gap-x-2 font-bold">
            {s.symbol && <span>{symbol}</span>}
            {s.desc && <span className="font-normal" style={{ color: 'var(--tm-muted)' }}>{inst.name}</span>}
            <span className="font-normal" style={{ color: 'var(--tm-muted)' }}>{tf.label}</span>
            {s.marketDot && <span data-testid="market-dot" className="flex items-center gap-1 font-normal" title={feed.state === 'closed' ? marketStatus().closedMessage : 'Gold market is open'} style={{ color: 'var(--tm-muted)' }}><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: feed.state === 'closed' ? '#94a3b8' : '#22c55e' }} />{feed.state === 'closed' ? 'Closed' : 'Open'}</span>}
          </div>
        )}
        {s.ohlc && bar && (
          <div className="flex flex-wrap gap-x-2 tabular-nums">
            <span><span style={{ color: 'var(--tm-muted)' }}>O</span> <span style={{ color: col }}>{f(bar.open)}</span></span>
            <span><span style={{ color: 'var(--tm-muted)' }}>H</span> <span style={{ color: col }}>{f(bar.high)}</span></span>
            <span><span style={{ color: 'var(--tm-muted)' }}>L</span> <span style={{ color: col }}>{f(bar.low)}</span></span>
            <span><span style={{ color: 'var(--tm-muted)' }}>C</span> <span style={{ color: col }}>{f(bar.close)}</span></span>
            {s.change && chg != null && <span style={{ color: col }}>{chg >= 0 ? '+' : '−'}{Math.abs(chg).toFixed(digits)} ({pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(2)}%)</span>}
            {s.volume && <span><span style={{ color: 'var(--tm-muted)' }}>Vol</span> {Math.round(bar.volume || 0)}</span>}
          </div>
        )}
        {s.indTitles && inds.length > 0 && (
          <div className="flex flex-col gap-px" data-testid="ind-legend">
            {inds.map((i) => {
              const def = INDICATOR_DEFS[i.type]
              const args = s.indArgs && def.params.length ? `(${def.params.map((p) => i.params?.[p.key] ?? p.def).join(', ')})` : ''
              const entry = built.find((b) => b.cfg.id === i.id)
              return (
                <div key={i.id} className="pointer-events-auto flex items-center gap-1.5" data-testid="ind-row" style={{ opacity: i.visible ? 1 : 0.5 }}>
                  <span style={{ color: 'var(--tm-muted)' }}>{def.name}{args}</span>
                  {s.indValues && i.visible && entry && def.lines.map((ln) => {
                    const v = entry.vals?.[ln.key]?.[at]
                    return <span key={ln.key} className="tabular-nums" data-testid="ind-val" style={{ color: i.colors?.[ln.key] || ln.color }}>{fmtV(i.type, v)}</span>
                  })}
                  <button type="button" title={i.visible ? 'Hide' : 'Show'} aria-label={`${i.visible ? 'Hide' : 'Show'} ${def.name}`} data-testid="ind-eye" onClick={() => st().updateIndicator(i.id, { visible: !i.visible })} className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10" style={{ color: 'var(--tm-muted)' }}>{i.visible ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                  <button type="button" title="Settings" aria-label={`${def.name} settings`} data-testid="ind-gear" onClick={() => st().setIndDialog(i.id)} className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10" style={{ color: 'var(--tm-muted)' }}><Settings2 size={11} /></button>
                  <button type="button" title="Remove" aria-label={`Remove ${def.name}`} data-testid="ind-x" onClick={() => st().removeIndicator(i.id)} className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10" style={{ color: 'var(--tm-muted)' }}><X size={11} /></button>
                </div>
              )
            })}
          </div>
        )}
        {s.positions && mine.length > 0 && (
          <div className="font-semibold tabular-nums" style={{ color: floating == null ? 'var(--tm-muted)' : floating >= 0 ? '#4ade80' : '#f87171' }}>
            {mine.length} position{mine.length > 1 ? 's' : ''}{floating != null ? `  ${fmtMoney(floating, { sign: true })}` : ''}
          </div>
        )}
      </div>
      {cs.scales.countdown && (
        <div ref={cdRef} className="pointer-events-none absolute z-[6] text-center text-[10px] font-semibold tabular-nums" style={{ display: 'none', color: '#fff', backgroundColor: 'rgba(37,99,235,0.85)', padding: '1px 0' }} aria-hidden="true" />
      )}
    </>
  )
}
