import { useMemo } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { useAccountMetrics } from './hooks'
import { fmtMoney, pnlColor } from './format'
import CloudBadge from './CloudBadge'

function Cell({ label, value, color }) {
  return (
    <div className="flex shrink-0 flex-col leading-tight">
      <span className="text-[8px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: color || '#e5e7eb' }}>{value}</span>
    </div>
  )
}

export default function AccountBar() {
  const { metrics } = useAccountMetrics()
  const history = useTerminalStore((s) => s.history)
  const stopOut = useTerminalStore((s) => s.settings.stopOutLevel)
  const realizedToday = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0) / 1000
    return history.reduce((a, h) => (h.closeTime >= start ? a + h.pnl : a), 0)
  }, [history])
  const today = realizedToday + metrics.floating
  const lvl = metrics.marginLevel
  const lvlColor = lvl == null ? undefined : lvl < stopOut + 25 ? '#f87171' : lvl < 100 ? '#fbbf24' : '#4ade80'
  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-4 overflow-x-auto border-b px-3" style={{ borderColor: '#27313d', backgroundColor: '#10161d' }}>
      <Cell label="Balance" value={fmtMoney(metrics.balance)} />
      <Cell label="Equity" value={fmtMoney(metrics.equity)} />
      <Cell label="Margin" value={fmtMoney(metrics.usedMargin)} />
      <Cell label="Free margin" value={fmtMoney(metrics.freeMargin)} color={metrics.freeMargin < 0 ? '#f87171' : undefined} />
      <Cell label="Margin level" value={lvl == null ? '—' : `${lvl.toFixed(0)}%`} color={lvlColor} />
      <Cell label="Today P&L" value={fmtMoney(today, { sign: true })} color={pnlColor(today)} />
      {lvl != null && lvl < 100 && (
        <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: lvl < stopOut + 25 ? '#7f1d1d' : '#78350f', color: '#fff' }}>
          ⚠ Margin call — stop-out at {stopOut}%
        </span>
      )}
      <CloudBadge />
    </div>
  )
}
