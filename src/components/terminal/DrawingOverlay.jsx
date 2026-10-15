import { useEffect, useRef, useState } from 'react'
import { useChartToolsStore } from '../../store/chartToolsStore'
import { TOOLS, createDrawing, drawingShapes, hitTest, timeToIndex, indexToTime, movePointConstrained, translateConstrained } from '../../lib/terminal/drawings'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import { useTerminalStore } from '../../store/terminalStore'

const NONE = []
const st0 = () => useChartToolsStore.getState()
const HIT_MOUSE = 8
const HIT_TOUCH = 16

// Canvas layer on top of the chart that paints drawings and handles creating,
// selecting and dragging them. All geometry comes from lib/terminal/drawings.js;
// this file only converts pixels ⇄ (time, price) and talks to the store.
export default function DrawingOverlay({ wrapRef, chartRef, seriesRef, dataRef, symbol }) {
  const canvasRef = useRef(null)
  const tool = useChartToolsStore((s) => s.tool)
  const drawings = useChartToolsStore((s) => s.drawings[symbol]) || NONE
  const selectedId = useChartToolsStore((s) => s.selectedId)
  const measureState = useChartToolsStore((s) => s.measure)
  const [textAt, setTextAt] = useState(null) // { x, y, pt } while typing a text note

  // everything the paint loop & handlers need, kept in refs so listeners are attached once
  const live = useRef({ drawings, selectedId, measure: measureState, symbol, tool })
  useEffect(() => { live.current = { drawings, selectedId, measure: measureState, symbol, tool } })
  const pendingRef = useRef(null) // { pts:[], preview, down:{x,y}, moved }
  const dragRef = useRef(null) // { id, part, start, orig, cur }
  const dirty = useRef(true)

  // ── coordinate helpers ──
  const api = useRef({})
  api.current.proj = () => {
    const chart = chartRef.current
    const series = seriesRef.current
    const wrap = wrapRef.current
    if (!chart || !series || !wrap) return null
    const { candles, tfSec } = dataRef.current
    if (!candles.length) return null
    const times = candles.map((k) => k.time)
    const ts = chart.timeScale()
    return {
      times, tfSec, w: wrap.clientWidth, h: wrap.clientHeight,
      x: (t) => ts.logicalToCoordinate(timeToIndex(times, t, tfSec)),
      y: (p) => series.priceToCoordinate(p),
    }
  }
  api.current.toPoint = (x, y, snap = true) => {
    const chart = chartRef.current
    const series = seriesRef.current
    const { candles, tfSec } = dataRef.current
    if (!chart || !series || !candles.length) return null
    const logical = chart.timeScale().coordinateToLogical(x)
    const price = series.coordinateToPrice(y)
    if (logical == null || price == null) return null
    const times = candles.map((k) => k.time)
    const idx = snap ? Math.round(logical) : logical
    let p = price
    if (snap) {
      // magnet: stick to the nearest bar's O/H/L/C when the pointer is close to it
      const bar = candles[Math.max(0, Math.min(candles.length - 1, idx))]
      let best = 12
      for (const v of [bar.open, bar.high, bar.low, bar.close]) {
        const py = series.priceToCoordinate(v)
        if (py != null && Math.abs(py - y) < best) { best = Math.abs(py - y); p = v }
      }
    }
    return { t: indexToTime(times, idx, tfSec), p }
  }

  // ── painting (rAF loop; only repaints when something visible changed) ──
  useEffect(() => {
    let raf = 0
    let sig = ''
    const paint = () => {
      raf = requestAnimationFrame(paint)
      const cv = canvasRef.current
      const wrap = wrapRef.current
      const chart = chartRef.current
      const series = seriesRef.current
      if (!cv || !wrap || !chart || !series) return
      const L = live.current
      const range = chart.timeScale().getVisibleLogicalRange()
      const probe = series.priceToCoordinate(1)
      const probe2 = series.priceToCoordinate(1.5)
      const nowSig = `${range?.from}|${range?.to}|${probe}|${probe2}|${wrap.clientWidth}|${wrap.clientHeight}|${dataRef.current.candles.length}|${dataRef.current.tfSec}`
      if (nowSig === sig && !dirty.current) return
      sig = nowSig
      dirty.current = false

      const dpr = window.devicePixelRatio || 1
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
        cv.style.width = `${w}px`
        cv.style.height = `${h}px`
      }
      const ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const proj = api.current.proj()
      if (!proj) return
      const inst = INSTRUMENTS[L.symbol]
      const sctx = { inst, tfSec: proj.tfSec, fmtPrice: (p) => p.toFixed(inst.digits) }
      // keep clear of the price scale on the right and the time scale at the bottom
      const plotW = w - (chart.priceScale('right').width?.() ?? 56)
      const plotH = h - 26
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, plotW, plotH)
      ctx.clip()
      const drag = dragRef.current
      const list = L.drawings.map((d) => (drag && drag.id === d.id && drag.cur ? drag.cur : d))
      for (const d of list) paintDrawing(ctx, d, proj, sctx, d.id === L.selectedId)
      if (L.measure) paintDrawing(ctx, { id: 'measure', type: 'measure', points: L.measure, color: '#38bdf8', width: 1, locked: false }, proj, sctx, false)
      const pend = pendingRef.current
      if (pend && pend.preview) {
        const need = TOOLS[L.tool]?.pts || 0
        const pts = [...pend.pts, ...Array(Math.max(0, need - pend.pts.length)).fill(pend.preview)].slice(0, need)
        if (pts.length === need) {
          ctx.globalAlpha = 0.85
          paintDrawing(ctx, { id: 'pending', type: L.tool, points: pts, color: st0().drawColor, width: 2, locked: false, text: '' }, proj, sctx, true)
        }
      }
      ctx.restore()
    }
    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  }, [wrapRef, chartRef, seriesRef, dataRef])

  useEffect(() => { dirty.current = true }, [drawings, selectedId, measureState, tool, symbol])
  useEffect(() => { pendingRef.current = null; dragRef.current = null; setTextAt(null) }, [tool, symbol])

  // ── finish a drawing ──
  const finish = (type, pts) => {
    const st = useChartToolsStore.getState()
    pendingRef.current = null
    dirty.current = true
    if (type === 'measure') {
      st.setMeasure(pts)
      return // stays on screen until the next click; measure tool stays active for repeated use
    }
    if (type === 'text') {
      const proj = api.current.proj()
      if (proj) setTextAt({ x: proj.x(pts[0].t), y: proj.y(pts[0].p), w: proj.w, pt: pts[0] })
      return
    }
    const d = createDrawing(type, pts, { color: st.drawColor })
    if (!d) return
    const r = st.addDrawing(live.current.symbol, d)
    if (!r.ok) useTerminalStore.getState().pushToast('error', r.error)
    st.setTool('cursor')
    useChartToolsStore.setState({ selectedId: d.id })
  }
  const commitText = (value) => {
    const pt = textAt?.pt
    setTextAt(null)
    const text = (value || '').trim()
    if (!pt || !text) return
    const st = useChartToolsStore.getState()
    const d = createDrawing('text', [pt], { text })
    if (d) st.addDrawing(live.current.symbol, d)
    st.setTool('cursor')
    useChartToolsStore.setState({ selectedId: d?.id ?? null })
  }

  // ── pointer handling while a drawing tool is active ──
  const rel = (e) => {
    const r = wrapRef.current.getBoundingClientRect()
    const t = e.touches?.[0] ?? e.changedTouches?.[0] ?? e
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }
  const onDown = (e) => {
    const tl = live.current.tool
    const need = TOOLS[tl]?.pts
    if (!need) return
    const { x, y } = rel(e)
    const pt = api.current.toPoint(x, y)
    if (!pt) return
    e.preventDefault()
    useChartToolsStore.getState().setMeasure(null)
    const pend = pendingRef.current
    if (!pend) {
      if (need === 1) return finish(tl, [pt])
      pendingRef.current = { pts: [pt], preview: pt, down: { x, y }, moved: false }
    } else {
      pend.pts.push(pt)
      if (pend.pts.length >= need) return finish(tl, pend.pts)
      pend.preview = pt
      pend.down = { x, y }
      pend.moved = false
    }
    dirty.current = true
  }
  const onMove = (e) => {
    const pend = pendingRef.current
    if (!pend) return
    const { x, y } = rel(e)
    const pt = api.current.toPoint(x, y)
    if (!pt) return
    pend.preview = pt
    if (Math.hypot(x - pend.down.x, y - pend.down.y) > 8) pend.moved = true
    dirty.current = true
  }
  const onUp = (e) => {
    const pend = pendingRef.current
    const need = TOOLS[live.current.tool]?.pts
    // drag-to-draw: press, drag, release places the second point (a third point, if any, is a tap)
    if (!pend || !pend.moved || need < 2 || pend.pts.length !== 1) return
    const { x, y } = rel(e)
    const pt = api.current.toPoint(x, y)
    if (!pt) return
    if (need === 2) return finish(live.current.tool, [pend.pts[0], pt])
    pend.pts.push(pt)
    pend.preview = pt
    pend.moved = false
    dirty.current = true
  }

  // ── select / drag existing drawings (cursor mode) ──
  // Capture phase on the wrapper runs before the chart's own handlers and the order-line
  // dragging in ChartView, so a hit on a drawing wins and the chart does not pan.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return undefined
    const pxy = (e) => {
      const r = wrap.getBoundingClientRect()
      const t = e.touches?.[0] ?? e.changedTouches?.[0] ?? e
      return { x: t.clientX - r.left, y: t.clientY - r.top }
    }
    const start = (e) => {
      const L = live.current
      if (L.tool !== 'cursor' || (e.button != null && e.button > 0)) return
      const { x, y } = pxy(e)
      if (L.measure) useChartToolsStore.getState().setMeasure(null)
      const proj = api.current.proj()
      if (!proj || x > proj.w - 60 || y > proj.h - 26) return
      const inst = INSTRUMENTS[L.symbol]
      const sctx = { inst, tfSec: proj.tfSec, fmtPrice: (p) => p.toFixed(inst.digits) }
      const tol = e.type === 'touchstart' ? HIT_TOUCH : HIT_MOUSE
      for (let i = L.drawings.length - 1; i >= 0; i--) {
        const d = L.drawings[i]
        const part = hitTest(d, proj, x, y, tol, sctx)
        if (!part) continue
        e.stopPropagation()
        if (e.cancelable) e.preventDefault()
        useChartToolsStore.getState().select(d.id)
        if (!d.locked) {
          dragRef.current = { id: d.id, part, start: api.current.toPoint(x, y, false), orig: d, cur: null }
          chartRef.current?.applyOptions({ handleScroll: false, handleScale: false })
        }
        return
      }
      if (L.selectedId) useChartToolsStore.getState().select(null)
    }
    const move = (e) => {
      const d = dragRef.current
      if (!d) return
      if (e.cancelable) e.preventDefault()
      const { x, y } = pxy(e)
      const pt = api.current.toPoint(x, y, d.part !== 'body')
      if (!pt || !d.start) return
      d.cur = d.part === 'body'
        ? translateConstrained(d.orig, pt.t - d.start.t, pt.p - d.start.p)
        : movePointConstrained(d.orig, Number(d.part.slice(1)), pt)
      dirty.current = true
    }
    const end = () => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      chartRef.current?.applyOptions({ handleScroll: true, handleScale: true })
      if (d.cur) useChartToolsStore.getState().updateDrawing(live.current.symbol, d.id, { points: d.cur.points })
      dirty.current = true
    }
    const key = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      if (e.__chartKey) return // another chart already handled this key press
      const st = useChartToolsStore.getState()
      if (e.key === 'Escape') {
        e.__chartKey = true
        pendingRef.current = null
        dirty.current = true
        if (st.measure) st.setMeasure(null)
        else if (st.tool !== 'cursor') st.setTool('cursor')
        else st.select(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedId) {
        const d = (st.drawings[live.current.symbol] || []).find((x) => x.id === st.selectedId)
        if (d && !d.locked) { e.__chartKey = true; e.preventDefault(); st.removeDrawing(live.current.symbol, d.id) }
      }
    }
    wrap.addEventListener('mousedown', start, true)
    wrap.addEventListener('touchstart', start, { capture: true, passive: false })
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('mouseup', end)
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
    window.addEventListener('keydown', key)
    return () => {
      wrap.removeEventListener('mousedown', start, true)
      wrap.removeEventListener('touchstart', start, { capture: true })
      window.removeEventListener('mousemove', move)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('mouseup', end)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
      window.removeEventListener('keydown', key)
    }
  }, [wrapRef, chartRef])

  const drawing = tool !== 'cursor'
  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 z-[5]" aria-hidden />
      {drawing && (
        <div
          className="absolute inset-0 z-[6] cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      {drawing && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-[7] -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold" style={{ backgroundColor: '#1e293bf0', color: '#e5e7eb' }}>
          {TOOLS[tool].label} — {TOOLS[tool].pts === 1 ? 'tap to place' : TOOLS[tool].pts === 3 ? 'drag two points, tap a third' : 'drag, or tap two points'} · Esc cancels
        </div>
      )}
      {textAt && (
        <input
          autoFocus
          maxLength={80}
          placeholder="Note text, Enter to save"
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText(e.currentTarget.value)
            if (e.key === 'Escape') setTextAt(null)
            e.stopPropagation()
          }}
          className="absolute z-[8] w-44 rounded border px-2 py-1 text-[12px] outline-none"
          style={{ left: Math.max(4, Math.min(textAt.x, textAt.w - 190)), top: Math.max(4, textAt.y - 14), backgroundColor: '#131a22', borderColor: '#38bdf8', color: '#e5e7eb' }}
        />
      )}
    </>
  )
}

