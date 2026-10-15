import { useEffect, useRef } from 'react'
import { emitTerminalEvent } from '../../lib/terminal/effects'
import { useTerminalStore } from '../../store/terminalStore'
import { useAccountMetrics } from './hooks'
import { fmtMoney, pnlColor } from './format'
import AnimNum from './AnimNum'
import { marginState } from '../../lib/terminal/chartOrders'

const STATE_COLOR = { ok: '#4ade80', warn: '#fbbf24', danger: '#f87171', none: 'var(--tm-muted)' }

function Cell({ label, value, color, testid, narrowHide, raw, fmt }) {
  return (
    <div className={`${narrowHide ? 'hidden sm:flex' : 'flex'} flex-col items-end leading-tight`}>
      <span className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--tm-muted)' }}>{label}</span>
      <span data-testid={testid} className="text-[11px] font-bold tabular-nums" style={{ color: color || 'var(--tm-text)' }}>{raw != null ? <AnimNum value={raw} fmt={fmt} /> : value}</span>
    </div>
  )
}

// Balance / Equity / Floating P/L / Margin level on the chart. Amber under the warning level
// (Settings → Trading), red under the stop-out level; the text says it too, not only the colour.
export default function ChartAccountStrip() {
  const { metrics } = useAccountMetrics()
  const warn = useTerminalStore((s) => s.chartSettings.trading.marginWarn)
  const stopOut = useTerminalStore((s) => s.settings.stopOutLevel)
  const lvl = metrics.marginLevel
  const state = marginState(lvl, warn, stopOut)
  // Margin warning sound/toast: once when the level drops into warn/danger, then at most once a minute.
  const prev = useRef(state)
  const last = useRef(0)
  useEffect(() => {
    const was = prev.current
    prev.current = state
    if ((state === 'warn' || state === 'danger') && was !== state && Date.now() - last.current > 60000) {
      last.current = Date.now()
      emitTerminalEvent({ id: 'account.margin.warning', text: `Margin level is low (${lvl == null ? '' : lvl.toFixed(0) + '%'})` })
    }
  }, [state, lvl])
  const tag = state === 'danger' ? ' ⚠ stop-out' : state === 'warn' ? ' ⚠ low' : ''
  return (
    <div data-testid="chart-account-strip" data-margin-state={state} role="group" aria-label="Account summary"
      className={`${state === 'warn' || state === 'danger' ? 'tm-margin-pulse ' : ''}pointer-events-none absolute right-[72px] top-1.5 z-[6] max-sm:bottom-9 max-sm:top-auto flex items-start gap-3 rounded-md border px-2 py-1 backdrop-blur-sm`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--tm-panel) 82%, transparent)', borderColor: state === 'ok' || state === 'none' ? 'var(--tm-border)' : STATE_COLOR[state] }}>
      <Cell label="Balance" value={fmtMoney(metrics.balance)} narrowHide testid="strip-balance" />
      <Cell label="Equity" value={fmtMoney(metrics.equity)} narrowHide testid="strip-equity" />
      <Cell label="Floating" raw={metrics.floating} fmt={(v) => fmtMoney(v, { sign: true })} color={pnlColor(metrics.floating)} testid="strip-floating" />
      <Cell label="Margin" value={lvl == null ? '—' : `${lvl.toFixed(0)}%${tag}`} color={STATE_COLOR[state]} testid="strip-margin" />
    </div>
  )
}
