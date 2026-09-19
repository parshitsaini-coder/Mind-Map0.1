// Single source of truth for applying tradeAnalysisStore's `filters` state
// (set via FiltersPopover) to a list of trades. Originally this predicate
// was copy-pasted inside TradesTable.jsx and TradeCards.jsx, so the
// Analysis tab — which reads trades through useScopedTrades() — silently
// ignored the Filters button entirely (it only lived in Table view).
// Everything now imports this one function, so "Filters" means the same
// thing everywhere it's used.
export function applyFilters(trades, filters) {
  if (!filters) return trades
  return trades.filter((t) => {
    // Multi-select filters: an empty array means "no restriction"; a
    // non-empty array means the trade's value must be one of the picks.
    if (filters.pair?.length && !filters.pair.includes(t.pair)) return false
    if (filters.instrumentType?.length && !filters.instrumentType.includes(t.instrumentType)) return false
    if (filters.timeframe?.length && !filters.timeframe.includes(t.timeframe)) return false
    if (filters.direction?.length && !filters.direction.includes(t.direction)) return false
    if (filters.status?.length && !filters.status.includes(t.status)) return false
    if (filters.validationRuleId?.length && !(t.validationRuleIds || []).some((id) => filters.validationRuleId.includes(id))) return false
    if (filters.dateFrom && t.date < filters.dateFrom) return false
    if (filters.dateTo && t.date > filters.dateTo) return false
    return true
  })
}
