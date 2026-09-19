import { useMemo } from 'react'
import { useTradeAnalysisStore } from '../../../../store/tradeAnalysisStore'
import { parseDate } from '../../../../utils/tradeAnalyticsPro'
import { splitTradesByCurrency } from '../../../../utils/currency'
import { applyFilters } from '../../../../utils/tradeFilters'

// One place where "which trades is the Analysis tab currently looking at"
// is decided. Every widget reads through this instead of touching
// store.trades directly, so the date-scope control in the toolbar applies
// everywhere at once and can never drift out of sync with what's on
// screen.

export const SCOPE_PRESETS = [
  { id: 'all', label: 'All time', days: null },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: '6m', label: '6 months', days: 182 },
  { id: '1y', label: '1 year', days: 365 },
  { id: 'custom', label: 'Custom', days: null },
]

/** Start/end Date objects for a scope, or null bounds for "all time". */
export function scopeBounds(scope) {
  if (!scope || scope.preset === 'all') return { from: null, to: null }

  if (scope.preset === 'custom') {
    const from = scope.from ? new Date(`${scope.from}T00:00:00`) : null
    const to = scope.to ? new Date(`${scope.to}T23:59:59`) : null
    return {
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      to: to && !Number.isNaN(to.getTime()) ? to : null,
    }
  }

  const preset = SCOPE_PRESETS.find((p) => p.id === scope.preset)
  if (!preset?.days) return { from: null, to: null }

  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const from = new Date()
  from.setDate(from.getDate() - preset.days + 1)
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

export function applyScope(trades, scope) {
  const { from, to } = scopeBounds(scope)
  if (!from && !to) return trades
  return trades.filter((t) => {
    const d = parseDate(t)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}

/**
 * The trades in scope, pre-split by currency, plus the comparison window
 * immediately before the current one (same length) so any widget can show
 * a "vs previous period" delta without recomputing the date maths.
 */
export function useScopedTrades() {
  const allTrades = useTradeAnalysisStore((s) => s.trades)
  const scope = useTradeAnalysisStore((s) => s.analysisScope)
  // The same Filters popover state that drives Table/Cards view (pair,
  // instrument type, timeframe, direction, status, validation rule,
  // date range) now applies here too, on top of the date-scope preset
  // above — so picking a filter actually changes what every Analysis
  // widget shows instead of only affecting the Table/Cards rows.
  const filters = useTradeAnalysisStore((s) => s.filters)

  return useMemo(() => {
    const filteredAll = applyFilters(allTrades, filters)
    const trades = applyScope(filteredAll, scope)
    const { INR, USD } = splitTradesByCurrency(trades)
    const { from, to } = scopeBounds(scope)

    let previous = []
    if (from && to) {
      const span = to.getTime() - from.getTime()
      const prevTo = new Date(from.getTime() - 1)
      const prevFrom = new Date(from.getTime() - span - 1)
      previous = filteredAll.filter((t) => {
        const d = parseDate(t)
        return d >= prevFrom && d <= prevTo
      })
    }

    return {
      trades,
      allTrades,
      inr: INR,
      usd: USD,
      previous,
      from,
      to,
      scoped: trades.length !== allTrades.length,
      excluded: allTrades.length - trades.length,
    }
  }, [allTrades, scope, filters])
}

/**
 * The currency groups worth rendering. An equity-only trader should never
 * see four empty "Forex & Commodity ($)" cards, so a group with no trades
 * at all is simply left out — and when only one group exists, widgets can
 * render it full-width instead of half.
 */
export function useCurrencyGroups() {
  const { inr, usd } = useScopedTrades()
  return useMemo(() => {
    const groups = []
    if (inr.length) groups.push({ id: 'INR', label: 'Equity', symbol: '₹', trades: inr })
    if (usd.length) groups.push({ id: 'USD', label: 'Forex & Commodity', symbol: '$', trades: usd })
    return groups
  }, [inr, usd])
}

/** Memoises a derive function against a trade list. */
export function useDerived(fn, trades, deps = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(trades), [trades, ...deps])
}
