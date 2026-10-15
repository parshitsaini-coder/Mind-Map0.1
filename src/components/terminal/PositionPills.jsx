import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Repeat, MoreHorizontal } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import * as E from '../../lib/terminal/engine'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { useQuote } from './hooks'
import { plFigures, fmtFigure, levelTag, nextPlUnit, defaultStop, atrOf, validateDrag, spreadY, validateCloseLots } from '../../lib/terminal/chartOrders'
import { commitPatch } from './chartActions'
import { pnlColor } from './format'

const AMBER = '#f59e0b'
const PILL_H = 28

// Small icon / text button used inside the pills (>= 40 px on touch screens via .tm-pbtn).
function PBtn({ label, onClick, children, className = '', style }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}
      className={`tm-pbtn flex shrink-0 items-center justify-center rounded px-1.5 text-[11px] font-bold ${className}`} style={style}>{children}</button>
  )
}

// ── the "…" menu of a position ──
function PositionMenu({ p, inst, onClose, onPlace }) {
  const [mode, setMode] = useState(null) // 'lots' | 'trail'
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const s = useTerminalStore.getState
  const item = 'tm-pbtn block w-full px-3 text-left text-[12px] font-semibold hover:bg-white/10'
  const run = (fn) => { fn(); onClose() }
  const submit = () => {
    const n = Number(val)
    if (mode === 'lots') {
      const e = validateCloseLots(p.lots, n, inst)
      if (e) { setErr(e); return }
      if (s().closeLots(p.id, n, getSnapshot()).ok) onClose()
    } else {
      if (!(n > 0)) { setErr('Enter a trailing distance in pips'); return }
      const r = s().modifyPosition(p.id, { trail: n }, getSnapshot())
      if (!r.ok) { setErr(r.error); return }
      s().notify(`Trailing stop set: ${n} pips`, 'info')
      onClose()
    }
  }
  return (
    <div role="menu" aria-label={`Position ${p.id} menu`} className="absolute left-0 top-full z-30 mt-1 min-w-[210px] overflow-hidden rounded-lg border shadow-xl" style={{ backgroundColor: 'var(--tm-panel2)', borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>
      {mode ? (
        <div className="p-2">
          <label className="text-[11px]" style={{ color: 'var(--tm-muted)' }} htmlFor={`pm-${p.id}`}>{mode === 'lots' ? `Lots to close (of ${p.lots})` : 'Trail distance (pips)'}</label>
          <div className="mt-1 flex gap-1">
            <input id={`pm-${p.id}`} autoFocus inputMode="decimal" value={val} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="h-9 min-w-0 flex-1 rounded border bg-transparent px-2 text-[13px] outline-none focus:border-sky-400" style={{ borderColor: 'var(--tm-border2)' }} />
            <button type="button" onClick={submit} className="h-9 rounded bg-blue-600 px-3 text-[12px] font-bold text-white">OK</button>
          </div>
          {err && <div className="pt-1 text-[11px] text-amber-400" role="alert">{err}</div>}
        </div>
      ) : (
        <>
          <button type="button" role="menuitem" className={item} onClick={() => run(() => s().partialClose(p.id, 50, getSnapshot()))}>Close half</button>
          <button type="button" role="menuitem" className={item} onClick={() => { setMode('lots'); setVal(String(Math.max(inst.minLot, Math.floor(p.lots / 2 / inst.lotStep) * inst.lotStep).toFixed(2))) }}>Close custom lots{'…'}</button>
          <button type="button" role="menuitem" className={item} onClick={() => run(() => { const r = s().breakEven(p.id, getSnapshot()); if (!r.ok) s().notify(r.error, 'error') })}>Move SL to break-even</button>
          {p.sl == null && <button type="button" role="menuitem" className={item} onClick={() => run(() => onPlace(p.id, 'sl'))}>Add stop loss</button>}
          {p.tp == null && <button type="button" role="menuitem" className={item} onClick={() => run(() => onPlace(p.id, 'tp'))}>Add take profit</button>}
          <button type="button" role="menuitem" className={item} onClick={() => { setMode('trail'); setVal('15') }}>Trail SL{'…'}</button>
          <button type="button" role="menuitem" className={item} onClick={() => run(() => { try { navigator.clipboard?.writeText(p.id) } catch { /* denied */ } s().notify(`Ticket id ${p.id} copied`, 'info') })}>Copy ticket id ({p.id})</button>
        </>
      )}
      <button type="button" onClick={onClose} className="tm-pbtn block w-full border-t px-3 text-left text-[12px] hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-muted)' }}>Close menu</button>
    </div>
  )
}

function PositionPill({ p, q, unit, tr, balance, reg, onPlace, onBracket }) {
  const inst = INSTRUMENTS[p.symbol]
  const [menu, setMenu] = useState(false)
  const col = p.side === 'buy' ? tr.colorBuy : tr.colorSell
  const f = q ? plFigures({ side: p.side, lots: p.lots, from: p.entry, to: E.exitPrice(p.side, q), inst, balance, riskPrice: p.sl }) : null
  const chip = f ? fmtFigure(f, unit) : '…'
  const doClose = () => {
    if (tr.confirmClose && !window.confirm(`Close ${p.side.toUpperCase()} ${p.lots} ${p.symbol}?`)) return
    useTerminalStore.getState().closePosition(p.id, getSnapshot())
  }
  const doReverse = () => {
    if (tr.confirmClose && !window.confirm(`Reverse ${p.side.toUpperCase()} ${p.lots} ${p.symbol}?`)) return
    useTerminalStore.getState().reversePosition(p.id, getSnapshot())
  }
  const ghost = { color: 'var(--tm-muted)', border: '1px dashed var(--tm-border2)' }
  return (
    <div ref={(el) => reg(`pos:${p.id}`, el, p.entry)} data-testid={`pill-${p.id}`} data-pill="position" className="pointer-events-auto absolute left-2 top-0 z-[7] flex items-center gap-1 rounded-md border px-1 shadow-lg will-change-transform"
      style={{ height: PILL_H, backgroundColor: 'var(--tm-panel)', borderColor: col, color: 'var(--tm-text)', display: 'none' }}>
      <span className="rounded px-1.5 text-[11px] font-extrabold tabular-nums" style={{ backgroundColor: col, color: '#fff' }}>{p.side.toUpperCase()} {p.lots}</span>
      <PBtn label={`Profit and loss ${chip}. Click to change the unit`} onClick={() => useTerminalStore.getState().setChartSettings({ trading: { plUnit: nextPlUnit(unit) } })} className="tabular-nums" style={{ color: f ? pnlColor(f.money) : undefined }}>
        <span data-testid={`chip-${p.id}`}>{chip}</span>
      </PBtn>
      {p.sl == null && <PBtn label="Add stop loss: click, then click the chart" onClick={() => onPlace(p.id, 'sl')} className="hidden sm:flex" style={ghost}>+SL</PBtn>}
      {p.tp == null && <PBtn label="Add take profit: click, then click the chart" onClick={() => onPlace(p.id, 'tp')} className="hidden sm:flex" style={ghost}>+TP</PBtn>}
      {(p.sl == null || p.tp == null) && <PBtn label="Quick bracket from the default SL / TP distances" onClick={() => onBracket(p)} className="hidden sm:flex" style={ghost}>{'⚡'}</PBtn>}
      {tr.reverseBtn && <PBtn label="Reverse position" onClick={doReverse} className="hover:bg-white/10"><Repeat size={13} /></PBtn>}
      <PBtn label="Close position" onClick={doClose} className="hover:bg-white/10"><X size={14} /></PBtn>
      <div className="relative">
        <PBtn label="More actions" onClick={() => setMenu((v) => !v)} className="hover:bg-white/10"><MoreHorizontal size={14} /></PBtn>
        {menu && <PositionMenu p={p} inst={inst} onClose={() => setMenu(false)} onPlace={onPlace} />}
      </div>
    </div>
  )
}

function OrderPill({ o, tr, reg, onPlace, onBracket }) {
  const col = o.side === 'buy' ? tr.colorBuyPending : tr.colorSellPending
  const inst = INSTRUMENTS[o.symbol]
  const ghost = { color: 'var(--tm-muted)', border: '1px dashed var(--tm-border2)' }
  const cancel = () => {
    if (tr.confirmCancel && !window.confirm(`Cancel this ${E.ORDER_LABEL[o.type]} order?`)) return
    useTerminalStore.getState().cancelOrder(o.id)
  }
  return (
    <div ref={(el) => reg(`ord:${o.id}`, el, o.price)} data-testid={`pill-${o.id}`} data-pill="order" className="pointer-events-auto absolute left-2 top-0 z-[7] flex items-center gap-1 rounded-md border px-1 shadow-lg will-change-transform"
      style={{ height: PILL_H, backgroundColor: 'var(--tm-panel)', borderColor: col, color: 'var(--tm-text)', display: 'none' }}>
      <span className="rounded px-1.5 text-[11px] font-extrabold tabular-nums" style={{ backgroundColor: col, color: '#0b1220' }}>{o.side.toUpperCase()} {E.ORDER_LABEL[o.type]} {o.lots}</span>
      <span className="px-1 text-[11px] tabular-nums" style={{ color: 'var(--tm-muted)' }}>@ {o.price.toFixed(inst.digits)}</span>
      {o.sl == null && <PBtn label="Add stop loss to this order: click, then click the chart" onClick={() => onPlace(o.id, 'sl', 'order')} className="hidden sm:flex" style={ghost}>+SL</PBtn>}
      {o.tp == null && <PBtn label="Add take profit to this order: click, then click the chart" onClick={() => onPlace(o.id, 'tp', 'order')} className="hidden sm:flex" style={ghost}>+TP</PBtn>}
      {(o.sl == null || o.tp == null) && <PBtn label="Quick bracket from the default SL / TP distances" onClick={() => onBracket(o, 'order')} className="hidden sm:flex" style={ghost}>{'\u26A1'}</PBtn>}
      <PBtn label="Cancel order" onClick={cancel} className="hover:bg-white/10"><X size={14} /></PBtn>
    </div>
  )
}

// "+SL / +TP" place mode: a ghost line follows the pointer with the projected result; a click commits.
function PlaceLayer({ target, symbol, seriesRef, onDone }) {
  const [y, setY] = useState(null)
  const isOrder = target.on === 'order'
  const st0 = useTerminalStore.getState()
  const p = isOrder ? st0.orders.find((x) => x.id === target.id) : st0.positions.find((x) => x.id === target.id)
  const kindKey = isOrder ? (target.kind === 'sl' ? 'osl' : 'otp') : target.kind
  const refPrice = p ? (isOrder ? E.orderFillLevel(p) : p.entry) : 0
  const inst = INSTRUMENTS[symbol]
  const price = y != null ? seriesRef.current?.coordinateToPrice(y) : null
  const px = price != null ? Number(price.toFixed(inst.digits)) : null
  const q = getSnapshot()[symbol]
  const bad = px != null && p ? validateDrag({ kind: kindKey, price: px, pos: p, order: p, q, inst }) : null
  const col = bad ? AMBER : target.kind === 'sl' ? '#ef4444' : '#22c55e'
  const f = px != null && p ? plFigures({ side: p.side, lots: p.lots, from: refPrice, to: px, inst, balance: useTerminalStore.getState().account.balance, riskPrice: target.kind === 'tp' ? p.sl : null }) : null
  const at = (e) => e.clientY - e.currentTarget.getBoundingClientRect().top
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onDone])
  const click = (e) => {
    const yy = at(e)
    const pr = seriesRef.current?.coordinateToPrice(yy)
    if (pr == null || !p) return
    const v = Number(pr.toFixed(inst.digits))
    const err = validateDrag({ kind: kindKey, price: v, pos: p, order: p, q, inst })
    if (err) { useTerminalStore.getState().notify(err, 'error'); return }
    commitPatch(isOrder ? 'order' : 'position', p.id, { [target.kind]: v })
    onDone()
  }
  return (
    <div data-testid="place-layer" className="pointer-events-auto absolute inset-0 z-[8] cursor-crosshair" style={{ touchAction: 'none' }} onPointerMove={(e) => setY(at(e))} onPointerDown={(e) => { setY(at(e)); e.stopPropagation() }} onClick={click}>
      {y != null && (
        <>
          <div className="pointer-events-none absolute inset-x-0" style={{ top: y, borderTop: `2px dashed ${col}` }} />
          <div className="pointer-events-none absolute right-16 rounded px-2 py-0.5 text-[11px] font-bold tabular-nums text-white" style={{ top: y - 24, backgroundColor: col }}>
            {bad ? bad : f ? levelTag(target.kind.toUpperCase(), f) : ''}
          </div>
        </>
      )}
      <div className="absolute inset-x-0 top-2 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-lg" style={{ backgroundColor: '#2563eb' }}>
          Click the chart to place the {target.kind === 'sl' ? 'stop loss' : 'take profit'}
          <button type="button" onClick={(e) => { e.stopPropagation(); onDone() }} className="rounded bg-black/30 px-2 py-0.5 text-[11px]">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// Entry / order pills for the symbol on this chart, glued to their price by a light rAF loop that
// writes transforms straight to the DOM (no React work while panning or zooming).
export default function PositionPills({ seriesRef, candlesRef, hostRef, symbol, ver, active }) {
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const tr = useTerminalStore((s) => s.chartSettings.trading)
  const balance = useTerminalStore((s) => s.account.balance)
  const quote = useQuote(symbol)
  const items = useRef(new Map())
  const [placing, setPlacing] = useState(null)
  const reg = useCallback((key, el, price) => { if (el) items.current.set(key, { el, price, last: null }); else items.current.delete(key) }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const series = seriesRef.current
      const host = hostRef.current
      if (!series || !host || !items.current.size) return
      const h = host.clientHeight
      const vis = []
      for (const it of items.current.values()) {
        const y = series.priceToCoordinate(it.price)
        if (y == null || y < -PILL_H || y > h + PILL_H) { if (it.last !== 'hide') { it.el.style.display = 'none'; it.last = 'hide' } continue }
        vis.push({ it, y })
      }
      for (const v of spreadY(vis, PILL_H + 3, PILL_H / 2 + 22, h - PILL_H / 2 - 4)) {
        const ty = Math.round(v.ry - PILL_H / 2)
        if (v.it.last !== ty) { v.it.el.style.display = 'flex'; v.it.el.style.transform = `translateY(${ty}px)`; v.it.last = ty }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [seriesRef, hostRef, ver])

  const onPlace = useCallback((id, kind, on = 'position') => setPlacing({ id, kind, on }), [])
  const onBracket = useCallback((p, on = 'position') => {
    const inst = INSTRUMENTS[p.symbol]
    const t = useTerminalStore.getState().chartSettings.trading
    const atr = atrOf(candlesRef?.current)
    const ref = on === 'order' ? E.orderFillLevel(p) : p.entry
    const patch = {}
    for (const kind of ['sl', 'tp']) {
      if (p[kind] != null) continue
      const r = defaultStop({ kind, side: p.side, entry: ref, inst, unit: t[`def${kind === 'sl' ? 'Sl' : 'Tp'}Unit`], value: t[`def${kind === 'sl' ? 'Sl' : 'Tp'}Value`], atr })
      if (r.error) { useTerminalStore.getState().notify(`${kind.toUpperCase()}: ${r.error}`, 'error'); return }
      patch[kind] = r.price
    }
    commitPatch(on, p.id, patch)
  }, [candlesRef])

  if (!tr.showPlPill && !placing) return null
  const unit = tr.plUnit
  const posList = tr.showPositions && tr.showPlPill ? positions.filter((p) => p.symbol === symbol) : []
  const ordList = tr.showOrders && tr.showPlPill ? orders.filter((o) => o.symbol === symbol) : []
  return (
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-hidden" data-chart-overlay aria-label="Positions and orders on the chart">
      {posList.map((p) => <PositionPill key={p.id} p={p} q={quote} unit={unit} tr={tr} balance={balance} reg={reg} onPlace={onPlace} onBracket={onBracket} />)}
      {ordList.map((o) => <OrderPill key={o.id} o={o} tr={tr} reg={reg} onPlace={onPlace} onBracket={onBracket} />)}
      {placing && active !== false && <PlaceLayer target={placing} symbol={symbol} seriesRef={seriesRef} onDone={() => setPlacing(null)} />}
    </div>
  )
}
