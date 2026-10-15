import { useMemo, useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { LEVERAGES } from '../../lib/terminal/ledger'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { journalKey } from '../../lib/terminal/journal'
import { fmtDuration } from '../../lib/terminal/stats'
import { useAccountMetrics } from './hooks'
import { fmtMoney, fmtTime, pnlColor, UP_TXT, DOWN_TXT } from './format'

const BORDER = 'var(--tm-border)'
const inputCls = 'w-full rounded-md border bg-[var(--tm-deep)] px-2 py-1.5 text-[16px] font-semibold tabular-nums text-slate-100 outline-none focus:border-blue-500 md:text-[13px]'
const pf = (v) => (v == null ? '—' : v === Infinity ? '∞' : v.toFixed(2))

function Card({ label, value, sub, color }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel2)' }}>
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[16px] font-extrabold tabular-nums" style={{ color: color || 'var(--tm-text)' }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}

// Closed-trade equity (start balance + running P&L), drawn as a plain responsive SVG.
function EquityCurve({ curve, start }) {
  const W = 600, H = 170, P = 10
  const bal = curve.map((p) => p.balance)
  const min = Math.min(...bal, start), max = Math.max(...bal, start)
  const span = max - min || 1
  const x = (i) => P + (i / Math.max(1, curve.length - 1)) * (W - 2 * P)
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P)
  const pts = curve.map((p, i) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ')
  const up = bal[bal.length - 1] >= start
  const col = up ? '#22c55e' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[170px] w-full" role="img" aria-label={`Equity curve from ${fmtMoney(start)} to ${fmtMoney(bal[bal.length - 1])} over ${curve.length - 1} trades`}>
      <line x1={P} x2={W - P} y1={y(start)} y2={y(start)} stroke="#475569" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {curve.length > 1 && <polygon points={`${x(0)},${y(start)} ${pts} ${x(curve.length - 1)},${y(start)}`} fill={col} opacity="0.12" />}
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function StatsView({ stats: s, filtered, startBalance }) {
  if (!s.trades) return <div className="px-4 py-12 text-center text-[13px] text-slate-500">{filtered ? 'No trades match these filters.' : 'Statistics appear after your first closed trade.'}</div>
  const syms = Object.entries(s.bySymbol).sort((a, b) => b[1].net - a[1].net)
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card label="Net P&L" value={fmtMoney(s.net, { sign: true })} color={pnlColor(s.net)} sub={`${s.trades} trades`} />
        <Card label="Win rate" value={`${s.winRate.toFixed(1)}%`} sub={`${s.wins}W · ${s.losses}L${s.breakeven ? ` · ${s.breakeven} flat` : ''}`} />
        <Card label="Profit factor" value={pf(s.profitFactor)} sub={`${fmtMoney(s.grossProfit)} / ${fmtMoney(Math.abs(s.grossLoss))}`} color={s.profitFactor == null ? undefined : s.profitFactor >= 1 ? UP_TXT : DOWN_TXT} />
        <Card label="Expectancy" value={fmtMoney(s.expectancy, { sign: true })} sub="avg per trade" color={pnlColor(s.expectancy)} />
        <Card label="Average win" value={s.avgWin == null ? '—' : fmtMoney(s.avgWin)} color={s.avgWin == null ? undefined : UP_TXT} />
        <Card label="Average loss" value={s.avgLoss == null ? '—' : fmtMoney(s.avgLoss)} color={s.avgLoss == null ? undefined : DOWN_TXT} sub={s.payoff == null ? undefined : `payoff ${s.payoff.toFixed(2)}`} />
        <Card label="Best trade" value={fmtMoney(s.best.pnl, { sign: true })} sub={`${s.best.symbol} · ${fmtTime(s.best.closeTime)}`} color={pnlColor(s.best.pnl)} />
        <Card label="Worst trade" value={fmtMoney(s.worst.pnl, { sign: true })} sub={`${s.worst.symbol} · ${fmtTime(s.worst.closeTime)}`} color={pnlColor(s.worst.pnl)} />
        <Card label="Max drawdown" value={fmtMoney(s.maxDrawdown)} sub={`${s.maxDrawdownPct.toFixed(2)}% of peak`} color={s.maxDrawdown > 0 ? DOWN_TXT : undefined} />
        <Card label="Current drawdown" value={fmtMoney(s.currentDrawdown)} color={s.currentDrawdown > 0 ? DOWN_TXT : UP_TXT} />
        <Card label="Avg duration" value={fmtDuration(s.avgDurationSec)} sub={`${s.pips > 0 ? '+' : ''}${s.pips} pips total`} />
        <Card label="Streaks" value={`${s.winStreak}W / ${s.lossStreak}L`} sub="longest runs" />
      </div>

      <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel2)' }}>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-300">Equity curve <span className="font-normal text-slate-500">(closed trades, excl. deposits{filtered ? ', filtered' : ''})</span></span>
          <span className="tabular-nums text-slate-400">{fmtMoney(startBalance)} → <b style={{ color: pnlColor(s.endBalance - startBalance) }}>{fmtMoney(s.endBalance)}</b></span>
        </div>
        <EquityCurve curve={s.curve} start={startBalance} />
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-[1.2fr_0.6fr_0.7fr_0.8fr_0.7fr] gap-1 px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-400" style={{ backgroundColor: 'var(--tm-panel2)' }}>
          <span>Symbol</span><span className="text-right">Trades</span><span className="text-right">Win %</span><span className="text-right">Net P&amp;L</span><span className="text-right">PF</span>
        </div>
        {syms.map(([sym, g]) => (
          <div key={sym} className="grid grid-cols-[1.2fr_0.6fr_0.7fr_0.8fr_0.7fr] gap-1 border-t px-3 py-2 text-[12px] tabular-nums" style={{ borderColor: BORDER }}>
            <span className="font-bold">{sym}</span>
            <span className="text-right text-slate-300">{g.trades}</span>
            <span className="text-right text-slate-300">{g.winRate.toFixed(0)}%</span>
            <span className="text-right font-bold" style={{ color: pnlColor(g.net) }}>{fmtMoney(g.net, { sign: true })}</span>
            <span className="text-right text-slate-300">{pf(g.profitFactor)}</span>
          </div>
        ))}
      </div>
      <div className="px-1 text-[10px] leading-relaxed text-slate-500">A partial close counts as its own trade. Drawdown is measured on closed trades only — open positions and deposits/withdrawals are not included.</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel2)' }}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  )
}

