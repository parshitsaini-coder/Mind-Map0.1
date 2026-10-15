import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { subscribeChannel } from '../../lib/terminal/effects'
import { chartEffectsFor, createEffectQueue, createFrameGovernor, effectiveMode } from '../../lib/terminal/animations'
import { getMotionFlags, motionKey, subscribeMotion, setAdaptiveReduced } from '../../lib/terminal/motionState'

// Phase 13: chart effects on ONE canvas above the chart. A single rAF loop runs only while something is
// animating (and never in a hidden tab), at most 6 effects at once. Pointer-events none: the chart keeps its gestures.
// Chart effects: lineDraw, ring, shock (+ particles), crack, badge, vignette, pulse. The stop-out banner is DOM.
const AMBER = '#f59e0b'
const ACCENT = '#38bdf8'
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function drawEffect(g, e, now, w, h, col, y, x) {
  const t = Math.min(1, (now - e.t0) / e.ms)
  const c = col(e.color)
  g.save()
  g.strokeStyle = c
  g.fillStyle = c
  switch (e.kind) {
    case 'lineDraw': {
      g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
      g.lineWidth = 2
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * ease(t * 1.4), y); g.stroke()
      break
    }
    case 'ring': {
      g.globalAlpha = 1 - t
      g.lineWidth = 3 * (1 - t) + 1
      g.beginPath(); g.arc(x, y, 8 + 46 * ease(t), 0, Math.PI * 2); g.stroke()
      break
    }
    case 'shock': {
      g.globalAlpha = 1 - t
      g.lineWidth = 3 * (1 - t) + 1
      g.beginPath(); g.arc(x, y, 8 + 70 * ease(t), 0, Math.PI * 2); g.stroke()
      for (let i = 0; i < 14; i++) { // deterministic particles flying up
        const a = -Math.PI / 2 + ((i - 6.5) / 7) * 0.9
        const sp = 40 + (i % 5) * 18
        g.beginPath(); g.arc(x + Math.cos(a) * sp * ease(t), y + Math.sin(a) * sp * ease(t) * 1.6 + 30 * t * t, 2.2 * (1 - t) + 0.4, 0, Math.PI * 2); g.fill()
      }
      break
    }
    case 'crack': {
      const j = (1 - t) * 6
      g.globalAlpha = 1 - t * 0.6
      g.lineWidth = 2.5
      g.beginPath(); g.moveTo(0, y + Math.sin(t * 60) * j)
      for (let px = 0; px <= w; px += w / 24) g.lineTo(px, y + Math.sin(px * 0.05 + t * 40) * j)
      g.stroke()
      break
    }
    case 'badge': {
      const a = t < 0.12 ? t / 0.12 : t > 0.8 ? (1 - t) / 0.2 : 1
      g.globalAlpha = Math.max(0, a)
      g.font = '700 12px system-ui, sans-serif'
      const tw = g.measureText(e.text).width + 18
      const bx = Math.max(6, Math.min(w - tw - 6, x - tw))
      const by = y - 30 - 14 * ease(t)
      g.fillStyle = c
      g.beginPath(); g.roundRect(bx, by, tw, 24, 6); g.fill()
      g.fillStyle = '#0b0f14'
      g.textBaseline = 'middle'
      g.fillText(e.text, bx + 9, by + 12.5)
      break
    }
    case 'vignette': {
      const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75)
      r.addColorStop(0, 'rgba(239,68,68,0)')
      r.addColorStop(1, 'rgba(239,68,68,0.55)')
      g.globalAlpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
      g.fillStyle = r
      g.fillRect(0, 0, w, h)
      break
    }
    case 'pulse': {
      const el = now - e.t0
      g.globalAlpha = (0.3 + 0.4 * (0.5 + 0.5 * Math.sin((el / 1000) * Math.PI * 2 - Math.PI / 2))) * (t > 0.85 ? (1 - t) / 0.15 : 1)
      g.strokeStyle = AMBER
      g.lineWidth = 4
      g.strokeRect(2, 2, w - 4, h - 4)
      break
    }
    default: break
  }
  g.restore()
}

export default function ChartEffects({ chartRef, seriesRef, candlesRef, symbol, active }) {
  const canvasRef = useRef(null)
  const queue = useRef(createEffectQueue(6))
  const raf = useRef(0)
  const gov = useRef(createFrameGovernor())
  const [banner, setBanner] = useState(null)
  const flags = useSyncExternalStore(subscribeMotion, motionKey, () => '00')
  const keep = useRef({ symbol, active })
  keep.current = { symbol, active }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    let last = 0
    const cs = () => useTerminalStore.getState().chartSettings
    const colorOf = (k) => (k === 'up' ? cs().symbol.up : k === 'down' ? cs().symbol.down : k === 'amber' ? AMBER : ACCENT)
    const size = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr))
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      return { w: r.width, h: r.height, dpr }
    }
    const frame = (now) => {
      raf.current = 0
      if (document.hidden) { queue.current.clear(); canvas.dataset.fx = ''; return }
      const dt = last ? now - last : 0
      last = now
      if (dt && gov.current.frame(dt, now) && setAdaptiveReduced()) useTerminalStore.getState().notify('Animations reduced to keep the chart smooth', 'info')
      const { w, h, dpr } = size()
      const g = canvas.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const list = queue.current.active(now)
      const candles = candlesRef.current
      const lastBar = candles && candles.length ? candles[candles.length - 1] : null
      for (const e of list) {
        const price = e.price != null ? e.price : lastBar && lastBar.close
        const y = price != null && seriesRef.current ? seriesRef.current.priceToCoordinate(price) : null
        let x = w - 90
        try { const cx = lastBar && chartRef.current ? chartRef.current.timeScale().timeToCoordinate(lastBar.time) : null; if (Number.isFinite(cx)) x = cx } catch { /* chart rebuilt */ }
        if (['lineDraw', 'ring', 'shock', 'crack', 'badge'].includes(e.kind) && !Number.isFinite(y)) continue
        drawEffect(g, e, now, w, h, colorOf, y, x)
      }
      canvas.dataset.fx = list.map((e) => e.kind).join(',')
      if (list.length) { last = now; raf.current = requestAnimationFrame(frame) } else { last = 0; g.clearRect(0, 0, w, h) } // sleeps when idle
    }
    const off = subscribeChannel('chart', (evt) => {
      const an = cs().anim
      const mode = effectiveMode(an, getMotionFlags())
      const { symbol: sym, active: act } = keep.current
      for (const fx of chartEffectsFor(evt, mode, an)) {
        if (fx.symbol ? fx.symbol !== sym : !act) continue // a symbol effect belongs to the panes showing it; global ones to the active pane
        if (fx.kind === 'banner') { setBanner({ text: fx.text, key: Date.now() }); continue }
        queue.current.add(fx, performance.now())
      }
      if (!raf.current && !document.hidden && queue.current.size()) raf.current = requestAnimationFrame(frame)
    })
    return () => { off(); if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; queue.current.clear() }
  }, [chartRef, seriesRef, candlesRef])

  useEffect(() => { gov.current.reset() }, [flags])

  return (
    <>
      <canvas ref={canvasRef} data-fx-layer="" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] h-full w-full" />
      {banner && active && (
        <div role="alert" className="absolute inset-x-0 top-0 z-[8] flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-extrabold text-white" style={{ backgroundColor: '#b91c1c' }}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss stop-out banner" className="tm-tap flex h-9 w-9 items-center justify-center rounded hover:bg-black/20"><X size={14} /></button>
        </div>
      )}
    </>
  )
}
