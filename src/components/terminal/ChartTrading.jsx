import { useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import * as E from '../../lib/terminal/engine'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { useQuote } from './hooks'
import { LINE_STYLE } from '../../lib/terminal/chartSettings'
import { plFigures, fmtFigure, levelTag, validateDrag, snapPrice, barLevels, breakEvenSnap } from '../../lib/terminal/chartOrders'
import { newDrawing } from '../../lib/terminal/drawings'
import { commitPatch, undoAny, redoAny } from './chartActions'

const SOLID = 0
const AMBER = '#f59e0b'
const PICK_LABEL = { price: 'order price', limit: 'limit price', sl: 'stop loss', tp: 'take profit' }
const FIELD = { sl: 'sl', tp: 'tp', order: 'price', limit: 'limitPrice', osl: 'sl', otp: 'tp' }

// Lines for the active symbol: position entry/SL/TP and pending order price/SL/TP.
function buildLines(symbol, positions, orders, t) {
  const inst = INSTRUMENTS[symbol]
  const out = []
  const DASHED = LINE_STYLE[t.lineStyle]
  const GREEN = t.colorTP, RED = t.colorSL
  for (const p of positions) {
    if (!t.showPositions || p.symbol !== symbol) continue
    const col = p.side === 'buy' ? t.colorBuy : t.colorSell
    out.push({ key: `e:${p.id}`, kind: 'entry', id: p.id, price: p.entry, color: col, style: SOLID, p })
    if (p.sl != null) out.push({ key: `s:${p.id}`, kind: 'sl', id: p.id, price: p.sl, color: RED, style: DASHED, drag: true, p })
    if (p.tp != null) out.push({ key: `t:${p.id}`, kind: 'tp', id: p.id, price: p.tp, color: GREEN, style: DASHED, drag: true, p })
  }
  for (const o of orders) {
    if (!t.showOrders || o.symbol !== symbol) continue
    const base = o.side === 'buy' ? t.colorBuyPending : t.colorSellPending
    out.push({ key: `o:${o.id}`, kind: 'order', id: o.id, price: o.price, color: base, style: DASHED, drag: !o.triggered, o })
    if (o.type === 'stoplimit') out.push({ key: `l:${o.id}`, kind: 'limit', id: o.id, price: o.limitPrice, color: base, style: DASHED, drag: true, o })
    const ref = o.type === 'stoplimit' ? o.limitPrice : o.price
    if (o.sl != null) out.push({ key: `os:${o.id}`, kind: 'osl', id: o.id, price: o.sl, color: RED, style: DASHED, drag: true, o, ref })
    if (o.tp != null) out.push({ key: `ot:${o.id}`, kind: 'otp', id: o.id, price: o.tp, color: GREEN, style: DASHED, drag: true, o, ref })
  }
  return { lines: out, inst }
}

const balanceNow = () => useTerminalStore.getState().account.balance || 0

// The text on a line's axis tag, for the price it currently sits at (or is being dragged to).
function titleFor(def, price, inst, q, unit, pill) {
  if (def.kind === 'entry') {
    if (pill) return '' // the pill carries side, lots and P/L
    const p = def.p
    const f = q ? plFigures({ side: p.side, lots: p.lots, from: p.entry, to: E.exitPrice(p.side, q), inst, balance: balanceNow(), riskPrice: p.sl }) : null
    return `${p.side.toUpperCase()} ${p.lots}${f ? `  ${fmtFigure(f, unit)}` : ''}`
  }
  if (def.kind === 'sl' || def.kind === 'tp') {
    const p = def.p
    return levelTag(def.kind.toUpperCase(), plFigures({ side: p.side, lots: p.lots, from: p.entry, to: price, inst, balance: balanceNow(), riskPrice: def.kind === 'tp' ? p.sl : null }))
  }
  if (def.kind === 'order' || def.kind === 'limit') return `${def.o.side.toUpperCase()} ${E.ORDER_LABEL[def.o.type]}${def.kind === 'limit' ? ' (limit)' : ''} ${def.o.lots}`
  const o = def.o
  return levelTag(def.kind === 'osl' ? 'SL' : 'TP', plFigures({ side: o.side, lots: o.lots, from: def.ref, to: price, inst, balance: balanceNow(), riskPrice: def.kind === 'otp' ? o.sl : null }))
}

export default function ChartTrading({ hostRef, chartRef, seriesRef, candlesRef, extraRef, symbol, ver, active = true }) {
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const pickReq = useTerminalStore((s) => s.pickReq)
  const tr = useTerminalStore((s) => s.chartSettings.trading)
  const placement = useTerminalStore((s) => s.chartSettings.scales.placement)
  const unit = tr.plUnit
  const pill = tr.showPlPill
  const quote = useQuote(symbol)
  const linesRef = useRef(new Map()) // key -> { def, line }
  const dragRef = useRef(null)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const trRef = useRef(tr)
  trRef.current = tr
  const plusRef = useRef(null)
  const [menu, setMenu] = useState(null) // { x, y, price }
  const [rev, setRev] = useState(0) // bump to rebuild lines (e.g. after a rejected drag)

  // (Re)create price lines whenever positions / orders / series change (not mid-drag).
  useEffect(() => {
    const series = seriesRef.current
    if (!series || dragRef.current) return undefined
    const { lines, inst } = buildLines(symbol, positions, orders, tr)
    const q = getSnapshot()[symbol]
    const map = linesRef.current
    for (const { line } of map.values()) { try { series.removePriceLine(line) } catch { /* series replaced */ } }
    map.clear()
    extraRef.current = lines.map((l) => l.price)
    for (const def of lines) {
      const levelLine = def.kind === 'sl' || def.kind === 'tp' || def.kind === 'osl' || def.kind === 'otp'
      const line = series.createPriceLine({
        price: def.price, color: def.color, lineWidth: tr.lineWidth, lineStyle: def.style, axisLabelVisible: true,
        lineVisible: !(levelLine && !tr.extendLines), title: titleFor(def, def.price, inst, q, unit, pill),
      })
      map.set(def.key, { def, line })
    }
    return () => {
      for (const { line } of map.values()) { try { series.removePriceLine(line) } catch { /* ignore */ } }
      map.clear()
      extraRef.current = []
    }
  }, [symbol, positions, orders, ver, rev, seriesRef, extraRef, tr, unit, pill])

  // Keep the live P&L in entry labels fresh (only matters when the pill is off) and the SL/TP tags
  // honest about the CURRENT lots / entry.
  useEffect(() => {
    if (!quote || dragRef.current || pill) return
    const inst = INSTRUMENTS[symbol]
    for (const { def, line } of linesRef.current.values()) {
      if (def.kind === 'entry') line.applyOptions({ title: titleFor(def, def.price, inst, quote, unit, pill) })
    }
  }, [quote, symbol, unit, pill])

  // Drag lines, right-click / long-press menu, hover "+", tap-to-pick.
  useEffect(() => {
    const host = hostRef.current
    const chart = chartRef.current
    if (!host || !chart) return undefined
    host.style.touchAction = 'none'
    const st = () => useTerminalStore.getState()
    const yOf = (e) => e.clientY - host.getBoundingClientRect().top
    const xOf = (e) => e.clientX - host.getBoundingClientRect().left
    const priceAt = (y) => seriesRef.current?.coordinateToPrice(y)
    const hit = (y, tol) => {
      const series = seriesRef.current
      let best = null
      for (const entry of linesRef.current.values()) {
        if (!entry.def.drag) continue
        const yc = series.priceToCoordinate(entry.def.price)
        if (yc == null) continue
        const d = Math.abs(yc - y)
        if (d <= tol && (!best || d < best.d)) best = { entry, d }
      }
      return best?.entry
    }
    let press = null // long-press tracker
    const clearPress = () => { if (press) { clearTimeout(press.timer); press = null } }
    const openMenuAt = (x, y, p) => setMenu({ x, y, price: p, w: host.clientWidth, h: host.clientHeight })

    const down = (e) => {
      if (e.button != null && e.button !== 0) return
      setMenu(null)
      const y = yOf(e)
      const tol = e.pointerType === 'touch' ? 22 : 8
      const entry = hit(y, tol)
      if (entry) {
        dragRef.current = { entry, id: e.pointerId, price: null, bad: null, dy: (seriesRef.current.priceToCoordinate(entry.def.price) ?? y) - y } // dy: keep the grab offset (a finger covers the line)
        e.stopPropagation()
        e.preventDefault()
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        // show a hidden SL/TP line while it is being moved (Settings: extend lines off)
        entry.line.applyOptions({ lineVisible: true })
        return
      }
      if (e.pointerType === 'touch') {
        const x = xOf(e), sy = y
        press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { const p = priceAt(sy); if (p != null) openMenuAt(x, sy, p); press = null }, 550) }
      }
    }

    const dragPrice = (e, raw, def) => {
      const inst = INSTRUMENTS[symbol]
      const t = trRef.current
      const tolPrice = Math.abs((priceAt(yOf(e) + 6) ?? raw) - raw)
      const levels = t.snap === 'bars' && candlesRef?.current ? barLevels(candlesRef.current) : []
      let price = snapPrice(raw, { mode: t.snap, inst, levels, tol: tolPrice, fine: e.shiftKey, coarse: e.ctrlKey || e.metaKey })
      if (def.kind === 'sl') price = breakEvenSnap(price, def.p.entry, inst)
      return price
    }
    const move = (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearPress()
      const d = dragRef.current
      if (!d) {
        // hover feedback + the "+" next to the price scale (mouse only)
        if (e.pointerType !== 'touch') {
          const y = yOf(e)
          host.style.cursor = hit(y, 8) ? 'ns-resize' : ''
          const plus = plusRef.current
          if (plus) {
            const w = chart.priceScale(placement).width()
            const x = xOf(e)
            const onScale = placement === 'right' ? x >= host.clientWidth - w : x <= w
            if (onScale && priceAt(y) != null) { plus.style.display = 'flex'; plus.style.top = `${y - 11}px`; plus.style[placement === 'right' ? 'right' : 'left'] = `${w + 2}px`; plus.dataset.y = String(y) }
            else plus.style.display = 'none'
          }
        }
        return
      }
      const raw = priceAt(yOf(e) + d.dy)
      if (raw == null) return
      const inst = INSTRUMENTS[symbol]
      const { def } = d.entry
      const price = dragPrice(e, raw, def)
      const bad = validateDrag({ kind: def.kind, price, pos: def.p, order: def.o, q: getSnapshot()[symbol], inst })
      d.price = price
      d.bad = bad
      const base = titleFor(def, price, inst, null, unit, pill)
      d.entry.line.applyOptions({ price, color: bad ? AMBER : def.color, title: bad ? `${base} — ${bad}` : base })
      // The price scale is deliberately NOT re-fitted while dragging: it would move under the pointer and the
      // line would run away. It re-fits on release (the new level is part of the rebuilt lines).
      e.stopPropagation()
    }
    const up = () => {
      clearPress()
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      try { host.releasePointerCapture(d.id) } catch { /* ignore */ }
      const { def } = d.entry
      if (d.price == null || d.price === def.price) { setRev((r) => r + 1); return }
      if (d.bad) { st().notify(`${d.bad} — line put back`, 'error'); setRev((x) => x + 1); return } // spring back
      const target = def.kind === 'sl' || def.kind === 'tp' ? 'position' : 'order'
      const r = commitPatch(target, def.id, { [FIELD[def.kind]]: d.price })
      if (!r.ok) setRev((x) => x + 1)
    }
    // Stop the chart's own mouse/touch pan + wheel zoom while a line is being dragged.
    const block = (e) => { if (dragRef.current) { e.stopPropagation(); e.preventDefault() } }
    // moving from the price scale onto the "+" itself must not hide it
    const leave = (e) => { if (plusRef.current && e.relatedTarget !== plusRef.current) plusRef.current.style.display = 'none' }
    const ctx = (e) => {
      e.preventDefault()
      const y = yOf(e)
      const p = priceAt(y)
      if (p != null) openMenuAt(xOf(e), y, p)
    }
    const cap = { capture: true }
    host.addEventListener('pointerdown', down, cap)
    host.addEventListener('pointermove', move, cap)
    host.addEventListener('pointerup', up, cap)
    host.addEventListener('pointercancel', up, cap)
    host.addEventListener('pointerleave', leave)
    host.addEventListener('mousedown', block, cap)
    host.addEventListener('touchstart', block, cap)
    host.addEventListener('wheel', block, { capture: true, passive: false })
    host.addEventListener('contextmenu', ctx)
    const onClick = (param) => {
      const req = st().pickReq
      if (!req || !param?.point || !activeRef.current) return
      const p = priceAt(param.point.y)
      if (p != null) st().setPickRes(req, +p.toFixed(INSTRUMENTS[symbol].digits))
    }
    chart.subscribeClick(onClick)
    const keys = (e) => {
      if (e.key === 'Escape') { setMenu(null); if (st().pickReq) st().setPickReq(null) }
      if ((e.ctrlKey || e.metaKey) && activeRef.current && !/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) { if (undoAny()) e.preventDefault() }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { if (redoAny()) e.preventDefault() }
      }
    }
    window.addEventListener('keydown', keys)
    return () => {
      clearPress()
      host.style.cursor = ''
      host.removeEventListener('pointerdown', down, cap)
      host.removeEventListener('pointermove', move, cap)
      host.removeEventListener('pointerup', up, cap)
      host.removeEventListener('pointercancel', up, cap)
      host.removeEventListener('pointerleave', leave)
      host.removeEventListener('mousedown', block, cap)
      host.removeEventListener('touchstart', block, cap)
      host.removeEventListener('wheel', block, { capture: true })
      host.removeEventListener('contextmenu', ctx)
      try { chart.unsubscribeClick(onClick) } catch { /* chart disposed */ }
      window.removeEventListener('keydown', keys)
    }
  }, [hostRef, chartRef, seriesRef, candlesRef, extraRef, symbol, ver, unit, pill, placement])

  // Test/debug hook (only when localStorage 'terminal-debug' is set): line positions in px.
  useEffect(() => {
    let on = false
    try { on = !!localStorage.getItem('terminal-debug') } catch { /* ignore */ }
    if (!on) return undefined
    window.__terminalLines = () => [...linesRef.current.values()].map(({ def, line }) => ({ key: def.key, kind: def.kind, price: def.price, y: seriesRef.current?.priceToCoordinate(def.price), title: line.options().title }))
    window.__terminalPriceToY = (p) => seriesRef.current?.priceToCoordinate(p)
    return () => { delete window.__terminalLines; delete window.__terminalPriceToY }
  }, [seriesRef, ver])

  const st = useTerminalStore.getState
  const q = getSnapshot()[symbol]
  const d = INSTRUMENTS[symbol].digits
  const above = q && menu ? menu.price > q.bid : false
  const below = q && menu ? menu.price < q.ask : false
  const items = !menu || !q ? [] : below && !above
    ? [['limit', 'buy', 'Buy limit'], ['stop', 'sell', 'Sell stop']]
    : above && !below ? [['limit', 'sell', 'Sell limit'], ['stop', 'buy', 'Buy stop']] : []
  const oneClick = useTerminalStore((s) => s.settings.oneClick)

  const doOrder = (type, side) => {
    const s = st()
    const price = +menu.price.toFixed(d)
    if (oneClick) {
      const res = s.placeOrder({ symbol, type, side, lots: s.settings.lots, price }, getSnapshot())
      if (!res.ok) s.notify(res.error, 'error')
    } else s.prefillTicket({ type, side, price })
    setMenu(null)
  }
  const drawLine = () => {
    st().addDrawing(symbol, newDrawing('hline', [{ t: Math.floor(Date.now() / 1000), p: +menu.price.toFixed(d) }]))
    setMenu(null)
  }
  const openPlus = () => {
    const plus = plusRef.current
    const y = Number(plus?.dataset.y)
    const p = Number.isFinite(y) ? seriesRef.current?.coordinateToPrice(y) : null
    const host = hostRef.current
    if (p != null && host) setMenu({ x: host.clientWidth - 200, y, price: p, w: host.clientWidth, h: host.clientHeight })
  }

  return (
    <>
      <button ref={plusRef} type="button" onClick={openPlus} onPointerLeave={(e) => { if (!hostRef.current?.contains(e.relatedTarget)) e.currentTarget.style.display = 'none' }} aria-label="Order or line at this price" title="Order or line at this price"
        className="absolute z-[6] hidden h-[22px] w-[22px] items-center justify-center rounded border text-[15px] font-bold leading-none"
        style={{ backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>+</button>
      {pickReq && active && (
        <div className="absolute inset-x-0 top-2 z-10 flex justify-center">
          <div className="flex items-center gap-3 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-lg" style={{ backgroundColor: '#2563eb' }}>
            Tap the chart to set the {PICK_LABEL[pickReq]}
            <button type="button" onClick={() => useTerminalStore.getState().setPickReq(null)} className="rounded bg-black/30 px-2 py-0.5 text-[11px]">Cancel</button>
          </div>
        </div>
      )}
      {menu && (
        <div className="absolute z-20 min-w-[190px] overflow-hidden rounded-lg border shadow-xl" role="menu" aria-label="Chart menu"
          style={{ left: Math.max(4, Math.min(menu.x, menu.w - 200)), top: Math.max(4, Math.min(menu.y, menu.h - 190)), backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>
          <div className="px-3 py-1.5 text-[11px] font-bold tabular-nums" style={{ color: 'var(--tm-muted)' }}>@ {menu.price.toFixed(d)}</div>
          {items.length ? items.map(([type, side, text]) => (
            <button key={text} type="button" role="menuitem" onClick={() => doOrder(type, side)} className="tm-pbtn block w-full px-3 text-left text-[13px] font-bold hover:bg-white/10" style={{ color: side === 'buy' ? '#4ade80' : '#f87171' }}>{text} here{oneClick ? '' : '…'}</button>
          )) : <div className="px-3 py-2 text-[12px]" style={{ color: 'var(--tm-muted)' }}>Too close to the current price</div>}
          <button type="button" role="menuitem" onClick={drawLine} className="tm-pbtn block w-full border-t px-3 text-left text-[13px] font-semibold hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)' }}>Draw horizontal line</button>
          <button type="button" onClick={() => setMenu(null)} className="tm-pbtn block w-full border-t px-3 text-left text-[12px] hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-muted)' }}>Cancel</button>
        </div>
      )}
    </>
  )
}