export function AccountView() {
  const { metrics } = useAccountMetrics()
  const account = useTerminalStore((s) => s.account)
  const transactions = useTerminalStore((s) => s.transactions) || []
  const history = useTerminalStore((s) => s.history)
  const journaled = useTerminalStore((s) => s.journaled)
  const autoJournal = useTerminalStore((s) => s.settings.autoJournal)
  const [amount, setAmount] = useState('')
  const [start, setStart] = useState(String(account.startBalance))
  const [msg, setMsg] = useState(null) // { ok, text }
  const unsent = useMemo(() => history.filter((h) => !journaled[journalKey(h)]), [history, journaled])
  const st = useTerminalStore.getState

  const money = (kind) => {
    const r = kind === 'deposit' ? st().deposit(Number(amount)) : st().withdraw(Number(amount), getSnapshot())
    setMsg(r.ok ? { ok: true, text: `${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} done` } : { ok: false, text: r.error })
    if (r.ok) setAmount('')
  }
  const reset = () => {
    const b = Number(start)
    if (!window.confirm(`Reset the demo account to $${Number.isFinite(b) ? b.toLocaleString('en-US') : '?'}?\n\nAll open positions, pending orders, trade history and transactions will be deleted. This cannot be undone.`)) return
    const r = st().resetAccount(b)
    setMsg(r.ok ? { ok: true, text: 'Account reset' } : { ok: false, text: r.error })
  }

  return (
    <div className="mx-auto max-w-xl space-y-3 p-3">
      <div className="grid grid-cols-3 gap-2">
        <Card label="Balance" value={fmtMoney(metrics.balance)} />
        <Card label="Equity" value={fmtMoney(metrics.equity)} />
        <Card label="Free margin" value={fmtMoney(metrics.freeMargin)} />
      </div>

      {msg && <div role="status" className="rounded-md px-3 py-2 text-[12px] font-semibold" style={{ backgroundColor: msg.ok ? '#052e16' : '#450a0a', color: msg.ok ? UP_TXT : DOWN_TXT }}>{msg.text}</div>}

      <Section title="Deposit / withdraw (virtual money)">
        <div className="flex gap-2">
          <input aria-label="Amount" inputMode="decimal" placeholder="Amount in $" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} style={{ borderColor: BORDER }} />
          <button type="button" onClick={() => money('deposit')} className="shrink-0 rounded-md bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-600">Deposit</button>
          <button type="button" onClick={() => money('withdraw')} className="shrink-0 rounded-md bg-slate-700 px-3 text-[12px] font-bold text-white hover:bg-slate-600">Withdraw</button>
        </div>
        <div className="mt-1.5 text-[10px] text-slate-500">You can only withdraw money that isn&apos;t held as margin. Deposits and withdrawals never count as trading profit or loss.</div>
      </Section>

      <Section title="Leverage">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">Applies to trades you open from now on; open positions keep theirs.</span>
          <select aria-label="Account leverage" value={account.leverage} onChange={(e) => st().setLeverage(Number(e.target.value))} className="shrink-0 rounded-md border bg-[var(--tm-deep)] px-2 py-1.5 text-[16px] font-bold md:text-[12px]" style={{ borderColor: BORDER }}>
            {LEVERAGES.map((l) => <option key={l} value={l}>1:{l}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Trade Analysis journal">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-slate-300">Auto-add every trade I close
            <div className="text-[10px] text-slate-500">Only trades closed after you switch this on are added.</div>
          </div>
          <button type="button" role="switch" aria-checked={autoJournal} aria-label="Auto-add closed trades to the journal" onClick={() => st().setAutoJournal(!autoJournal)}>
            <span className="relative block h-5 w-10 rounded-full transition-colors" style={{ backgroundColor: autoJournal ? '#2563eb' : 'var(--tm-border2)' }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: autoJournal ? 22 : 2 }} />
            </span>
          </button>
        </div>
        <button type="button" disabled={!unsent.length} onClick={() => st().sendToJournal([...unsent].reverse())} className="mt-3 w-full rounded-md bg-slate-700 py-2 text-[12px] font-bold hover:bg-slate-600 disabled:opacity-40">
          {unsent.length ? `Send ${unsent.length} past trade${unsent.length > 1 ? 's' : ''} to the journal` : 'All closed trades are in the journal'}
        </button>
      </Section>

      <Section title="Reset demo account">
        <div className="flex items-end gap-2">
          <label className="flex-1 text-[10px] text-slate-400">New starting balance ($)
            <input aria-label="Starting balance" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} mt-1`} style={{ borderColor: BORDER }} />
          </label>
          <button type="button" onClick={reset} className="shrink-0 rounded-md bg-red-700 px-3 py-2 text-[12px] font-bold text-white hover:bg-red-600">Reset account</button>
        </div>
        <div className="mt-1.5 text-[10px] text-slate-500">Deletes all positions, orders, history and transactions. Trades already sent to the journal stay there.</div>
      </Section>

      {transactions.length > 0 && (
        <Section title="Deposits & withdrawals">
          {transactions.slice(0, 20).map((t) => (
            <div key={t.id} className="flex justify-between border-t py-1.5 text-[12px] tabular-nums first:border-t-0" style={{ borderColor: BORDER }}>
              <span className="text-slate-400">{fmtTime(t.time)} · {t.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
              <span className="font-bold" style={{ color: t.type === 'deposit' ? UP_TXT : DOWN_TXT }}>{t.type === 'deposit' ? '+' : '−'}{fmtMoney(t.amount)}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}
