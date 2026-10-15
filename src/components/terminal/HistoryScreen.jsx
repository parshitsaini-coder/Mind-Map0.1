import { memo, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Check, Download } from 'lucide-react'
import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS, SYMBOLS } from '../../lib/terminal/instruments'
import * as S from '../../lib/terminal/stats'
import { journalKey } from '../../lib/terminal/journal'
import { StatsView, AccountView } from './StatsAccount'
import { fmtMoney, fmtPrice, fmtTime, pnlColor } from './format'

const BORDER = 'var(--tm-border)'
const TABS = [['trades', 'Trades'], ['stats', 'Statistics'], ['account', 'Account']]
const sel = 'rounded-md border bg-[var(--tm-deep)] px-2 py-1.5 text-[16px] font-semibold text-slate-100 md:text-[12px]'
const PAGE = 100

function downloadCsv(rows) {
  const blob = new Blob([S.toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `terminal-trades-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TradeRow = memo(function TradeRow({ h, sent }) {
  const inst = INSTRUMENTS[h.symbol]
  const d = inst?.digits ?? 5
  return (
    <div className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
      <div className="flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-white" style={{ backgroundColor: h.side === 'buy' ? '#15803d' : '#b91c1c' }}>{h.side.toUpperCase()}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-bold">{h.symbol} <span className="font-semibold text-slate-400">{h.lots} lots</span>
            <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">{S.REASON_LABEL[h.reason] || h.reason}</span>
            {h.approx && <span className="ml-1 rounded bg-amber-900/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-200" title="Filled while the app was closed (approximate)">≈ offline</span>}
          </div>
          <div className="truncate text-[10px] tabular-nums text-slate-400">{fmtPrice(h.entry, d)} → {fmtPrice(h.exit, d)} · SL {h.sl == null ? '—' : fmtPrice(h.sl, d)} · TP {h.tp == null ? '—' : fmtPrice(h.tp, d)}</div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-[13px] font-extrabold tabular-nums" style={{ color: pnlColor(h.pnl) }}>{fmtMoney(h.pnl, { sign: true })}</div>
          <div className="text-[10px] tabular-nums text-slate-400">{h.pips > 0 ? '+' : h.pips < 0 ? '−' : ''}{Math.abs(h.pips)} pips</div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="min-w-0 flex-1 truncate">{fmtTime(h.openTime)} → {fmtTime(h.closeTime)} · {S.fmtDuration(h.closeTime - h.openTime)}</span>
        {sent ? (
          <span className="flex shrink-0 items-center gap-1 font-bold text-emerald-400"><Check size={11} /> In journal</span>
        ) : (
          <button type="button" onClick={() => useTerminalStore.getState().sendToJournal([h])} className="flex shrink-0 items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700"><BookOpen size={11} /> Send to journal</button>
        )}
      </div>
    </div>
  )
})

function Inner() {
  const history = useTerminalStore((s) => s.history)
  const journaled = useTerminalStore((s) => s.journaled)
  const startBalance = useTerminalStore((s) => s.account.startBalance)
  const [tab, setTab] = useState('trades')
  const [f, setF] = useState({ symbol: 'all', side: 'all', result: 'all', reason: 'all', period: 'all' })
  const [shown, setShown] = useState(PAGE)
  const rows = useMemo(() => S.filterTrades(history, f), [history, f])
  const stats = useMemo(() => S.statsFor(rows, startBalance), [rows, startBalance])
  const unsent = useMemo(() => rows.filter((h) => !journaled[journalKey(h)]), [rows, journaled])
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setShown(PAGE) }
  const filtered = Object.values(f).some((v) => v !== 'all')

  return (
    <div className="absolute inset-0 z-40 flex flex-col text-slate-100" style={{ backgroundColor: '#0f1419', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-2" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel)' }}>
        <button type="button" onClick={() => useTerminalStore.getState().setHistoryOpen(false)} className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] font-semibold text-slate-300 hover:bg-white/10"><ArrowLeft size={14} /> Chart</button>
        <div className="hidden whitespace-nowrap text-[13px] font-extrabold sm:block">History &amp; statistics</div>
        <div role="tablist" className="no-scrollbar ml-auto flex min-w-0 gap-1 overflow-x-auto">
          {TABS.map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="shrink-0 rounded px-2.5 py-1 text-[12px] font-bold"
              style={{ backgroundColor: tab === id ? 'var(--tm-active)' : 'transparent', color: tab === id ? '#fff' : 'var(--tm-muted)' }}>{text}</button>
          ))}
        </div>
      </div>

      {tab !== 'account' && (
        <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2" style={{ borderColor: BORDER, backgroundColor: 'var(--tm-panel2)' }}>
          <select aria-label="Filter symbol" value={f.symbol} onChange={set('symbol')} className={sel} style={{ borderColor: BORDER }}>
            <option value="all">All symbols</option>{SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Filter side" value={f.side} onChange={set('side')} className={sel} style={{ borderColor: BORDER }}>
            <option value="all">Buy &amp; sell</option><option value="buy">Buy</option><option value="sell">Sell</option>
          </select>
          <select aria-label="Filter result" value={f.result} onChange={set('result')} className={sel} style={{ borderColor: BORDER }}>
            <option value="all">Any result</option><option value="win">Winners</option><option value="loss">Losers</option><option value="flat">Break-even</option>
          </select>
          <select aria-label="Filter reason" value={f.reason} onChange={set('reason')} className={sel} style={{ borderColor: BORDER }}>
            <option value="all">Any exit</option>{Object.entries(S.REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Filter period" value={f.period} onChange={set('period')} className={sel} style={{ borderColor: BORDER }}>
            <option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
          </select>
          {filtered && <button type="button" onClick={() => setF({ symbol: 'all', side: 'all', result: 'all', reason: 'all', period: 'all' })} className="shrink-0 text-[11px] font-bold text-sky-400 underline">Clear</button>}
          <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-slate-400">{rows.length} of {history.length} trades</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'trades' && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: BORDER }}>
              <span className="text-[12px] font-extrabold tabular-nums" style={{ color: pnlColor(stats.net) }}>Net {fmtMoney(stats.net, { sign: true })}</span>
              <span className="text-[11px] text-slate-400">{stats.wins}W · {stats.losses}L{stats.breakeven ? ` · ${stats.breakeven} flat` : ''}</span>
              <div className="ml-auto flex gap-2">
                <button type="button" disabled={!unsent.length} onClick={() => useTerminalStore.getState().sendToJournal([...unsent].reverse())} className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-700 disabled:opacity-40"><BookOpen size={12} /> Send {unsent.length || ''} to journal</button>
                <button type="button" disabled={!rows.length} onClick={() => downloadCsv(rows)} className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-40"><Download size={12} /> Export CSV</button>
              </div>
            </div>
            {rows.length ? (
              <>
                {rows.slice(0, shown).map((h) => <TradeRow key={`${h.id}@${h.closeTime}`} h={h} sent={!!journaled[journalKey(h)]} />)}
                {rows.length > shown && <button type="button" onClick={() => setShown(shown + PAGE)} className="block w-full py-3 text-center text-[12px] font-bold text-sky-400 hover:bg-white/5">Show {Math.min(PAGE, rows.length - shown)} more</button>}
              </>
            ) : (
              <div className="px-4 py-12 text-center text-[13px] text-slate-500">{history.length ? 'No trades match these filters.' : 'No closed trades yet — your history and statistics will appear here.'}</div>
            )}
          </>
        )}
        {tab === 'stats' && <StatsView stats={stats} filtered={filtered} startBalance={startBalance} />}
        {tab === 'account' && <AccountView />}
      </div>
    </div>
  )
}

export default function HistoryScreen() {
  const open = useTerminalStore((s) => s.historyOpen)
  return open ? <Inner /> : null
}
