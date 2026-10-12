import { useEffect, useMemo } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { watch } from '../../lib/terminal/quoteHub'
import { markSeen, getLastSeen } from '../../lib/terminal/lastSeen'
import { useQuotes } from './hooks'

const MIN_GAP_SEC = 120

// Renders nothing. Keeps live prices flowing for the active symbol + every open position and
// pending order, runs SL/TP/trailing/stop-out/pending fills on each price update, and replays
// missed price action (offline catch-up) when the terminal opens or the tab comes back.
export default function TradingEngine({ symbol, extra }) {
  const positions = useTerminalStore((s) => s.positions)
  const orders = useTerminalStore((s) => s.orders)
  const extraKey = (extra || []).join(',') // symbols of the other visible charts
  const key = useMemo(
    () => [...new Set([symbol, ...(extraKey ? extraKey.split(',') : []), ...positions.map((p) => p.symbol), ...orders.map((o) => o.symbol)])].sort().join(','),
    [symbol, extraKey, positions, orders],
  )
  useEffect(() => {
    const offs = key.split(',').map(watch)
    return () => offs.forEach((off) => off())
  }, [key])

  const history = useTerminalStore((s) => s.history)
  const autoJournal = useTerminalStore((s) => s.settings.autoJournal)
  useEffect(() => {
    if (autoJournal) useTerminalStore.getState().autoJournalSync()
  }, [history, autoJournal])

  const quotes = useQuotes()
  useEffect(() => {
    useTerminalStore.getState().tick(quotes)
  }, [quotes])

  useEffect(() => {
    const catchUp = () => {
      const st = useTerminalStore.getState()
      const now = Math.floor(Date.now() / 1000)
      const last = getLastSeen()
      if (last && now - last > MIN_GAP_SEC) st.catchUp(last, now)
      markSeen(now)
    }
    catchUp()
    const iv = setInterval(() => { if (!document.hidden) markSeen() }, 5000)
    const onVis = () => (document.hidden ? markSeen() : catchUp())
    const onHide = () => markSeen()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      markSeen()
    }
  }, [])
  return null
}
