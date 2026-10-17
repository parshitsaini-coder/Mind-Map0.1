import { useMemo } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { needsMigration, migrationCounts } from '../../lib/terminal/liveMigration'

// Phase 14.5 — shown once for accounts that were used with the old simulated prices.
export default function MigrationDialog() {
  const isOpen = useTerminalStore((s) => s.isOpen)
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const history = useTerminalStore((s) => s.history)
  const state = useMemo(() => ({ positions, orders, history }), [positions, orders, history])
  if (!isOpen || !needsMigration(state)) return null
  const c = migrationCounts(state)
  const act = (choice) => useTerminalStore.getState().migrateToLive(choice)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="mig-title" data-testid="migration-dialog">
      <div className="w-full max-w-md rounded-xl border p-4 shadow-2xl" style={{ backgroundColor: 'var(--tm-panel)', borderColor: 'var(--tm-border2)' }}>
        <h2 id="mig-title" className="text-[15px] font-extrabold">Live data is on</h2>
        <p className="mt-1 text-[12px] text-slate-300">Your old practice trades used simulated prices. The terminal now shows real XAUUSD (gold) prices only.</p>
        <ul className="mt-2 text-[12px] text-slate-400">
          <li>{c.trades} past trade(s) · {c.positions} open trade(s) · {c.orders} pending order(s)</li>
        </ul>
        <div className="mt-3 grid gap-2">
          <button type="button" data-testid="mig-keep" onClick={() => act('keep')} className="rounded-lg bg-blue-600 px-3 py-2 text-left text-[12px] font-bold text-white hover:bg-blue-500">
            Keep my history
            <span className="block text-[11px] font-normal text-blue-100">Open trades are closed flat at their entry price (profit 0), pending orders are cancelled. Old trades stay in History, tagged “simulated” and hidden from live stats. Your balance does not change.</span>
          </button>
          <button type="button" data-testid="mig-fresh" onClick={() => { if (window.confirm('Start a fresh account? Old trades and history will be deleted.')) act('fresh') }} className="rounded-lg border px-3 py-2 text-left text-[12px] font-bold hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)' }}>
            Start a fresh account
            <span className="block text-[11px] font-normal text-slate-400">Balance goes back to your starting balance; old trades and history are deleted.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
