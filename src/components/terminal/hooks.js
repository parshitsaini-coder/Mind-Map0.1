import { useMemo, useSyncExternalStore } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { subscribeHub, getSnapshot } from '../../lib/terminal/quoteHub'
import { metricsFor } from '../../lib/terminal/ledger'

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
