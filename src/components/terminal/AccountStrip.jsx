import { useTerminalStore } from '../../store/terminalStore'
import { useAccountMetrics } from './hooks'
import { fmtMoney, pnlColor } from './format'
import { marginState } from '../../lib/terminal/positionOverlay'
import { FlashText } from './fxBits'
import { useAnimMode } from './useAnimMode'

// Phase 10: compact Balance / Equity / Floating P/L / Margin level on the chart (top-right).
// Amber under the warning level (Settings → Trading), red under stop-out. The state is also written as a
// word ("LOW" / "STOP-OUT RISK") so it is never colour alone.
const TONE = { ok: 'var(--tm-text)', warn: '#f59e0b', danger: '#ef4444', none: 'var(--tm-muted)' }

// Declared outside the component so each number keeps its own identity (its flash needs the previous value).
const Item = ({ k, v, color, n }) => (
  <span className="flex items-baseline gap-1"><span style={{ color: 'var(--tm-muted)' }}>{k}</span><FlashText value={n} className="font-bold tabular-nums" style={{ color }}>{v}</FlashText></span>
)

export default function AccountStrip({ active = true }) {
  const { metrics } = useAccountMetrics()
  const warn = useTerminalStore((s) => s.chartSettings.trading.marginWarn)
  const stopOut = useTerminalStore((s) => s.settings.stopOutLevel)
  const hasPos = useTerminalStore((s) => s.positions.length > 0)
  const fxMargin = useTerminalStore((s) => s.chartSettings.anim.fx.margin)
  const mode = useAnimMode()
  if (!active) return null
  const level = metrics.marginLevel
  const state = marginState(level, warn, stopOut)
  const pulse = mode !== 'off' && fxMargin && (state === 'warn' || state === 'danger')
  const word = state === 'warn' ? 'LOW' : state === 'danger' ? 'STOP-OUT RISK' : null
  return (
    <div
      role="group"
      aria-label="Account summary"
      className="pointer-events-none absolute right-14 top-1.5 z-[5] flex max-w-[calc(100%-5rem)] flex-wrap justify-end gap-x-3 gap-y-0.5 rounded-md border px-2 py-1 text-[10px] md:text-[11px]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--tm-panel2) 88%, transparent)', borderColor: state === 'warn' || state === 'danger' ? TONE[state] : 'var(--tm-border)' }}
    >
      <span className="hidden sm:flex"><Item k="Bal" v={fmtMoney(metrics.balance)} n={metrics.balance} color="var(--tm-text)" /></span>
      <Item k="Eq" v={fmtMoney(metrics.equity)} n={metrics.equity} color="var(--tm-text)" />
      {hasPos && <Item k="P/L" v={fmtMoney(metrics.floating, { sign: true })} n={metrics.floating} color={pnlColor(metrics.floating)} />}
      {level != null && <Item k="Margin" v={`${level.toFixed(0)}%${word ? ` ${word}` : ''}`} n={level} color={TONE[state]} />}
      {pulse && <span aria-hidden="true" data-testid="strip-pulse" className="tm-margin-pulse pointer-events-none absolute inset-0 rounded-md border-2" style={{ borderColor: TONE[state] }} />}
    </div>
  )
}
