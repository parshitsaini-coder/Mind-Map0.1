import { useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import * as E from '../../lib/terminal/engine'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { useQuote } from './hooks'
import { fmtMoney } from './format'

const GREEN = '#22c55e', RED = '#ef4444', BLUE = '#60a5fa', AMBER = '#f59e0b'
const SOLID = 0, DASHED = 2
const PICK_LABEL = { price: 'order price', limit: 'limit price', sl: 'stop loss', tp: 'take profit' }

// Lines for the active symbol: position entry/SL/TP and pending order price/SL/TP.
function buildLines(symbol, positions, orders) {
  const inst = INSTRUMENTS[symbol]
  const out = []
  for (const p of positions) {
    if (p.symbol !== symbol) continue
    const col = p.side === 'buy' ? GREEN : RED
    out.push({ key: `e:${p.id}`, kind: 'entry', id: p.id, price: p.entry, color: col, style: SOLID, p })
    if (p.sl != null) out.push({ key: `s:${p.id}`, kind: 'sl', id: p.id, price: p.sl, color: RED, style: DASHED, drag: true, p })
    if (p.tp != null) out.push({ key: `t:${p.id}`, kind: 'tp', id: p.id, price: p.tp, color: GREEN, style: DASHED, drag: true, p })
  }
  for (const o of orders) {
    if (o.symbol !== symbol) continue
    const base = o.side === 'buy' ? BLUE : AMBER
    out.push({ key: `o:${o.id}`, kind: 'order', id: o.id, price: o.price, color: base, style: DASHED, drag: !o.triggered, o })
    if (o.type === 'stoplimit') out.push({ key: `l:${o.id}`, kind: 'limit', id: o.id, price: o.limitPrice, color: base, style: DASHED, drag: true, o })
    const ref = o.type === 'stoplimit' ? o.limitPrice : o.price
    if (o.sl != null) out.push({ key: `os:${o.id}`, kind: 'osl', id: o.id, price: o.sl, color: RED, style: DASHED, drag: true, o, ref })
    if (o.tp != null) out.push({ key: `ot:${o.id}`, kind: 'otp', id: o.id, price: o.tp, color: GREEN, style: DASHED, drag: true, o, ref })
  }
  return { lines: out, inst }
}

function titleFor(def, price, inst, q) {
  const money = (n) => fmtMoney(n, { sign: true })
  if (def.kind === 'entry') {
    const p = def.p
    const pl = q ? E.pnl(p.side, p.lots, p.entry, E.exitPrice(p.side, q), inst) : null
    return `${p.side.toUpperCase()} ${p.lots}${pl == null ? '' : `  ${money(pl)}`}`
  }
  if (def.kind === 'sl' || def.kind === 'tp') return `${def.kind.toUpperCase()} ${money(E.pnl(def.p.side, def.p.lots, def.p.entry, price, inst))}`
  if (def.kind === 'order' || def.kind === 'limit') return `${def.o.side.toUpperCase()} ${E.ORDER_LABEL[def.o.type]}${def.kind === 'limit' ? ' (limit)' : ''} ${def.o.lots}`
  return `${def.kind === 'osl' ? 'SL' : 'TP'} ${money(E.pnl(def.o.side, def.o.lots, def.ref, price, inst))}`
}

export default function ChartTrading({ hostRef, chartRef, seriesRef, extraRef, symbol, ver, active = true }) {
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const pickReq = useTerminalStore((s) => s.pickReq)
  const quote = useQuote(symbol)
  const linesRef = useRef(new Map()) // key -> { def, line }
  const dragRef = useRef(null)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])
  const [menu, setMenu] = useState(null) // { x, y, price }
  const [rev, setRev] = useState(0) // bump to rebuild lines (e.g. after a rejected drag)

  // (Re)create price lines whenever positions / orders / series change (not mid-drag).
  useEffect(() => {
    const series = seriesRef.current
    if (!series || dragRef.current) return undefined
    const { lines, inst } = buildLines(symbol, positions, orders)
    const q = getSnapshot()[symbol]
    const map = linesRef.current
    for (const { line } of map.values()) { try { series.removePriceLine(line) } catch { /* series replaced */ } }
    map.clear()
    extraRef.current = lines.map((l) => l.price)
    for (const def of lines) {
      const line = series.createPriceLine({ price: def.price, color: def.color, lineWidth: 1, lineStyle: def.style, axisLabelVisible: true, title: titleFor(def, def.price, inst, q) })
      map.set(def.key, { def, line })
    }
    return () => {
      for (const { line } of map.values()) { try { series.removePriceLine(line) } catch { /* ignore */ } }
      map.clear()
      extraRef.current = []
    }
  }, [symbol, positions, orders, ver, rev, seriesRef, extraRef])

  // Keep the live P&L in entry labels fresh.
  useEffect(() => {
    if (!quote || dragRef.current) return
    const inst = INSTRUMENTS[symbol]
    for (const { def, line } of linesRef.current.values()) {
      if (def.kind === 'entry') line.applyOptions({ title: titleFor(def, def.price, inst, quote) })
    }
  }, [quote, symbol])

  // Drag lines, right-click / long-press menu, tap-to-pick.
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

    const down = (e) => {
      if (e.button != null && e.button !== 0) return
      setMenu(null)
      const y = yOf(e)
      const tol = e.pointerType === 'touch' ? 22 : 8
      const entry = hit(y, tol)
      if (entry) {
        dragRef.current = { entry, id: e.pointerId }
        e.stopPropagation()
        e.preventDefault()
        try { host.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        return
      }
      if (e.pointerType === 'touch') {
        const x = xOf(e), sy = y
        press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { const p = priceAt(sy); if (p != null) setMenu({ x, y: sy, price: p, w: host.clientWidth, h: host.clientHeight }); press = null }, 550) }
      }
    }
    const move = (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) clearPress()
      const d = dragRef.current
      if (!d) return
      const p = priceAt(yOf(e))
      if (p == null) return
      const inst = INSTRUMENTS[symbol]
      const price = +p.toFixed(inst.digits)
      d.price = price
      d.entry.line.applyOptions({ price, title: titleFor(d.entry.def, price, inst, getSnapshot()[symbol]) })
      e.stopPropagation()
    }
    const up = (e) => {
      clearPress()
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      try { host.releasePointerCapture(d.id) } catch { /* ignore */ }
      if (d.price == null || d.price === d.entry.def.price) { setRev((r) => r + 1); return }
      const { def } = d.entry
      const quotes = getSnapshot()
      const s = st()
      const r = def.kind === 'sl' || def.kind === 'tp' ? s.modifyPosition(def.id, { [def.kind]: d.price }, quotes)
        : def.kind === 'order' ? s.modifyOrder(def.id, { price: d.price }, quotes)
        : def.kind === 'limit' ? s.modifyOrder(def.id, { limitPrice: d.price }, quotes)
        : s.modifyOrder(def.id, { [def.kind === 'osl' ? 'sl' : 'tp']: d.price }, quotes)
      if (!r.ok) setRev((x) => x + 1) // rejected -> snap back (the store already showed why)
    }
    // Stop the chart's own mouse/touch pan while a line is being dragged.
    const block = (e) => { if (dragRef.current) { e.stopPropagation(); e.preventDefault() } }
    const ctx = (e) => {
      e.preventDefault()
      const y = yOf(e)
      const p = priceAt(y)
      if (p != null) setMenu({ x: xOf(e), y, price: p, w: host.clientWidth, h: host.clientHeight })
    }
    const cap = { capture: true }
    host.addEventListener('pointerdown', down, cap)
    host.addEventListener('pointermove', move, cap)
    host.addEventListener('pointerup', up, cap)
    host.addEventListener('pointercancel', up, cap)
    host.addEventListener('mousedown', block, cap)
    host.addEventListener('touchstart', block, cap)
    host.addEventListener('contextmenu', ctx)
    const onClick = (param) => {
      const req = st().pickReq
      if (!req || !param?.point || !activeRef.current) return
      const p = priceAt(param.point.y)
      if (p != null) st().setPickRes(req, +p.toFixed(INSTRUMENTS[symbol].digits))
    }
    chart.subscribeClick(onClick)
    const esc = (e) => { if (e.key === 'Escape') { setMenu(null); if (st().pickReq) st().setPickReq(null) } }
    window.addEventListener('keydown', esc)
    return () => {
      clearPress()
      host.removeEventListener('pointerdown', down, cap)
      host.removeEventListener('pointermove', move, cap)
      host.removeEventListener('pointerup', up, cap)
      host.removeEventListener('pointercancel', up, cap)
      host.removeEventListener('mousedown', block, cap)
      host.removeEventListener('touchstart', block, cap)
      host.removeEventListener('contextmenu', ctx)
      try { chart.unsubscribeClick(onClick) } catch { /* chart disposed */ }
      window.removeEventListener('keydown', esc)
    }
  }, [hostRef, chartRef, seriesRef, symbol, ver])

  // Test/debug hook (only when localStorage 'terminal-debug' is set): line positions in px.
  useEffect(() => {
    let on = false
    try { on = !!localStorage.getItem('terminal-debug') } catch { /* ignore */ }
    if (!on) return undefined
    window.__terminalLines = () => [...linesRef.current.values()].map(({ def }) => ({ key: def.key, kind: def.kind, price: def.price, y: seriesRef.current?.priceToCoordinate(def.price) }))
    window.__terminalPriceToY = (p) => seriesRef.current?.priceToCoordinate(p)
    return () => { delete window.__terminalLines; delete window.__terminalPriceToY }
  }, [seriesRef, ver])

  const doPlace = (type, side) => {
    const s = useTerminalStore.getState()
    const price = +menu.price.toFixed(INSTRUMENTS[symbol].digits)
    const res = s.placeOrder({ symbol, type, side, lots: s.settings.lots, price }, getSnapshot())
    if (!res.ok) s.notify(res.error, 'error')
    setMenu(null)
  }

  const q = getSnapshot()[symbol]
  const above = q && menu ? menu.price > q.bid : false
  const below = q && menu ? menu.price < q.ask : false
  const d = INSTRUMENTS[symbol].digits
  const items = !menu || !q ? [] : below && !above
    ? [['limit', 'buy', 'Buy limit'], ['stop', 'sell', 'Sell stop']]
    : above && !below ? [['limit', 'sell', 'Sell limit'], ['stop', 'buy', 'Buy stop']] : []

  return (
    <>
      {pickReq && active && (
        <div className="absolute inset-x-0 top-2 z-10 flex justify-center">
          <div className="flex items-center gap-3 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-lg" style={{ backgroundColor: '#2563eb' }}>
            Tap the chart to set the {PICK_LABEL[pickReq]}
            <button type="button" onClick={() => useTerminalStore.getState().setPickReq(null)} className="rounded bg-black/30 px-2 py-0.5 text-[11px]">Cancel</button>
          </div>
        </div>
      )}
      {menu && (
        <div className="absolute z-20 min-w-[170px] overflow-hidden rounded-lg border shadow-xl"
          style={{ left: Math.max(4, Math.min(menu.x, menu.w - 180)), top: Math.max(4, Math.min(menu.y, menu.h - 120)), backgroundColor: '#1a222c', borderColor: '#334155' }}>
          <div className="px-3 py-1.5 text-[11px] font-bold tabular-nums text-slate-400">@ {menu.price.toFixed(d)}</div>
          {items.length ? items.map(([type, side, text]) => (
            <button key={text} type="button" onClick={() => doPlace(type, side)} className="block w-full px-3 py-2.5 text-left text-[13px] font-bold hover:bg-white/10" style={{ color: side === 'buy' ? '#4ade80' : '#f87171' }}>{text} here</button>
          )) : <div className="px-3 py-2 text-[12px] text-slate-400">Too close to the current price</div>}
          <button type="button" onClick={() => setMenu(null)} className="block w-full border-t px-3 py-2 text-left text-[12px] text-slate-400 hover:bg-white/10" style={{ borderColor: '#334155' }}>Cancel</button>
        </div>
      )}
    </>
  )
}
