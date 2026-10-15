import { memo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMotion } from './motionHooks'
import { BarChart3, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import * as E from '../../lib/terminal/engine'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { askNotifPermission, notifPermission, notifSupported } from '../../lib/terminal/alerts'
import { useAccountMetrics, useQuote } from './hooks'
import { fmtMoney, fmtPrice, fmtTime, pnlColor, UP_TXT, DOWN_TXT } from './format'

const BORDER = 'var(--tm-border)'
const SideTag = ({ side }) => (
  <span className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-white" style={{ backgroundColor: side === 'buy' ? '#15803d' : '#b91c1c' }}>{side.toUpperCase()}</span>
)
const sign = (n, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}`

const fieldCls = 'w-full rounded border bg-[var(--tm-deep)] px-1.5 py-1 text-[16px] tabular-nums outline-none focus:border-blue-500 md:text-[12px]'
const num = (v) => (String(v).trim() === '' ? null : Number(v))
const txt = (v) => (v == null ? '' : String(v))

function Field({ label, children }) {
  return <label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}{children}</label>
}

// SL / TP / trailing / auto break-even / partial TP for an open position.
function PositionEditor({ p, inst }) {
  const [f, setF] = useState({ sl: txt(p.sl), tp: txt(p.tp), trail: txt(p.trail), be: txt(p.beAfter), ptpPips: txt(p.partialTp?.pips), ptpPct: txt(p.partialTp?.pct ?? 50) })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    const patch = { sl: num(f.sl), tp: num(f.tp), trail: num(f.trail), beAfter: num(f.be), partialTp: num(f.ptpPips) == null ? null : { pips: num(f.ptpPips), pct: num(f.ptpPct) } }
    for (const k of ['sl', 'tp', 'trail', 'beAfter']) if (patch[k] != null && !Number.isFinite(patch[k])) { setErr('Enter numbers only'); return }
    const r = useTerminalStore.getState().modifyPosition(p.id, patch, getSnapshot())
    setErr(r.ok ? '' : r.error)
  }
  return (
    <div className="mt-2 rounded-lg border p-2" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-deep)' }}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Stop loss"><input aria-label="Edit stop loss" inputMode="decimal" value={f.sl} onChange={set('sl')} placeholder="none" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
        <Field label="Take profit"><input aria-label="Edit take profit" inputMode="decimal" value={f.tp} onChange={set('tp')} placeholder="none" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
        <Field label="Trailing (pips)"><input aria-label="Trailing pips" inputMode="decimal" value={f.trail} onChange={set('trail')} placeholder="off" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
        <Field label="Auto-BE after (pips)"><input aria-label="Auto break-even pips" inputMode="decimal" value={f.be} onChange={set('be')} placeholder="off" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
        <Field label="Partial TP at (pips)"><input aria-label="Partial TP pips" inputMode="decimal" value={f.ptpPips} onChange={set('ptpPips')} placeholder="off" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
        <Field label="…close %"><input aria-label="Partial TP percent" inputMode="decimal" value={f.ptpPct} onChange={set('ptpPct')} className={fieldCls} style={{ borderColor: BORDER }} /></Field>
      </div>
      {err && <div role="alert" className="mt-1.5 text-[11px] font-semibold" style={{ color: DOWN_TXT }}>{err}</div>}
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={save} className="rounded bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">Save</button>
        <button type="button" onClick={() => useTerminalStore.getState().breakEven(p.id, getSnapshot())} className="rounded bg-slate-700 px-3 py-1 text-[11px] font-bold hover:bg-slate-600">Break-even</button>
        <span className="ml-auto self-center text-[10px] text-slate-500">pips for {inst.symbol}: 1 pip = {inst.pipSize}</span>
      </div>
    </div>
  )
}

const OrderRow = memo(function OrderRow({ o }) {
  const confirmCancel = useTerminalStore((s) => s.chartSettings.trading.confirmCancel)
  const inst = INSTRUMENTS[o.symbol]
  const q = useQuote(o.symbol)
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState({ price: txt(o.price), limit: txt(o.limitPrice), sl: txt(o.sl), tp: txt(o.tp) })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ref = o.type === 'stoplimit' ? o.limitPrice : o.price
  const away = q ? Math.abs(ref - (o.side === 'buy' ? q.ask : q.bid)) / inst.pipSize : null
  const save = () => {
    const patch = { sl: num(f.sl), tp: num(f.tp) }
    if (!o.triggered) patch.price = num(f.price)
    if (o.type === 'stoplimit') patch.limitPrice = num(f.limit)
    const r = useTerminalStore.getState().modifyOrder(o.id, patch, getSnapshot())
    setErr(r.ok ? '' : r.error)
    if (r.ok) setEdit(false)
  }
  const exp = o.expiresAt ? `exp ${fmtTime(o.expiresAt)}` : 'GTC'
  return (
    <div className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
      <div className="flex items-center gap-2">
        <SideTag side={o.side} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-bold">{E.ORDER_LABEL[o.type]} {o.symbol} <span className="font-semibold text-slate-400">{o.lots} lots</span>{o.oco && <span className="ml-1 rounded bg-slate-700 px-1 text-[9px]">OCO</span>}{o.triggered && <span className="ml-1 rounded bg-amber-700 px-1 text-[9px]">TRIGGERED</span>}</div>
          <div className="truncate text-[10px] tabular-nums text-slate-400">
            @ {fmtPrice(o.price, inst.digits)}{o.type === 'stoplimit' ? ` → limit ${fmtPrice(o.limitPrice, inst.digits)}` : ''} · SL {o.sl == null ? '—' : fmtPrice(o.sl, inst.digits)} · TP {o.tp == null ? '—' : fmtPrice(o.tp, inst.digits)} · {exp}
          </div>
        </div>
        <div className="text-right text-[10px] tabular-nums text-slate-400">{away == null ? '' : `${away.toFixed(1)} pips away`}</div>
        <button type="button" onClick={() => { if (confirmCancel && !window.confirm(`Cancel this ${E.ORDER_LABEL[o.type]} order?`)) return; useTerminalStore.getState().cancelOrder(o.id) }} className="rounded-md bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-600">Cancel</button>
        <button type="button" aria-label="Edit order" aria-expanded={edit} onClick={() => setEdit(!edit)} className="rounded-md bg-slate-800 px-2 py-1.5 text-[11px] font-bold hover:bg-slate-700">✎</button>
      </div>
      {edit && (
        <div className="mt-2 rounded-lg border p-2" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-deep)' }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label={o.type === 'stoplimit' ? 'Stop price' : 'Price'}><input aria-label="Edit order price" inputMode="decimal" disabled={o.triggered} value={f.price} onChange={set('price')} className={fieldCls} style={{ borderColor: BORDER }} /></Field>
            {o.type === 'stoplimit' && <Field label="Limit price"><input aria-label="Edit limit price" inputMode="decimal" value={f.limit} onChange={set('limit')} className={fieldCls} style={{ borderColor: BORDER }} /></Field>}
            <Field label="Stop loss"><input aria-label="Edit order stop loss" inputMode="decimal" value={f.sl} onChange={set('sl')} placeholder="none" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
            <Field label="Take profit"><input aria-label="Edit order take profit" inputMode="decimal" value={f.tp} onChange={set('tp')} placeholder="none" className={fieldCls} style={{ borderColor: BORDER }} /></Field>
          </div>
          {err && <div role="alert" className="mt-1.5 text-[11px] font-semibold" style={{ color: DOWN_TXT }}>{err}</div>}
          <button type="button" onClick={save} className="mt-2 rounded bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">Save</button>
        </div>
      )}
    </div>
  )
})

const PositionRow = memo(function PositionRow({ p }) {
  const confirmClose = useTerminalStore((s) => s.chartSettings.trading.confirmClose)
  const inst = INSTRUMENTS[p.symbol]
  const q = useQuote(p.symbol)
  const [more, setMore] = useState(false)
  const exit = q ? E.exitPrice(p.side, q) : null
  const pl = q ? E.pnl(p.side, p.lots, p.entry, exit, inst) : null
  const pips = q ? E.pipsMoved(p.side, p.entry, exit, inst) : null
  const margin = E.requiredMargin(p.lots, p.entry, inst, p.leverage || 100)
  const act = (fn, ...a) => useTerminalStore.getState()[fn](p.id, ...a, getSnapshot())
  return (
    <div className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
      <div className="flex items-center gap-2">
        <SideTag side={p.side} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-bold">{p.symbol} <span className="font-semibold text-slate-400">{p.lots} lots</span></div>
          <div className="truncate text-[10px] tabular-nums text-slate-400">
            {fmtPrice(p.entry, inst.digits)} → {fmtPrice(exit, inst.digits)} · SL {p.sl == null ? '—' : fmtPrice(p.sl, inst.digits)} · TP {p.tp == null ? '—' : fmtPrice(p.tp, inst.digits)}{p.trail ? ` · trail ${p.trail}p` : ''}{p.beAfter ? ` · BE@${p.beAfter}p` : ''}{p.partialTp ? ` · PTP ${p.partialTp.pct}%@${p.partialTp.pips}p` : ''}{p.approx ? ' · ≈ opened offline' : ''}
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-[13px] font-extrabold tabular-nums" style={{ color: pl == null ? 'var(--tm-muted)' : pnlColor(pl) }}>{pl == null ? '—' : fmtMoney(pl, { sign: true })}</div>
          <div className="text-[10px] tabular-nums text-slate-400">{pips == null ? '' : `${sign(pips)} pips`} · M {fmtMoney(margin)}</div>
        </div>
        <button type="button" onClick={() => { if (confirmClose && !window.confirm(`Close ${p.side.toUpperCase()} ${p.lots} ${p.symbol}?`)) return; act('closePosition') }} className="rounded-md bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-600">Close</button>
        <button type="button" aria-label="More actions" aria-expanded={more} onClick={() => setMore(!more)} className="rounded-md bg-slate-800 px-2 py-1.5 text-[11px] font-bold hover:bg-slate-700">⋯</button>
      </div>
      {more && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[25, 50, 75].map((pct) => (
            <button key={pct} type="button" onClick={() => act('partialClose', pct)} className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-bold hover:bg-slate-700">Close {pct}%</button>
          ))}
          <button type="button" onClick={() => act('reversePosition')} className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-bold hover:bg-slate-700">⇄ Reverse</button>
        </div>
      )}
      {more && <PositionEditor p={p} inst={inst} />}
    </div>
  )
})

const REASONS = { manual: 'Manual', sl: 'Stop loss', tp: 'Take profit', stopout: 'Stop-out', reverse: 'Reverse', ptp: 'Partial TP' }
const HistoryRow = memo(function HistoryRow({ h }) {
  const inst = INSTRUMENTS[h.symbol]
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: BORDER }}>
      <SideTag side={h.side} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-bold">{h.symbol} <span className="font-semibold text-slate-400">{h.lots} lots</span></div>
        <div className="truncate text-[10px] tabular-nums text-slate-400">{fmtPrice(h.entry, inst.digits)} → {fmtPrice(h.exit, inst.digits)} · {REASONS[h.reason] || h.reason}{h.approx ? ' (filled while closed, approx.)' : ''} · {fmtTime(h.closeTime)}</div>
      </div>
      <div className="text-right leading-tight">
        <div className="text-[12px] font-extrabold tabular-nums" style={{ color: pnlColor(h.pnl) }}>{fmtMoney(h.pnl, { sign: true })}</div>
        <div className="text-[10px] tabular-nums text-slate-400">{sign(h.pips)} pips</div>
      </div>
    </div>
  )
})

export default function PositionsPanel() {
  const positions = useTerminalStore((s) => s.positions)
  const history = useTerminalStore((s) => s.history)
  const orders = useTerminalStore((s) => s.orders) || []
  const notifAsked = useTerminalStore((s) => s.settings.notifAsked)
  const [rules, setRules] = useState(false)
  const dockOpen = useTerminalStore((s) => s.dockOpen)
  const tab = useTerminalStore((s) => s.dockTab)
  const { metrics } = useAccountMetrics()
  const mo = useMotion()
  const rp = rowProps(mo)
  const st = useTerminalStore.getState

  const bulk = (kind) => {
    const ids = positions
      .filter((p) => {
        const v = metrics.perPosition[p.id]?.pnl
        return kind === 'all' || (kind === 'profit' ? v > 0 : v < 0)
      })
      .map((p) => p.id)
    if (!ids.length) { st().notify('No matching positions', 'info'); return }
    if (!window.confirm(`Close ${ids.length} position${ids.length > 1 ? 's' : ''}?`)) return
    st().closeMany(ids, getSnapshot())
  }

  const tabBtn = (id, text) => (
    <button type="button" onClick={() => { st().setDockTab(id); st().setDockOpen(true) }} className="rounded px-2 py-1 text-[11px] font-bold"
      style={{ backgroundColor: tab === id && dockOpen ? 'var(--tm-active)' : 'transparent', color: tab === id && dockOpen ? '#fff' : 'var(--tm-muted)' }}>{text}</button>
  )

  return (
    <div className="shrink-0 border-t" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel2)' }}>
      <div className="no-scrollbar flex h-9 items-center gap-1 overflow-x-auto px-2">
        {tabBtn('positions', `Positions (${positions.length})`)}
        {tabBtn('orders', `Orders (${orders.length})`)}
        {tabBtn('history', `History (${history.length})`)}
        <span className="ml-2 shrink-0 text-[11px] font-extrabold tabular-nums" style={{ color: pnlColor(metrics.floating) }}>
          {positions.length ? fmtMoney(metrics.floating, { sign: true }) : ''}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {dockOpen && tab === 'positions' && positions.length > 0 && (
            <>
              <button type="button" onClick={() => bulk('profit')} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold hover:bg-slate-700" style={{ color: UP_TXT }}>In profit</button>
              <button type="button" onClick={() => bulk('loss')} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold hover:bg-slate-700" style={{ color: DOWN_TXT }}>In loss</button>
              <button type="button" onClick={() => bulk('all')} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold hover:bg-slate-700">Close all</button>
            </>
          )}
          <button type="button" onClick={() => st().setHistoryOpen(true)} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"><BarChart3 size={12} /> Stats</button>
          <button type="button" aria-label="Fill rules" aria-expanded={rules} onClick={() => { setRules(!rules); st().setDockOpen(true) }} className="rounded p-1 text-slate-300 hover:bg-white/10"><Info size={14} /></button>
          <button type="button" aria-label={dockOpen ? 'Collapse panel' : 'Expand panel'} onClick={() => st().setDockOpen(!dockOpen)} className="rounded p-1 hover:bg-white/10">
            {dockOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
      {dockOpen && (
        <div className="h-[34vh] overflow-y-auto border-t md:h-[220px]" style={{ borderColor: BORDER }}>
          {rules && (
            <div className="border-b px-3 py-2 text-[11px] leading-relaxed text-slate-300" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-deep)' }}>
              <b>Fill rules (simulated):</b> BUY fills at the ask and SELL at the bid; SL/TP/pending orders trigger on the side you would really exit/enter at.
              If price gaps past a level you get the <b>first available price</b> (can be worse). Inside one candle during offline catch-up, price is assumed to visit the extreme
              <b> worst for your open trade first, so SL fills before TP</b>. Trailing stops move in 1-pip steps. Fills while the terminal was closed are replayed from
              1-minute candles and are <b>approximate</b> (max 7 days back).
            </div>
          )}
          {tab === 'orders' ? (
            <>
              {notifSupported() && notifPermission() === 'default' && !notifAsked && orders.length > 0 && (
                <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px]" style={{ borderColor: BORDER, backgroundColor: '#172033' }}>
                  <span className="flex-1 text-slate-200">Want a notification when a pending order fills while this tab is in the background?</span>
                  <button type="button" onClick={async () => { await askNotifPermission(); st().setSettings({ notifAsked: true }) }} className="rounded bg-blue-600 px-2 py-1 font-bold text-white">Enable</button>
                  <button type="button" onClick={() => st().setSettings({ notifAsked: true })} className="rounded bg-slate-700 px-2 py-1 font-bold">Not now</button>
                </div>
              )}
              {orders.length ? <AnimatePresence initial={false} mode="popLayout">{orders.map((o) => <motion.div key={o.id} data-testid="row-order" {...rp}><OrderRow o={o} /></motion.div>)}</AnimatePresence> : <Empty text="No pending orders — pick Limit / Stop in the ticket, or right-click (long-press) the chart." />}
            </>
          ) : tab === 'positions' ? (
            positions.length ? <AnimatePresence initial={false} mode="popLayout">{positions.map((p) => <motion.div key={p.id} data-testid="row-position" {...rp}><PositionRow p={p} /></motion.div>)}</AnimatePresence> : <Empty text="No open positions — place a BUY or SELL order." />
          ) : history.length ? (
            <>
              <AnimatePresence initial={false} mode="popLayout">{history.slice(0, 100).map((h) => <motion.div key={h.id} data-testid="row-history" {...rp}><HistoryRow h={h} /></motion.div>)}</AnimatePresence>
              <div className="px-3 py-2 text-center text-[10px] text-slate-500">Showing the latest 100 closed trades. <button type="button" onClick={() => st().setHistoryOpen(true)} className="font-bold text-sky-400 underline">Open full history, statistics &amp; CSV export</button></div>
            </>
          ) : <Empty text="No closed trades yet." />}
        </div>
      )}
    </div>
  )
}

// Phase 13: rows slide in / out and the rest glide into place (transform + opacity only)
function rowProps(mo) {
  if (!mo.rows) return {}
  return {
    layout: 'position',
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 40, transition: { duration: mo.full ? 0.16 : mo.fadeMs / 1000 } },
    transition: mo.full ? { type: 'spring', stiffness: 520, damping: 36 } : { duration: mo.fadeMs / 1000 },
  }
}
const Empty = ({ text }) => <div className="px-3 py-6 text-center text-[12px] text-slate-500">{text}</div>
