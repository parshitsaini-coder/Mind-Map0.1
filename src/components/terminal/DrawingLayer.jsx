import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Unlock, Trash2, Minus, Pencil } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import * as D from '../../lib/terminal/drawings'
import { createDrawingsPrimitive } from './chartPrimitives'

const EMPTY = []
const HINT = {
  trend: 'Press, drag and release — or click two points',
  ray: 'Press, drag and release — or click two points',
  hline: 'Click to place the line',
  vline: 'Click to place the line',
  rect: 'Press, drag and release — or click two corners',
  fib: 'Drag from one swing to the other (low → high or high → low)',
  channel: 'Drag the first side, then click to set the channel width',
  text: 'Click where the note should go',
  measure: 'Press, drag and release — or click two points',
}

// Owns everything about drawings on ONE chart: paints them (via a canvas primitive inside the
// chart), handles pointer input (create / select / move / resize) and shows the property bar.
export default function DrawingLayer({ hostRef, chartRef, seriesRef, candlesRef, symbol, timeframe, ver, active }) {
  const list = useTerminalStore((s) => s.drawings[symbol]) || EMPTY
  const tool = useTerminalStore((s) => s.drawTool)
  const selId = useTerminalStore((s) => s.drawSel)
  const hidden = useTerminalStore((s) => s.drawHidden)

  const primRef = useRef(null)
  const timeMapRef = useRef(null)
  const live = useRef(null) // { id, patch } — drag preview, not yet saved
  const cr = useRef(null) // drawing being created
  const transient = useRef(null) // measure tool result (never saved)
  const drag = useRef(null)
  const dataRef = useRef({})
  useEffect(() => { dataRef.current = { list, selId, hidden, symbol } }, [list, selId, hidden, symbol])
  const measureCtx = useRef(null)
  const [editor, setEditor] = useState(null) // text note editor { id, x, y, value }

  const inst = INSTRUMENTS[symbol]
  const tfSec = (TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).minutes * 60
  const refresh = useCallback(() => primRef.current?.refresh(), [])

  // Build projector + view for the current chart state.
  const getProj = useCallback(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    const timeMap = timeMapRef.current
    if (!chart || !series || !timeMap) return null
    const ts = chart.timeScale()
    const conv = {
      logicalToX: (l) => ts.logicalToCoordinate(l),
      xToLogical: (x) => ts.coordinateToLogical(x),
      priceToY: (p) => series.priceToCoordinate(p),
      yToPrice: (y) => series.coordinateToPrice(y),
    }
    return { proj: D.makeProjector(timeMap, conv), timeMap, ts, series }
  }, [chartRef, seriesRef])

  const measure = useCallback((text) => {
    if (!measureCtx.current) {
      const c = document.createElement('canvas').getContext('2d')
      if (c) c.font = '600 11px system-ui, -apple-system, Segoe UI, sans-serif'
      measureCtx.current = c
    }
    return measureCtx.current ? measureCtx.current.measureText(text).width : text.length * 6.2
  }, [])

  // The visible scene: every drawing (with any drag preview applied) + the one being created.
  const buildScene = useCallback((w, h) => {
    const g = getProj()
    if (!g) return { items: [] }
    const { list: L, selId: sel, hidden: hide } = dataRef.current
    const view = { w, h, fmt: (v) => v.toFixed(inst.digits), measure, inst, timeMap: g.timeMap }
    const items = []
    if (!hide) {
      for (const d of L) {
        const patch = live.current && live.current.id === d.id ? live.current.patch : null
        const dd = patch ? { ...d, ...patch } : d
        const lay = D.layoutOf(dd, g.proj, view)
        if (lay) items.push({ d: dd, lay, selected: d.id === sel })
      }
    }
    const extra = cr.current?.d || transient.current
    if (extra) {
      const lay = D.layoutOf(extra, g.proj, view)
      if (lay) items.push({ d: extra, lay, selected: false, ghost: true })
    }
    return { items }
  }, [getProj, inst, measure])
  const sceneRef = useRef(buildScene)
  useEffect(() => { sceneRef.current = buildScene }, [buildScene])

  // (Re)attach the painter whenever the chart's main series is recreated.
  useEffect(() => {
    const series = seriesRef.current
    const candles = candlesRef.current
    if (!series || !candles?.length) return undefined
    timeMapRef.current = D.makeTimeMap(candles.map((c) => c.time), tfSec)
    const prim = createDrawingsPrimitive((size) => sceneRef.current(size.width, size.height))
    series.attachPrimitive(prim)
    primRef.current = prim
    cr.current = null
    transient.current = null
    return () => {
      primRef.current = null
      try { series.detachPrimitive(prim) } catch { /* series already removed */ }
    }
  }, [ver, tfSec, seriesRef, candlesRef])

  useEffect(() => { refresh() }, [list, selId, hidden, tool, refresh])

  // Leaving a tool abandons a half-made drawing and clears the measure result.
  useEffect(() => {
    if (tool === 'cursor' || cr.current?.d.type !== tool) cr.current = null
    if (tool !== 'measure' && tool !== 'cursor') transient.current = null
    refresh()
  }, [tool, refresh])

  // ── pointer input ──
  useEffect(() => {
    const host = hostRef.current
    const chart = chartRef.current
    if (!host || !chart) return undefined
    const st = () => useTerminalStore.getState()
    const pos = (e) => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const plot = () => {
      const g = getProj()
      if (!g) return null
      return { g, w: g.ts.width(), h: g.series.getPane().getHeight() }
    }
    const ptAt = (g, x, y) => {
      const l = g.proj.l(x)
      const p = g.proj.p(y)
      return l == null || p == null ? null : { l, p, t: g.timeMap.toTime(l) }
    }
    const stop = (e) => { e.stopPropagation(); e.preventDefault() }

    const commit = (d, g) => {
      cr.current = null
      if (d.type === 'measure') {
        transient.current = d
        if (!st().drawSticky) st().setDrawTool('cursor')
        refresh()
        return
      }
      if (d.type === 'channel') d.offset = d.offset || 0
      const ok = st().addDrawing(dataRef.current.symbol, d)
      refresh()
      if (ok && d.type === 'text') {
        const lay = D.layoutOf(d, g.proj, { w: 9999, h: 9999, measure, inst })
        if (lay) setEditor({ id: d.id, x: lay.handles[0].x, y: lay.handles[0].y, value: d.text })
      }
    }

    const down = (e) => {
      if (e.defaultPrevented) return // a trading line (SL/TP/entry) was grabbed first
      if (e.button != null && e.button !== 0) return
      const pl = plot()
      if (!pl) return
      const { x, y } = pos(e)
      if (x > pl.w || y > pl.h) return // price scale / time scale / other pane
      const s = st()
      const touch = e.pointerType === 'touch'
      const pt = ptAt(pl.g, x, y)
      if (!pt) return
      setEditor(null)

      // 1) second / third click of a drawing in progress
      if (cr.current) {
        const c = cr.current
        if (c.idx === 1) {
          c.d.points[1] = { t: pt.t, p: pt.p }
          if (c.clicks === 2) { stop(e); commit(c.d, pl.g); return }
          c.idx = 2
        } else {
          c.d.offset = D.channelOffset(c.d, pl.g.timeMap, pt.l, pt.p)
          stop(e)
          commit(c.d, pl.g)
          return
        }
        stop(e)
        refresh()
        return
      }

      // 2) a tool is armed -> start a new drawing
      if (s.drawTool !== 'cursor') {
        stop(e)
        transient.current = null
        const spec = D.DRAW_TYPES[s.drawTool]
        const p0 = { t: pt.t, p: pt.p }
        if (spec.points === 1) { commit(D.newDrawing(s.drawTool, [p0]), pl.g); return }
        cr.current = { d: D.newDrawing(s.drawTool, [p0, { ...p0 }]), idx: 1, clicks: spec.clicks, downX: x, downY: y, dragged: false }
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        refresh()
        return
      }

      // 3) cursor: pick a drawing
      transient.current = null
      if (dataRef.current.hidden) return
      const { list: L, selId: sel } = dataRef.current
      const scene = buildScene(pl.w, pl.h)
      const byId = new Map(scene.items.filter((i) => !i.ghost).map((i) => [i.d.id, i]))
      const order = [...L].reverse()
      if (sel) { const i = order.findIndex((d) => d.id === sel); if (i > 0) order.unshift(order.splice(i, 1)[0]) } // selected first
      const tol = touch ? 14 : 7
      const htol = touch ? 18 : 10
      for (const d of order) {
        const item = byId.get(d.id)
        if (!item) continue
        const hit = D.hitTest(item.lay, x, y, { tol, handleTol: htol, selected: d.id === sel })
        if (!hit) continue
        if (d.id !== sel) s.setDrawSel(d.id)
        if (d.locked) { refresh(); return } // selectable but not movable: let the chart pan
        stop(e)
        drag.current = { id: d.id, d: item.d, mode: hit.kind === 'handle' ? 'handle' : 'move', idx: hit.idx, startL: pt.l, startP: pt.p, orig: item.d.points.map((q) => ({ ...q })), pid: e.pointerId, moved: false }
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        refresh()
        return
      }
      if (sel) s.setDrawSel(null)
      refresh()
    }

    const move = (e) => {
      const c = cr.current
      const dg = drag.current
      if (!c && !dg) return
      const pl = plot()
      if (!pl) return
      const { x, y } = pos(e)
      const pt = ptAt(pl.g, x, y)
      if (!pt) return
      if (c) {
        if (c.idx === 1) {
          c.d.points[1] = { t: pt.t, p: pt.p }
          if (Math.hypot(x - c.downX, y - c.downY) > 6) c.dragged = true
        } else {
          c.d.offset = D.channelOffset(c.d, pl.g.timeMap, pt.l, pt.p)
        }
        refresh()
        return
      }
      dg.moved = true
      const patch = dg.mode === 'move'
        ? { points: D.movePoints(dg.d, dg.orig, pt.l - dg.startL, pt.p - dg.startP, pl.g.timeMap) }
        : D.moveHandle({ ...dg.d, points: dg.orig }, dg.idx, pt.t, pt.p, pl.g.timeMap)
      live.current = { id: dg.id, patch }
      refresh()
      stop(e)
    }

    const up = (e) => {
      const c = cr.current
      if (c && c.dragged && c.idx === 1) { // press-drag-release finished the first stroke
        const pl = plot()
        const { x, y } = pos(e)
        const pt = pl && ptAt(pl.g, x, y)
        if (pt) c.d.points[1] = { t: pt.t, p: pt.p }
        if (c.clicks === 2) { if (pl) commit(c.d, pl.g) } else { c.idx = 2; c.dragged = false; refresh() }
      }
      const dg = drag.current
      if (dg) {
        drag.current = null
        try { host.releasePointerCapture(dg.pid) } catch { /* ignore */ }
        const patch = live.current?.id === dg.id ? live.current.patch : null
        live.current = null
        if (dg.moved && patch) st().updateDrawing(dataRef.current.symbol, dg.id, patch)
        refresh()
      }
    }

    // keep the chart's own mouse/touch panning out of an active draw / drag
    const block = (e) => { if (drag.current || cr.current) { e.stopPropagation(); e.preventDefault() } }

    const key = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (e.key === 'Escape') {
        if (cr.current || transient.current || live.current) { cr.current = null; transient.current = null; live.current = null; drag.current = null; refresh() }
        setEditor(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const { selId: sel, symbol: sym } = dataRef.current
        if (sel && st().drawings[sym]?.some((d) => d.id === sel)) { st().removeDrawing(sym, sel); e.preventDefault() }
      }
    }

    const dbl = (e) => { // double-click a text note to edit it
      const pl = plot()
      if (!pl) return
      const { x, y } = pos(e)
      const scene = buildScene(pl.w, pl.h)
      for (const it of scene.items) {
        if (it.d.type === 'text' && !it.ghost && D.hitTest(it.lay, x, y, { tol: 8 })) {
          st().setDrawSel(it.d.id)
          setEditor({ id: it.d.id, x: it.lay.handles[0].x, y: it.lay.handles[0].y, value: it.d.text })
          return
        }
      }
    }

    const cap = { capture: true }
    host.addEventListener('pointerdown', down, cap)
    host.addEventListener('pointermove', move, cap)
    host.addEventListener('pointerup', up, cap)
    host.addEventListener('pointercancel', up, cap)
    host.addEventListener('mousedown', block, cap)
    host.addEventListener('touchstart', block, cap)
    host.addEventListener('dblclick', dbl)
    window.addEventListener('keydown', key)
    return () => {
      host.removeEventListener('pointerdown', down, cap)
      host.removeEventListener('pointermove', move, cap)
      host.removeEventListener('pointerup', up, cap)
      host.removeEventListener('pointercancel', up, cap)
      host.removeEventListener('mousedown', block, cap)
      host.removeEventListener('touchstart', block, cap)
      host.removeEventListener('dblclick', dbl)
      window.removeEventListener('keydown', key)
    }
  }, [hostRef, chartRef, ver, getProj, buildScene, refresh, measure, inst])

  // Test/debug hook (only when localStorage 'terminal-debug' is set).
  useEffect(() => {
    let on = false
    try { on = !!localStorage.getItem('terminal-debug') } catch { /* ignore */ }
    if (!on) return undefined
    window.__terminalDraw = {
      scene: () => { const g = getProj(); const h = g ? g.series.getPane().getHeight() : 0; const w = g ? g.ts.width() : 0; return buildScene(w, h).items.map((i) => ({ id: i.d.id, type: i.d.type, selected: i.selected, segs: i.lay.segs, handles: i.lay.handles })) },
      toXY: (t, p) => { const g = getProj(); return g ? { x: g.proj.x(t), y: g.proj.y(p) } : null },
      fromXY: (x, y) => { const g = getProj(); return g ? { t: g.proj.t(x), p: g.proj.p(y) } : null },
      size: () => { const g = getProj(); return g ? { w: g.ts.width(), h: g.series.getPane().getHeight() } : null },
    }
    return () => { delete window.__terminalDraw }
  }, [getProj, buildScene, ver])

  const selected = list.find((d) => d.id === selId)
  const st = useTerminalStore.getState
  const upd = (patch) => st().updateDrawing(symbol, selected.id, patch)

  return (
    <>
      {active && tool !== 'cursor' && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <div className="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-lg" style={{ backgroundColor: 'rgba(37,99,235,0.92)' }}>
            {D.DRAW_TYPES[tool].name}: {HINT[tool]} · Esc to cancel
          </div>
        </div>
      )}
      {active && selected && tool === 'cursor' && !editor && (
        <div className="absolute left-1/2 top-2 z-20 flex max-w-[96%] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-lg border px-1.5 py-1 shadow-xl no-scrollbar" style={{ backgroundColor: '#1a222c', borderColor: '#334155' }}>
          {D.DRAW_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => upd({ color: c })} className="h-6 w-6 shrink-0 rounded-full border-2" style={{ backgroundColor: c, borderColor: selected.color === c ? '#fff' : 'transparent' }} />
          ))}
          <div className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          <button type="button" title="Line width" onClick={() => upd({ width: (selected.width % 4) + 1 })} className="flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10">
            <span className="inline-block w-5 rounded-full bg-slate-200" style={{ height: selected.width }} /> {selected.width}
          </button>
          <button type="button" title="Dashed" onClick={() => upd({ dash: !selected.dash })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10" style={{ color: selected.dash ? '#60a5fa' : '#cbd5e1' }}>
            <Minus size={14} strokeDasharray="3 2" />
          </button>
          {selected.type === 'text' && (
            <button type="button" title="Edit text" onClick={() => { const g = getProj(); const lay = g && D.layoutOf(selected, g.proj, { w: 9999, h: 9999, measure, inst }); if (lay) setEditor({ id: selected.id, x: lay.handles[0].x, y: lay.handles[0].y, value: selected.text }) }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-200 hover:bg-white/10"><Pencil size={14} /></button>
          )}
          {selected.type === 'fib' && (
            <button type="button" title="Extend levels to the right edge" onClick={() => upd({ extend: !selected.extend })} className="h-7 shrink-0 rounded px-1.5 text-[11px] font-bold hover:bg-white/10" style={{ color: selected.extend ? '#60a5fa' : '#cbd5e1' }}>Extend</button>
          )}
          <button type="button" title={selected.locked ? 'Unlock' : 'Lock (cannot be moved)'} onClick={() => upd({ locked: !selected.locked })} className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-white/10" style={{ color: selected.locked ? '#fbbf24' : '#cbd5e1' }}>
            {selected.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button type="button" title="Delete (Del)" onClick={() => st().removeDrawing(symbol, selected.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
        </div>
      )}
      {editor && (
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          maxLength={120}
          value={editor.value}
          onChange={(e) => setEditor({ ...editor, value: e.target.value })}
          onBlur={() => { if (editor.value.trim()) st().updateDrawing(symbol, editor.id, { text: editor.value.trim() }); setEditor(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { e.stopPropagation(); setEditor(null) }
          }}
          className="absolute z-30 h-7 w-44 rounded border px-2 text-[12px] font-semibold text-white outline-none"
          style={{ left: Math.max(4, editor.x), top: Math.max(4, editor.y - 14), backgroundColor: '#111827', borderColor: '#60a5fa' }}
        />
      )}
    </>
  )
}
