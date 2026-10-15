import { useCallback, useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, TIMEFRAMES } from '../../lib/terminal/instruments'
import * as D from '../../lib/terminal/drawings'
import { createDrawingsPrimitive } from './chartPrimitives'
import DrawingBar from './DrawingBar'
import DrawingDialog from './DrawingDialog'

const EMPTY = []
const hintOf = (tool, spec) => {
  if (spec.position) return 'Click where the entry should go'
  if (tool === 'channel') return 'Drag the first side, then click to set the channel width'
  if (spec.clicks === 1) return 'Click to place it'
  if (spec.points === 3) return 'Click the three points one after another'
  return 'Press, drag and release — or click two points'
}
const MENU_ITEMS = [
  ['settings', 'Settings…'], ['clone', 'Clone'], ['copy', 'Copy'], ['front', 'Bring to front'], ['back', 'Send to back'],
  ['lock', 'Lock / unlock'], ['hide', 'Hide'], ['delete', 'Delete'],
]

// Owns everything about drawings on ONE chart: paints them (via a canvas primitive inside the
// chart), handles pointer input (create / select / move / resize), the floating bar, the
// right-click menu and the keyboard shortcuts.
export default function DrawingLayer({ hostRef, chartRef, seriesRef, candlesRef, symbol, timeframe, ver, active }) {
  const list = useTerminalStore((s) => s.drawings[symbol]) || EMPTY
  const tool = useTerminalStore((s) => s.drawTool)
  const selId = useTerminalStore((s) => s.drawSel)
  const hidden = useTerminalStore((s) => s.drawHidden)
  const magnet = useTerminalStore((s) => s.drawMagnet)
  const lots = useTerminalStore((s) => s.settings.lots)

  const primRef = useRef(null)
  const timeMapRef = useRef(null)
  const live = useRef(null) // { id, patch } — drag preview, not yet saved
  const cr = useRef(null) // drawing being created
  const transient = useRef(null) // measure tool result (never saved)
  const drag = useRef(null)
  const dataRef = useRef({})
  const activeRef = useRef(active)
  useEffect(() => { dataRef.current = { list, selId, hidden, symbol, timeframe, magnet, lots }; activeRef.current = active }, [list, selId, hidden, symbol, timeframe, magnet, lots, active])
  const measureCtx = useRef(null)
  const [editor, setEditor] = useState(null) // text note editor { id, x, y, value }
  const [menu, setMenu] = useState(null) // right-click menu { x, y, id }

  const inst = INSTRUMENTS[symbol]
  const tfSec = (TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0]).minutes * 60
  const refresh = useCallback(() => primRef.current?.refresh(), [])

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

  // The visible scene: every shown drawing (with any drag preview applied) + the one being created.
  const buildScene = useCallback((w, h) => {
    const g = getProj()
    if (!g) return { items: [] }
    const { list: L, selId: sel, hidden: hide, timeframe: tf, lots: lt } = dataRef.current
    const view = { w, h, fmt: (v) => v.toFixed(inst.digits), measure, inst, timeMap: g.timeMap, lots: lt }
    const items = []
    if (!hide) {
      for (const d of D.byZ(L)) {
        if (d.hidden || !D.visibleOn(d, tf)) continue
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

  useEffect(() => { refresh() }, [list, selId, hidden, tool, timeframe, lots, refresh])

  // Leaving a tool abandons a half-made drawing and clears the measure result.
  useEffect(() => {
    if (tool === 'cursor' || cr.current?.d.type !== tool) cr.current = null
    if (tool !== 'measure' && tool !== 'cursor') transient.current = null
    refresh()
  }, [tool, refresh])

  const openEditor = useCallback((d) => {
    const g = getProj()
    if (!g) return
    const lay = D.layoutOf(d, g.proj, { w: 9999, h: 9999, measure, inst, timeMap: g.timeMap })
    const note = lay?.labels.find((l) => l.note)
    if (note) setEditor({ id: d.id, x: note.x, y: note.y, value: d.text || '' })
  }, [getProj, measure, inst])

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
    // magnet: snap to the open / high / low / close of the bar under the pointer
    const ptAt = (g, x, y, useMagnet = false) => {
      const l = g.proj.l(x)
      const p = g.proj.p(y)
      if (l == null || p == null) return null
      const raw = { l, p, t: g.timeMap.toTime(l) }
      const mode = dataRef.current.magnet
      if (!useMagnet || mode === 'off') return raw
      const p2 = g.proj.p(y + 14)
      return D.magnetSnap(raw, candlesRef.current, mode, p2 == null ? 0 : Math.abs(p - p2))
    }
    const stop = (e) => { e.stopPropagation(); e.preventDefault() }
    const hitItem = (pl, x, y, touch) => {
      const { list: L, selId: sel } = dataRef.current
      const scene = buildScene(pl.w, pl.h)
      const byId = new Map(scene.items.filter((i) => !i.ghost).map((i) => [i.d.id, i]))
      const order = D.byZ(L).reverse()
      if (sel) { const i = order.findIndex((d) => d.id === sel); if (i > 0) order.unshift(order.splice(i, 1)[0]) } // selected first
      for (const d of order) {
        const item = byId.get(d.id)
        if (!item) continue
        const hit = D.hitTest(item.lay, x, y, { tol: touch ? 14 : 7, handleTol: touch ? 18 : 10, selected: d.id === sel })
        if (hit) return { d, item, hit }
      }
      return null
    }

    const commit = (d) => {
      cr.current = null
      if (d.type === 'measure') {
        transient.current = d
        if (!st().drawSticky) st().setDrawTool('cursor')
        refresh()
        return
      }
      const ok = st().addDrawing(dataRef.current.symbol, d)
      refresh()
      if (ok && (d.type === 'text' || d.type === 'callout')) {
        const fresh = (st().drawings[dataRef.current.symbol] || []).find((x) => x.id === d.id)
        if (fresh) openEditor(fresh)
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
      setEditor(null)
      setMenu(null)

      // 1) next click of a drawing in progress
      if (cr.current) {
        const c = cr.current
        const pt = ptAt(pl.g, x, y, true)
        if (!pt) return
        const spec = D.TOOLS[c.d.type]
        if (c.idx === 1) {
          c.d.points[1] = { t: pt.t, p: pt.p }
          if (spec.points === 3) c.d.points[2] = { t: pt.t, p: pt.p }
          if (c.clicks === 2) { stop(e); commit(c.d); return }
          c.idx = 2
        } else {
          if (c.d.type === 'channel') c.d.offset = D.channelOffset(c.d, pl.g.timeMap, pt.l, pt.p)
          else c.d.points[2] = { t: pt.t, p: pt.p }
          stop(e)
          commit(c.d)
          return
        }
        stop(e)
        refresh()
        return
      }

      // 2) a tool is armed -> start a new drawing
      if (s.drawTool !== 'cursor') {
        const pt = ptAt(pl.g, x, y, true)
        if (!pt) return
        stop(e)
        transient.current = null
        const spec = D.TOOLS[s.drawTool]
        const p0 = { t: pt.t, p: pt.p }
        if (spec.position) {
          // stop ≈ 40 px away, target twice that: readable on any symbol / zoom
          const p40 = pl.g.proj.p(y + 40)
          const slPips = p40 == null ? 20 : Math.max(1, Math.round(Math.abs(pt.p - p40) / inst.pipSize))
          commit(D.newDrawing(s.drawTool, D.buildPosition(s.drawTool, p0, { inst, tfSec, slPips, tpPips: slPips * 2 })))
          return
        }
        if (spec.points === 1) { commit(D.newDrawing(s.drawTool, [p0])); return }
        cr.current = { d: D.newDrawing(s.drawTool, Array.from({ length: spec.points }, () => ({ ...p0 }))), idx: 1, clicks: spec.clicks, downX: x, downY: y, dragged: false }
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        refresh()
        return
      }

      // 3) cursor: pick a drawing
      transient.current = null
      if (dataRef.current.hidden) return
      const f = hitItem(pl, x, y, touch)
      if (f) {
        const { d, item, hit } = f
        if (d.id !== dataRef.current.selId) s.setDrawSel(d.id)
        if (d.locked) { refresh(); return } // selectable but not movable: let the chart pan
        const pt = ptAt(pl.g, x, y)
        if (!pt) return
        stop(e)
        drag.current = { id: d.id, d: item.d, mode: hit.kind === 'handle' ? 'handle' : 'move', idx: hit.idx, startL: pt.l, startP: pt.p, orig: item.d.points.map((q) => ({ ...q })), origOffset: item.d.offset, pid: e.pointerId, moved: false }
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        refresh()
        return
      }
      if (dataRef.current.selId) s.setDrawSel(null)
      refresh()
    }

    const move = (e) => {
      const c = cr.current
      const dg = drag.current
      if (!c && !dg) return
      const pl = plot()
      if (!pl) return
      const { x, y } = pos(e)
      const pt = ptAt(pl.g, x, y, !!c || dg?.mode === 'handle')
      if (!pt) return
      if (c) {
        const spec = D.TOOLS[c.d.type]
        if (c.idx === 1) {
          c.d.points[1] = { t: pt.t, p: pt.p }
          if (spec.points === 3) c.d.points[2] = { t: pt.t, p: pt.p }
          if (Math.hypot(x - c.downX, y - c.downY) > 6) c.dragged = true
        } else if (c.d.type === 'channel') {
          c.d.offset = D.channelOffset(c.d, pl.g.timeMap, pt.l, pt.p)
        } else {
          c.d.points[2] = { t: pt.t, p: pt.p }
        }
        refresh()
        return
      }
      if (!dg.moved) { dg.moved = true; st().pushDrawHist() } // ONE undo step for the whole drag
      const patch = dg.mode === 'move'
        ? { points: D.movePoints(dg.d, dg.orig, pt.l - dg.startL, pt.p - dg.startP, pl.g.timeMap) }
        : D.moveHandle({ ...dg.d, points: dg.orig, offset: dg.origOffset }, dg.idx, pt.t, pt.p, pl.g.timeMap)
      live.current = { id: dg.id, patch }
      refresh()
      stop(e)
    }

    const up = (e) => {
      const c = cr.current
      if (c && c.dragged && c.idx === 1) { // press-drag-release finished the first stroke
        const pl = plot()
        const { x, y } = pos(e)
        const pt = pl && ptAt(pl.g, x, y, true)
        const spec = D.TOOLS[c.d.type]
        if (pt) { c.d.points[1] = { t: pt.t, p: pt.p }; if (spec.points === 3) c.d.points[2] = { t: pt.t, p: pt.p } }
        if (c.clicks === 2) { if (pl) commit(c.d) } else { c.idx = 2; c.dragged = false; refresh() }
      }
      const dg = drag.current
      if (dg) {
        drag.current = null
        try { host.releasePointerCapture(dg.pid) } catch { /* ignore */ }
        const patch = live.current?.id === dg.id ? live.current.patch : null
        live.current = null
        if (dg.moved && patch) st().updateDrawing(dataRef.current.symbol, dg.id, patch, { hist: false })
        refresh()
      }
    }

    // keep the chart's own mouse/touch panning out of an active draw / drag
    const block = (e) => { if (drag.current || cr.current) { e.stopPropagation(); e.preventDefault() } }

    const selectedDrawing = () => {
      const { selId: sel, symbol: sym } = dataRef.current
      return sel ? (st().drawings[sym] || []).find((d) => d.id === sel) : null
    }
    const runMenu = (act, id) => {
      const sym = dataRef.current.symbol
      const d = (st().drawings[sym] || []).find((x) => x.id === id)
      if (!d) return
      const tmap = timeMapRef.current
      if (act === 'settings') st().setDrawDialog(id)
      else if (act === 'clone') st().duplicateDrawing(sym, id, tmap)
      else if (act === 'copy') st().copyDrawing(sym, id)
      else if (act === 'front' || act === 'back') st().reorderDrawing(sym, id, act)
      else if (act === 'lock') st().updateDrawing(sym, id, { locked: !d.locked })
      else if (act === 'hide') { st().updateDrawing(sym, id, { hidden: true }); st().setDrawSel(null) }
      else if (act === 'delete') st().removeDrawing(sym, id)
    }
    menuRun.current = runMenu

    const key = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable
      if (e.key === 'Escape') {
        if (cr.current || transient.current || live.current) { cr.current = null; transient.current = null; live.current = null; drag.current = null; refresh() }
        setEditor(null); setMenu(null)
        return
      }
      if (typing || !activeRef.current) return
      const sym = dataRef.current.symbol
      const d = selectedDrawing()
      const mod = e.ctrlKey || e.metaKey
      if ((e.key === 'Delete' || e.key === 'Backspace') && d) { st().removeDrawing(sym, d.id); e.preventDefault() }
      else if (mod && e.key.toLowerCase() === 'c' && d) { st().copyDrawing(sym, d.id); e.preventDefault() }
      else if (mod && e.key.toLowerCase() === 'v' && st().drawClip) { st().pasteDrawing(sym, timeMapRef.current); e.preventDefault() }
      else if (mod && e.key.toLowerCase() === 'd' && d) { st().duplicateDrawing(sym, d.id, timeMapRef.current); e.preventDefault() }
      else if (d && !d.locked && !mod && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && st().drawTool === 'cursor') {
        const k = e.shiftKey ? 10 : 1
        const dBars = e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0
        const dTicks = e.key === 'ArrowUp' ? k : e.key === 'ArrowDown' ? -k : 0
        st().updateDrawing(sym, d.id, { points: D.nudgePoints(d, dBars, dTicks, 10 ** -inst.digits, timeMapRef.current) })
        e.preventDefault()
      }
    }

    const dbl = (e) => { // double-click a drawing -> its settings dialog
      const pl = plot()
      if (!pl || dataRef.current.hidden || st().drawTool !== 'cursor') return
      const { x, y } = pos(e)
      const f = hitItem(pl, x, y, e.pointerType === 'touch')
      if (f) { st().setDrawSel(f.d.id); st().setDrawDialog(f.d.id) }
    }

    const ctxMenu = (e) => {
      const pl = plot()
      if (!pl || dataRef.current.hidden || st().drawTool !== 'cursor') return
      const { x, y } = pos(e)
      const f = hitItem(pl, x, y, false)
      if (!f) return
      e.preventDefault()
      e.stopImmediatePropagation() // the chart's own order menu must not open as well
      st().setDrawSel(f.d.id)
      setMenu({ x: Math.min(x, Math.max(4, pl.w - 170)), y: Math.min(y, Math.max(4, pl.h - 260)), id: f.d.id })
    }

    const cap = { capture: true }
    host.addEventListener('pointerdown', down, cap)
    host.addEventListener('pointermove', move, cap)
    host.addEventListener('pointerup', up, cap)
    host.addEventListener('pointercancel', up, cap)
    host.addEventListener('mousedown', block, cap)
    host.addEventListener('touchstart', block, cap)
    host.addEventListener('dblclick', dbl)
    host.addEventListener('contextmenu', ctxMenu, cap)
    window.addEventListener('keydown', key)
    return () => {
      host.removeEventListener('pointerdown', down, cap)
      host.removeEventListener('pointermove', move, cap)
      host.removeEventListener('pointerup', up, cap)
      host.removeEventListener('pointercancel', up, cap)
      host.removeEventListener('mousedown', block, cap)
      host.removeEventListener('touchstart', block, cap)
      host.removeEventListener('dblclick', dbl)
      host.removeEventListener('contextmenu', ctxMenu, cap)
      window.removeEventListener('keydown', key)
    }
  }, [hostRef, chartRef, candlesRef, ver, getProj, buildScene, refresh, measure, inst, tfSec, openEditor])

  // Test/debug hook (only when localStorage 'terminal-debug' is set).
  useEffect(() => {
    let on = false
    try { on = !!localStorage.getItem('terminal-debug') } catch { /* ignore */ }
    if (!on) return undefined
    window.__terminalDraw = {
      scene: () => { const g = getProj(); const h = g ? g.series.getPane().getHeight() : 0; const w = g ? g.ts.width() : 0; return buildScene(w, h).items.map((i) => ({ id: i.d.id, type: i.d.type, selected: i.selected, segs: i.lay.segs, handles: i.lay.handles, fills: i.lay.fills.map((f) => ({ alpha: f.alpha, main: !!f.main })), labels: i.lay.labels.map((l) => l.text || l.lines) })) },
      toXY: (t, p) => { const g = getProj(); return g ? { x: g.proj.x(t), y: g.proj.y(p) } : null },
      fromXY: (x, y) => { const g = getProj(); return g ? { t: g.proj.t(x), p: g.proj.p(y) } : null },
      size: () => { const g = getProj(); return g ? { w: g.ts.width(), h: g.series.getPane().getHeight() } : null },
    }
    window.__terminalStore = useTerminalStore
    window.__terminalCandles = () => candlesRef.current
    return () => { delete window.__terminalDraw }
  }, [getProj, buildScene, ver])

  const menuRun = useRef(null)
  const selected = list.find((d) => d.id === selId)
  const st = useTerminalStore.getState
  const menuD = menu && list.find((d) => d.id === menu.id)

  return (
    <>
      {active && tool !== 'cursor' && D.TOOLS[tool] && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <div className="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-lg" style={{ backgroundColor: 'rgba(37,99,235,0.92)' }}>
            {D.TOOLS[tool].name}: {hintOf(tool, D.TOOLS[tool])} · Esc to cancel
          </div>
        </div>
      )}
      {active && selected && !selected.hidden && tool === 'cursor' && !editor && (
        <DrawingBar d={selected} symbol={symbol} onEditText={() => openEditor(selected)} getTimeMap={() => timeMapRef.current} />
      )}
      {menu && menuD && (
        <div className="absolute z-40 w-40 overflow-hidden rounded-lg border py-1 text-[12px] font-semibold shadow-2xl" role="menu" data-testid="draw-menu" style={{ left: menu.x, top: menu.y, backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)' }}>
          {MENU_ITEMS.map(([k, lbl]) => (
            <button key={k} type="button" role="menuitem" onClick={() => { menuRun.current?.(k, menu.id); setMenu(null) }} className={`block w-full px-3 py-1.5 text-left hover:bg-white/10 ${k === 'delete' ? 'text-red-400' : 'text-slate-200'}`}>
              {k === 'lock' ? (menuD.locked ? 'Unlock' : 'Lock') : lbl}
            </button>
          ))}
        </div>
      )}
      {active && <DrawingDialog symbol={symbol} timeMapRef={timeMapRef} />}
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
