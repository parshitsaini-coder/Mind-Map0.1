import { useEffect, useRef } from 'react'
import { useTerminalStore, motionFlagsNow } from '../../store/terminalStore'
import { createFxQueue, fxSpecs, drawFx, onChartEvent, MAX_FX } from '../../lib/terminal/chartFx'
import { createFrameWatch } from '../../lib/terminal/motionPolicy'

// One transparent canvas above the chart. Effects (chartFx.js) are queued (max 6), drawn by ONE rAF loop shared by
// every chart on screen; the loop sleeps when the queue is empty and does not run while the tab is hidden.
const painters = new Set()
let raf = 0
let last = 0
const watch = createFrameWatch()
function loop(now) {
  raf = 0
  if (typeof document !== 'undefined' && document.hidden) { last = 0; return } // nothing runs in a hidden tab
  let busy = false
  for (const p of painters) busy = p(now) || busy
  if (busy) {
    if (last && watch.push(now - last)) {
      const st = useTerminalStore.getState()
      if (!st.adaptive && st.chartSettings.anim.mode === 'full') {
        st.setAdaptive(true)
        st.notify('Animations reduced to keep the chart smooth (Settings → Animations)', 'info')
      }
    }
    last = now
    raf = requestAnimationFrame(loop)
  } else last = 0
}
const wake = () => { if (!raf) raf = requestAnimationFrame(loop) }

export default function ChartFx({ hostRef, chartRef, seriesRef, symbol, active = true }) {
  const cv = useRef(null)
  const q = useRef(createFxQueue(MAX_FX))
  useEffect(() => {
    const canvas = cv.current
    if (!canvas) return undefined
    const g = canvas.getContext('2d')
    let w = 0, h = 0
    const size = () => {
      const host = hostRef.current
      if (!host) return
      const r = host.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (Math.round(r.width) !== w || Math.round(r.height) !== h) {
        w = Math.round(r.width); h = Math.round(r.height)
        canvas.width = w * dpr; canvas.height = h * dpr
        canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    const paint = () => {
      const t = performance.now()
      const live = q.current.prune(t)
      size()
      g.clearRect(0, 0, w, h)
      if (!live) return false
      const series = seriesRef.current
      const plotW = (() => { try { return chartRef.current?.timeScale().width() || w } catch { return w } })()
      const geom = { w, h, plotW, y: (p) => { try { const y = series?.priceToCoordinate(p); return y == null || !Number.isFinite(y) ? null : y } catch { return null } } }
      for (const it of q.current.list()) drawFx(g, it, t, geom)
      return true
    }
    painters.add(paint)
    const shake = (ms) => {
      const host = hostRef.current
      if (host && host.animate) host.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: ms, easing: 'ease-out' })
    }
    const off = onChartEvent((e) => {
      const d = e.data || {}
      if (d.symbol && d.symbol !== symbol) return
      if (!d.symbol && !active) return // account-wide effects only on the active chart
      const st = useTerminalStore.getState()
      const specs = fxSpecs(e.id, d, motionFlagsNow(st.chartSettings.anim))
      const t = performance.now()
      for (const s of specs) { if (s.kind === 'shake') shake(s.dur); else q.current.add(s, t) }
      if (specs.length) { canvas.dataset.fx = String(q.current.size()); wake() }
    })
    return () => { painters.delete(paint); off(); q.current.clear() }
  }, [symbol, active]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={cv} data-testid="chart-fx" aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[5]" />
}
