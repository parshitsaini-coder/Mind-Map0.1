import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import * as E from '../../lib/terminal/engine'
import { LEVERAGES } from '../../lib/terminal/ledger'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { useAccountMetrics, useQuote } from './hooks'
import { askNotifPermission, notifPermission, notifSupported } from '../../lib/terminal/alerts'
import { fmtMoney, fmtPrice, UP_TXT, DOWN_TXT } from './format'

const BORDER = 'var(--tm-border)'
const PRESETS = [0.01, 0.1, 1]
const MODES = [['price', 'Price'], ['pips', 'Pips'], ['usd', '$']]
const inputCls = 'w-full rounded-md border bg-[var(--tm-deep)] px-2 py-1.5 text-[16px] font-semibold tabular-nums text-slate-100 outline-none focus:border-blue-500 md:text-[13px]'
const cleanLots = (n) => String(+n.toFixed(4))

function StopField({ label, state, onChange, onPick }) {
  return (
    <div>
      <div className="mb-1 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <div className="flex overflow-hidden rounded border" style={{ borderColor: BORDER }}>
          {MODES.map(([m, t]) => (
            <button key={m} type="button" onClick={() => onChange({ ...state, mode: m })} className="flex-1 py-1 text-[10px] font-bold"
              style={{ backgroundColor: state.mode === m ? 'var(--tm-active)' : 'transparent', color: state.mode === m ? '#fff' : 'var(--tm-muted)' }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        <input inputMode="decimal" placeholder="None" value={state.value} onChange={(e) => onChange({ ...state, value: e.target.value })} className={inputCls} style={{ borderColor: BORDER }} />
        {onPick && <button type="button" aria-label={`Pick ${label} on chart`} title="Pick on chart" onClick={onPick} className="shrink-0 rounded-md bg-slate-700 px-2 text-[13px] hover:bg-slate-600">⌖</button>}
      </div>
    </div>
  )
}

const TYPES = [['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop'], ['stoplimit', 'Stop-limit']]

export default function OrderTicket({ symbol, onExecuted, onPickStart }) {
  const inst = INSTRUMENTS[symbol]
  const quote = useQuote(symbol)
  const { metrics } = useAccountMetrics()
  const account = useTerminalStore((s) => s.account)
  const settings = useTerminalStore((s) => s.settings)
  const [lots, setLots] = useState(() => cleanLots(Math.max(settings.lots, inst.minLot)))
  const [sl, setSl] = useState({ mode: 'price', value: '' })
  const [tp, setTp] = useState({ mode: 'price', value: '' })
  const [risk, setRisk] = useState({ pct: '1', pips: '' })
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [otype, setOtype] = useState('market')
  const [ordPrice, setOrdPrice] = useState('')
  const [ordLimit, setOrdLimit] = useState('')
  const [expiry, setExpiry] = useState({ kind: 'gtc', date: '' })
  const [oco, setOco] = useState(false)
  const orders = useTerminalStore((s) => s.orders)
  const pickRes = useTerminalStore((s) => s.pickRes)
  const [seenPick, setSeenPick] = useState(pickRes?.n || 0)
  const pending_ = otype !== 'market'
  const prevPending = (orders || []).filter((o) => o.symbol === symbol && !o.oco).slice(-1)[0]

  // A price picked on the chart lands in the field that asked for it.
  if (pickRes && pickRes.n !== seenPick) {
    setSeenPick(pickRes.n)
    const v = pickRes.price.toFixed(inst.digits)
    if (pickRes.field === 'price') setOrdPrice(v)
    else if (pickRes.field === 'limit') setOrdLimit(v)
    else if (pickRes.field === 'sl') setSl({ mode: 'price', value: v })
    else if (pickRes.field === 'tp') setTp({ mode: 'price', value: v })
  }
  // Right-click menu on the chart -> "Buy limit…": the ticket opens with that type and price.
  const prefill = useTerminalStore((s) => s.ticketPrefill)
  const [seenPrefill, setSeenPrefill] = useState(prefill?.n || 0)
  if (prefill && prefill.n !== seenPrefill) {
    setSeenPrefill(prefill.n)
    setOtype(prefill.type); setOrdPrice(prefill.price != null ? prefill.price.toFixed(inst.digits) : ''); setOrdLimit('')
    // from a Long / Short position drawing: also fill the stop loss and take profit
    if (prefill.sl != null) setSl({ mode: 'price', value: prefill.sl.toFixed(inst.digits) })
    if (prefill.tp != null) setTp({ mode: 'price', value: prefill.tp.toFixed(inst.digits) })
  }
  const startPick = (field) => { useTerminalStore.getState().setPickReq(field); onPickStart?.() }

  const lotsNum = parseFloat(lots)
  const saveLots = (v) => { if (Number.isFinite(v) && v > 0) useTerminalStore.getState().setSettings({ lots: v }) }
  const setLotsNum = (v) => { const c = Math.min(inst.maxLot, Math.max(inst.minLot, v)); setLots(cleanLots(c)); saveLots(c) }
  const step = (dir) => setLotsNum((Number.isFinite(lotsNum) ? lotsNum : 0) + dir * inst.lotStep)

  const evalSide = (side) => (quote ? E.evaluateOrder({ side, lots: lotsNum, quote, inst, leverage: account.leverage, metrics }) : null)
  const evBuy = evalSide('buy') // preview uses the ask (the larger margin)

  const resolve = (side, q) => {
    const entry = E.entryPrice(side, q)
    const slR = E.resolveStop({ ...sl, kind: 'sl', side, entry, lots: lotsNum, inst })
    const tpR = E.resolveStop({ ...tp, kind: 'tp', side, entry, lots: lotsNum, inst })
    return { entry, slR, tpR }
  }

  const execute = (side) => {
    setError('')
    const quotes = getSnapshot()
    const q = quotes[symbol]
    if (!q) { setError('Waiting for live price…'); return }
    const { slR, tpR } = resolve(side, q)
    if (slR.error || tpR.error) { setError(slR.error || tpR.error); setPending(null); return }
    const r = useTerminalStore.getState().openPosition({ symbol, side, lots: lotsNum, sl: slR.price, tp: tpR.price }, quotes)
    setPending(null)
    if (!r.ok) { setError(r.error); return }
    setSl((s) => ({ ...s, value: '' })); setTp((s) => ({ ...s, value: '' }))
    onExecuted?.()
  }

  const placePending = (side) => {
    setError('')
    const quotes = getSnapshot()
    if (!quotes[symbol]) { setError('Waiting for live price…'); return }
    const price = parseFloat(ordPrice)
    const limitPrice = otype === 'stoplimit' ? parseFloat(ordLimit) : null
    const entry = otype === 'stoplimit' ? limitPrice : price
    if (!Number.isFinite(entry)) { setError(otype === 'stoplimit' ? 'Enter the stop price and the limit price' : 'Enter the order price'); return }
    const slR = E.resolveStop({ ...sl, kind: 'sl', side, entry, lots: lotsNum, inst })
    const tpR = E.resolveStop({ ...tp, kind: 'tp', side, entry, lots: lotsNum, inst })
    if (slR.error || tpR.error) { setError(slR.error || tpR.error); return }
    const r = useTerminalStore.getState().placeOrder(
      { symbol, type: otype, side, lots: lotsNum, price, limitPrice, sl: slR.price, tp: tpR.price, expiry, ocoWith: oco && prevPending ? prevPending.id : null }, quotes)
    if (!r.ok) { setError(r.error); return }
    setOrdPrice(''); setOrdLimit(''); setOco(false)
    setSl((x) => ({ ...x, value: '' })); setTp((x) => ({ ...x, value: '' }))
    onExecuted?.()
  }

  const press = (side) => {
    if (pending_) { placePending(side); return }
    setError('')
    const ev = evalSide(side)
    if (!ev) { setError('Waiting for live price…'); return }
    if (ev.error) { setError(ev.error); return }
    if (settings.oneClick) execute(side)
    else setPending(side)
  }

  // Phase 8 keyboard: B / S press the buttons, Enter confirms, Esc ("cancel") backs out of the confirmation.
  const hk = useTerminalStore((s) => s.hotkey)
  const handled = useRef(hk?.n) // a press from before this ticket mounted must not fire
  useEffect(() => {
    if (!hk || hk.n === handled.current) return
    handled.current = hk.n
    if (hk.side === 'cancel') setPending(null)
    else if (hk.side === 'confirm') { if (pending) execute(pending) }
    else press(hk.side)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to a NEW key press; press/execute are read fresh from this render
  }, [hk])
  useEffect(() => {
    useTerminalStore.setState({ ticketPending: !!pending })
    return () => useTerminalStore.setState({ ticketPending: false })
  }, [pending])

  // Risk calculator
  const riskPips = parseFloat(risk.pips !== '' ? risk.pips : sl.mode === 'pips' ? sl.value : '')
  const riskUsd = (account.balance * parseFloat(risk.pct)) / 100
  const suggested = E.lotsFromRisk(riskUsd, riskPips, inst)

  const pend = pending && quote ? resolve(pending, quote) : null
  const pendEv = pending ? evalSide(pending) : null
  const live = quote && settings.oneClick

  return (
    <div className="flex flex-col gap-3 p-3 text-slate-100">
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <div className="text-[13px] font-extrabold">{symbol}</div>
          <div className="text-[10px] text-slate-400">{inst.name}</div>
        </div>
        <button type="button" role="switch" aria-checked={settings.oneClick}
          onClick={() => useTerminalStore.getState().setSettings({ oneClick: !settings.oneClick })}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
          One-click
          <span className="relative h-4 w-8 rounded-full transition-colors" style={{ backgroundColor: settings.oneClick ? '#2563eb' : 'var(--tm-border2)' }}>
            <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: settings.oneClick ? 18 : 2 }} />
          </span>
        </button>
      </div>

      <div role="tablist" aria-label="Order type" className="grid grid-cols-4 overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
        {TYPES.map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={otype === id} onClick={() => { setOtype(id); setError(''); setPending(null) }}
            className="py-1.5 text-[10px] font-bold" style={{ backgroundColor: otype === id ? 'var(--tm-active)' : 'transparent', color: otype === id ? '#fff' : 'var(--tm-muted)' }}>{text}</button>
        ))}
      </div>

      {/* BUY / SELL */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => press('sell')} disabled={!quote} className="flex h-14 flex-col items-center justify-center rounded-lg font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: '#b91c1c' }}>
          <span className="text-[11px] tracking-wider">SELL{pending_ ? ` ${E.ORDER_LABEL[otype]}` : ''}</span>
          <span className="text-[15px] tabular-nums">{fmtPrice(quote?.bid, inst.digits)}</span>
        </button>
        <button type="button" onClick={() => press('buy')} disabled={!quote} className="flex h-14 flex-col items-center justify-center rounded-lg font-extrabold text-white disabled:opacity-50" style={{ backgroundColor: '#15803d' }}>
          <span className="text-[11px] tracking-wider">BUY{pending_ ? ` ${E.ORDER_LABEL[otype]}` : ''}</span>
          <span className="text-[15px] tabular-nums">{fmtPrice(quote?.ask, inst.digits)}</span>
        </button>
      </div>
      {pending_ && (
        <div className="flex flex-col gap-2 rounded-lg border p-2" style={{ borderColor: BORDER }}>
          <div className="flex items-end gap-1">
            <label className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{otype === 'stoplimit' ? 'Stop price' : 'Price'}
              <input aria-label="Order price" inputMode="decimal" placeholder={fmtPrice(quote?.ask, inst.digits)} value={ordPrice} onChange={(e) => setOrdPrice(e.target.value)} className={`${inputCls} mt-1`} style={{ borderColor: BORDER }} />
            </label>
            <button type="button" aria-label="Pick price on chart" title="Pick on chart" onClick={() => startPick('price')} className="h-[34px] shrink-0 rounded-md bg-slate-700 px-2 text-[13px] hover:bg-slate-600">⌖</button>
          </div>
          {otype === 'stoplimit' && (
            <div className="flex items-end gap-1">
              <label className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Limit price
                <input aria-label="Limit price" inputMode="decimal" value={ordLimit} onChange={(e) => setOrdLimit(e.target.value)} className={`${inputCls} mt-1`} style={{ borderColor: BORDER }} />
              </label>
              <button type="button" aria-label="Pick limit price on chart" title="Pick on chart" onClick={() => startPick('limit')} className="h-[34px] shrink-0 rounded-md bg-slate-700 px-2 text-[13px] hover:bg-slate-600">⌖</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <select aria-label="Expiry" value={expiry.kind} onChange={(e) => setExpiry({ ...expiry, kind: e.target.value })} className="flex-1 rounded-md border bg-[var(--tm-deep)] px-2 py-1.5 text-[16px] font-bold md:text-[12px]" style={{ borderColor: BORDER }}>
              <option value="gtc">Good till cancelled</option>
              <option value="day">Today only</option>
              <option value="date">Until date…</option>
            </select>
            {expiry.kind === 'date' && <input aria-label="Expiry date" type="date" value={expiry.date} onChange={(e) => setExpiry({ ...expiry, date: e.target.value })} className="rounded-md border bg-[var(--tm-deep)] px-2 py-1 text-[16px] md:text-[12px]" style={{ borderColor: BORDER }} />}
          </div>
          {prevPending && (
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={oco} onChange={(e) => setOco(e.target.checked)} />
              OCO — link with {prevPending.side.toUpperCase()} {E.ORDER_LABEL[prevPending.type]} @ {fmtPrice(prevPending.price, inst.digits)} (one fills, the other cancels)
            </label>
          )}
          <div className="text-[10px] text-slate-500">Margin is checked when the order fills. SL/TP below are measured from the order price.</div>
        </div>
      )}
      {live && !pending_ && <div className="-mt-1 text-center text-[10px] text-amber-300">One-click ON — tapping BUY/SELL trades immediately</div>}

      {pending && pend && (
        <div className="rounded-lg border p-2 text-[12px]" style={{ borderColor: pending === 'buy' ? '#15803d' : '#b91c1c', backgroundColor: 'var(--tm-deep)' }}>
          <div className="font-bold">Confirm {pending.toUpperCase()} {lotsNum} {symbol} @ {fmtPrice(pend.entry, inst.digits)}</div>
          <div className="mt-1 text-slate-400">
            Margin {fmtMoney(pendEv?.margin)} · SL {pend.slR.error ? pend.slR.error : pend.slR.price == null ? 'none' : fmtPrice(pend.slR.price, inst.digits)} · TP {pend.tpR.error ? pend.tpR.error : pend.tpR.price == null ? 'none' : fmtPrice(pend.tpR.price, inst.digits)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => execute(pending)} className="rounded-md py-2 text-[12px] font-extrabold text-white" style={{ backgroundColor: pending === 'buy' ? '#15803d' : '#b91c1c' }}>Confirm {pending.toUpperCase()}</button>
            <button type="button" onClick={() => setPending(null)} className="rounded-md bg-slate-700 py-2 text-[12px] font-bold text-white">Cancel</button>
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-md px-2 py-1.5 text-[12px] font-semibold" style={{ backgroundColor: '#450a0a', color: DOWN_TXT }}>{error}</div>}

      {/* Lots */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Lots</div>
        <div className="flex items-stretch gap-1.5">
          <button type="button" aria-label="Decrease lots" onClick={() => step(-1)} className="flex w-10 items-center justify-center rounded-md bg-slate-700 hover:bg-slate-600"><Minus size={14} /></button>
          <input inputMode="decimal" value={lots} onChange={(e) => setLots(e.target.value)} onBlur={() => saveLots(lotsNum)} className={`${inputCls} text-center`} style={{ borderColor: BORDER }} />
          <button type="button" aria-label="Increase lots" onClick={() => step(1)} className="flex w-10 items-center justify-center rounded-md bg-slate-700 hover:bg-slate-600"><Plus size={14} /></button>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {PRESETS.filter((p) => p >= inst.minLot).map((p) => (
            <button key={p} type="button" onClick={() => setLotsNum(p)} className="flex-1 rounded bg-slate-800 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700">{p}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StopField label="Stop loss" state={sl} onChange={setSl} onPick={() => startPick('sl')} />
        <StopField label="Take profit" state={tp} onChange={setTp} onPick={() => startPick('tp')} />
      </div>

      {/* Leverage */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Leverage</span>
        <select value={account.leverage} onChange={(e) => useTerminalStore.getState().setLeverage(Number(e.target.value))}
          className="rounded-md border bg-[var(--tm-deep)] px-2 py-1 text-[16px] font-bold md:text-[12px]" style={{ borderColor: BORDER }}>
          {LEVERAGES.map((l) => <option key={l} value={l}>1:{l}</option>)}
        </select>
      </div>

      {/* Estimates */}
      <div className="rounded-lg border p-2 text-[11px]" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-deep)' }}>
        {[
          ['Margin needed', evBuy ? fmtMoney(evBuy.margin) : '—'],
          ['Pip value', evBuy ? fmtMoney(evBuy.pipValue) : '—'],
          ['Free margin after', evBuy ? fmtMoney(evBuy.freeAfter) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5"><span className="text-slate-400">{k}</span><span className="font-bold tabular-nums" style={{ color: k === 'Free margin after' && evBuy?.freeAfter < 0 ? DOWN_TXT : undefined }}>{v}</span></div>
        ))}
        {evBuy?.error && <div className="mt-1 font-semibold" style={{ color: DOWN_TXT }}>{evBuy.error}</div>}
      </div>

      {/* Risk calculator */}
      <div className="rounded-lg border p-2" style={{ borderColor: BORDER }}>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Risk calculator</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-400">Risk %
            <input inputMode="decimal" value={risk.pct} onChange={(e) => setRisk({ ...risk, pct: e.target.value })} className={inputCls} style={{ borderColor: BORDER }} />
          </label>
          <label className="text-[10px] text-slate-400">SL distance (pips)
            <input inputMode="decimal" placeholder={sl.mode === 'pips' ? sl.value : ''} value={risk.pips} onChange={(e) => setRisk({ ...risk, pips: e.target.value })} className={inputCls} style={{ borderColor: BORDER }} />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-300">
            Risk {Number.isFinite(riskUsd) ? fmtMoney(riskUsd) : '—'} → <b style={{ color: UP_TXT }}>{suggested > 0 ? `${suggested} lots` : '—'}</b>
          </span>
          <button type="button" disabled={!(suggested > 0)} onClick={() => setLotsNum(suggested)} className="rounded bg-blue-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40">Use</button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
        <button type="button" role="switch" aria-checked={settings.sound} onClick={() => useTerminalStore.getState().setSettings({ sound: !settings.sound })} className="flex items-center gap-1.5">
          Sound on fills
          <span className="relative h-4 w-8 rounded-full transition-colors" style={{ backgroundColor: settings.sound ? '#2563eb' : 'var(--tm-border2)' }}>
            <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: settings.sound ? 18 : 2 }} />
          </span>
        </button>
        {notifSupported() && notifPermission() === 'default' && (
          <button type="button" onClick={async () => { await askNotifPermission(); useTerminalStore.getState().setSettings({ notifAsked: true }) }} className="underline">Enable notifications</button>
        )}
      </div>

      <button type="button" onClick={() => { if (window.confirm(`Reset the demo account to ${fmtMoney(account.startBalance)}? All positions and history will be deleted.`)) useTerminalStore.getState().resetAccount() }}
        className="self-start text-[10px] font-semibold text-slate-500 underline hover:text-slate-300">Reset demo account</button>
    </div>
  )
}
