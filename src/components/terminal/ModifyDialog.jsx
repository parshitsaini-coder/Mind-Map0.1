import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTerminalStore, orderLabel } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'

const field = 'w-full rounded-md border bg-transparent px-2 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-blue-500'
const num = (v) => {
  const n = Number(String(v).replace(',', '.'))
  return String(v).trim() !== '' && Number.isFinite(n) ? n : null
}
const toLocalInput = (ms) => {
  if (ms == null) return ''
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}
function L({ children }) {
  return <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
}

function PositionForm({ pos, close }) {
  const inst = INSTRUMENTS[pos.symbol]
  const [sl, setSl] = useState(pos.sl != null ? String(pos.sl) : '')
  const [tp, setTp] = useState(pos.tp != null ? String(pos.tp) : '')
  const [trail, setTrail] = useState(pos.trail != null ? String(pos.trail) : '')
  const [beAt, setBeAt] = useState(pos.beAt != null ? String(pos.beAt) : '')
  const [pPips, setPPips] = useState(pos.partial ? String(pos.partial.pips) : '')
  const [pPct, setPPct] = useState(pos.partial ? String(pos.partial.pct) : '50')
  const [err, setErr] = useState('')

  const save = () => {
    const patch = {
      sl: num(sl), tp: num(tp), trail: num(trail), beAt: num(beAt),
      partial: num(pPips) ? { pips: num(pPips), pct: num(pPct) ?? 50 } : null,
    }
    const r = useTerminalStore.getState().modifyPosition(pos.id, patch)
    if (!r.ok) return setErr(r.error)
    useTerminalStore.getState().pushToast('info', `${pos.symbol} position updated`)
    close()
  }
  const be = () => {
    const r = useTerminalStore.getState().moveToBreakeven(pos.id)
    if (!r.ok) return setErr(r.error)
    close()
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div><L>Stop loss (price)</L><input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" placeholder="none" className={field} style={{ borderColor: '#334155' }} /></div>
        <div><L>Take profit (price)</L><input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" placeholder="none" className={field} style={{ borderColor: '#334155' }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><L>Trailing stop (pips)</L><input value={trail} onChange={(e) => setTrail(e.target.value)} inputMode="decimal" placeholder="off" className={field} style={{ borderColor: '#334155' }} /></div>
        <div><L>Auto break-even at (pips)</L><input value={beAt} onChange={(e) => setBeAt(e.target.value)} inputMode="decimal" placeholder="off" className={field} style={{ borderColor: '#334155' }} /></div>
      </div>
      <div>
        <L>Partial take-profit</L>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          at <input value={pPips} onChange={(e) => setPPips(e.target.value)} inputMode="decimal" placeholder="pips" className={`${field} w-20`} style={{ borderColor: '#334155' }} />
          close <input value={pPct} onChange={(e) => setPPct(e.target.value)} inputMode="decimal" className={`${field} w-16`} style={{ borderColor: '#334155' }} /> %
        </div>
        {pos.partial?.done && <p className="mt-1 text-[10px] text-amber-300">Already executed once — saving again re-arms it.</p>}
      </div>
      <p className="text-[10.5px] leading-snug text-slate-400">
        Current {pos.side === 'buy' ? 'bid' : 'ask'} decides what is valid. Trailing starts once profit ≥ its distance and only moves the stop in your favour. Pip = {inst.pipSize}.
      </p>
      {err && <div className="rounded-md bg-red-500/15 px-2 py-1.5 text-[11px] font-semibold text-red-300">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={save} className="flex-1 rounded-md bg-blue-600 py-2 text-[12px] font-bold text-white hover:bg-blue-500">Save</button>
        <button type="button" onClick={be} className="rounded-md border px-3 py-2 text-[12px] font-bold text-slate-200 hover:bg-white/10" style={{ borderColor: '#334155' }}>Break-even now</button>
      </div>
    </>
  )
}

function OrderForm({ order, close }) {
  const [price, setPrice] = useState(String(order.price))
  const [trigger, setTrigger] = useState(order.trigger != null ? String(order.trigger) : '')
  const [sl, setSl] = useState(order.sl != null ? String(order.sl) : '')
  const [tp, setTp] = useState(order.tp != null ? String(order.tp) : '')
  const [expiry, setExpiry] = useState(toLocalInput(order.expiry))
  const [err, setErr] = useState('')
  const showTrigger = order.type === 'stoplimit' && !order.triggered

  const save = () => {
    const patch = { price: num(price), sl: num(sl), tp: num(tp), expiry: expiry ? new Date(expiry).getTime() : null }
    if (showTrigger) patch.trigger = num(trigger)
    const r = useTerminalStore.getState().modifyPending(order.id, patch)
    if (!r.ok) return setErr(r.error)
    useTerminalStore.getState().pushToast('info', `${orderLabel(order)} ${order.symbol} updated`)
    close()
  }
  const cancel = () => {
    useTerminalStore.getState().cancelPending(order.id)
    close()
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div><L>{order.type === 'stoplimit' ? 'Limit price' : 'Order price'}</L><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} style={{ borderColor: '#334155' }} /></div>
        {showTrigger && <div><L>Stop (trigger) price</L><input value={trigger} onChange={(e) => setTrigger(e.target.value)} inputMode="decimal" className={field} style={{ borderColor: '#334155' }} /></div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><L>Stop loss (price)</L><input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" placeholder="none" className={field} style={{ borderColor: '#334155' }} /></div>
        <div><L>Take profit (price)</L><input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" placeholder="none" className={field} style={{ borderColor: '#334155' }} /></div>
      </div>
      <div>
        <L>Expires (empty = good till cancelled)</L>
        <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${field} bg-[#0f1419]`} style={{ borderColor: '#334155', colorScheme: 'dark' }} />
      </div>
      {order.oco && <p className="text-[10.5px] text-amber-300">Part of an OCO pair — when one fills, the other is cancelled.</p>}
      {err && <div className="rounded-md bg-red-500/15 px-2 py-1.5 text-[11px] font-semibold text-red-300">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={save} className="flex-1 rounded-md bg-blue-600 py-2 text-[12px] font-bold text-white hover:bg-blue-500">Save</button>
        <button type="button" onClick={cancel} className="rounded-md border px-3 py-2 text-[12px] font-bold text-red-300 hover:bg-red-500/20" style={{ borderColor: '#7f1d1d' }}>Cancel order</button>
      </div>
    </>
  )
}

export default function ModifyDialog() {
  const editing = useTerminalStore((s) => s.editing)
  const positions = useTerminalStore((s) => s.positions)
  const pendings = useTerminalStore((s) => s.pendings)
  const setEditing = useTerminalStore((s) => s.setEditing)
  const target = editing && (editing.kind === 'position' ? positions : pendings).find((x) => x.id === editing.id)
  const close = () => setEditing(null)

  useEffect(() => {
    if (!target) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setEditing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [target, setEditing])

  if (!target) return null
  const title = editing.kind === 'position' ? `Edit ${target.side.toUpperCase()} ${target.lots} ${target.symbol}` : `Edit ${orderLabel(target)} ${target.lots} ${target.symbol}`
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border p-4" style={{ backgroundColor: '#131a22', borderColor: '#27313d' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold">{title}</h3>
          <button type="button" onClick={close} className="rounded p-1 hover:bg-white/10"><X size={14} /></button>
        </div>
        {editing.kind === 'position' ? <PositionForm key={target.id} pos={target} close={close} /> : <OrderForm key={target.id} order={target} close={close} />}
      </div>
    </div>
  )
}
