import { useMemo, useSyncExternalStore } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { subscribeHub, getSnapshot } from '../../lib/terminal/quoteHub'
import { subscribeStatus, getStatusSnapshot, getStatus } from '../../lib/terminal/feed/liveFeed'
import { liveOnly } from '../../lib/terminal/liveMigration'
import { metricsFor } from '../../lib/terminal/ledger'

// Connection state: live | delayed | offline | closed | loading (+ reason, provider, lastUpdate)
export const useFeedStatus = () => useSyncExternalStore(subscribeStatus, getStatusSnapshot)
export const feedStatusNow = getStatus
export const useQuotes = () => useSyncExternalStore(subscribeHub, getSnapshot)
// Re-renders only when THIS symbol's quote changes.
export const useQuote = (symbol) => useSyncExternalStore(subscribeHub, () => getSnapshot()[symbol])

export function useAccountMetrics() {
  const quotes = useQuotes()
  const account = useTerminalStore((s) => s.account)
  const positions = useTerminalStore((s) => s.positions)
  const metrics = useMemo(() => metricsFor({ account, positions }, quotes), [account, positions, quotes])
  return { quotes, metrics }
}

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

// Closed trades for stats / history: old simulated-price trades are hidden unless the user opts in.
export function useLiveHistory() {
  const history = useTerminalStore((s) => s.history)
  const show = useTerminalStore((s) => s.showSimulated)
  return useMemo(() => liveOnly(history, show), [history, show])
}