// ── canvas painting ──
const FIB_COLORS = ['#94a3b8', '#ef4444', '#f59e0b', '#22c55e', '#38bdf8', '#a78bfa', '#94a3b8']

function paintDrawing(ctx, d, proj, sctx, selected) {
  const sh = drawingShapes(d, proj, sctx)
  if (!sh) return
  let color = d.color
  if (d.type === 'measure') color = d.points[1].p >= d.points[0].p ? '#22c55e' : '#ef4444'
  ctx.lineWidth = d.width || 2
  ctx.strokeStyle = color
  ctx.fillStyle = color
  for (const f of sh.fills) {
    ctx.save()
    ctx.globalAlpha *= f.alpha
    ctx.beginPath()
    f.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  for (const s of sh.segs) {
    ctx.save()
    if (s.fib != null) { ctx.strokeStyle = FIB_COLORS[Math.max(0, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].indexOf(s.fib))]; ctx.lineWidth = 1 }
    if (s.dash) ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(s.a[0], s.a[1])
    ctx.lineTo(s.b[0], s.b[1])
    ctx.stroke()
    if (s.arrow) arrowHead(ctx, s.a, s.b)
    ctx.restore()
  }
  ctx.font = '11px system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  for (const l of sh.labels) {
    const tw = ctx.measureText(l.text).width
    const x = l.align === 'right' ? l.x - tw : l.align === 'center' ? l.x - tw / 2 : l.x
    if (l.box) {
      ctx.save()
      ctx.fillStyle = '#131a22ee'
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.rect(x - 5, l.y - 13, tw + 10, 18)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = '#e5e7eb'
    } else ctx.fillStyle = color
    ctx.fillText(l.text, x, l.y)
  }
  if (selected) {
    for (const [x, y] of sh.handles) {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = d.locked ? '#64748b' : '#0f1419'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = d.locked ? '#94a3b8' : '#38bdf8'
      ctx.stroke()
    }
  }
}

function arrowHead(ctx, a, b) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  ctx.beginPath()
  ctx.moveTo(b[0], b[1])
  ctx.lineTo(b[0] - 9 * Math.cos(ang - 0.4), b[1] - 9 * Math.sin(ang - 0.4))
  ctx.moveTo(b[0], b[1])
  ctx.lineTo(b[0] - 9 * Math.cos(ang + 0.4), b[1] - 9 * Math.sin(ang + 0.4))
  ctx.stroke()
}
