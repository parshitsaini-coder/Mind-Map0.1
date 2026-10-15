import { useMemo } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { legacyCounts, needsMigration } from '../../lib/terminal/migrateLegacy'

// One-time, blocking choice for accounts traded on the old simulated prices. Never changes a balance silently.
export default function MigrationDialog() {
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const history = useTerminalStore((s) => s.history)
  const keep = useTerminalStore((s) => s.migrateKeepHistory)
  const fresh = useTerminalStore((s) => s.migrateFreshAccount)
  const ledger = useMemo(() => ({ positions, orders: orders || [], history }), [positions, orders, history])
  if (!needsMigration(ledger)) return null
  const c = legacyCounts(ledger)
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true" aria-labelledby="mig-title">
      <div className="w-full max-w-md rounded-xl border p-5" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border)', color: 'var(--tm-text)' }}>
        <h2 id="mig-title" className="text-base font-bold">Live data is on</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--tm-muted)' }}>
          Your old practice trades used simulated prices, which do not match the real market. Nothing changes until you choose.
        </p>
        <p className="mt-2 text-xs" style={{ color: 'var(--tm-muted)' }}>
          Found: {c.positions} open trade(s), {c.orders} pending order(s), {c.history} closed trade(s).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={keep} className="min-h-[44px] rounded-lg px-4 py-2 text-left text-sm font-semibold" style={{ backgroundColor: 'var(--tm-active)', color: '#fff' }}>
            Keep history
            <span className="block text-xs font-normal opacity-90">Close open trades at their entry price (flat, no profit or loss), cancel pending orders. Old trades are tagged “simulated” and hidden from statistics by default. Balance stays the same.</span>
          </button>
          <button type="button" onClick={() => { if (window.confirm('Start a fresh account? Old positions, orders and history are removed.')) fresh() }} className="min-h-[44px] rounded-lg border px-4 py-2 text-left text-sm font-semibold" style={{ borderColor: 'var(--tm-border2)' }}>
            Start a fresh account
            <span className="block text-xs font-normal" style={{ color: 'var(--tm-muted)' }}>Same starting balance and leverage, everything else cleared.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
