// Phase 14.5 — moving an existing demo account from the old SIMULATED prices to LIVE data.
// Pure functions (no store, no I/O). The decision is DERIVED from the data itself (every live
// position / order / trade carries source:'live'), so it is idempotent and cloud-safe: a second
// device that pulls the migrated state simply finds nothing left to migrate.

const isLive = (x) => x && x.source === 'live'

export function needsMigration(s) {
  if (!s) return false
  return (s.positions || []).some((p) => !isLive(p)) || (s.orders || []).some((o) => !isLive(o)) || (s.history || []).some((h) => !h.source)
}
export function migrationCounts(s) {
  return {
    positions: (s.positions || []).filter((p) => !isLive(p)).length,
    orders: (s.orders || []).filter((o) => !isLive(o)).length,
    trades: (s.history || []).filter((h) => !h.source).length,
  }
}

// Keep history: tag old trades 'simulated', close old open positions FLAT (exit = entry, P/L 0 — the
// balance never changes) and cancel old pending orders. Returns the fields to merge into the ledger.
export function migrateKeep(s, now = Math.floor(Date.now() / 1000)) {
  let nextId = s.nextId
  const closed = []
  for (const p of s.positions || []) {
    if (isLive(p)) continue
    closed.push({
      id: `h${nextId++}`, positionId: p.id, symbol: p.symbol, side: p.side, lots: p.lots, entry: p.entry, exit: p.entry,
      sl: p.sl ?? null, tp: p.tp ?? null, openTime: p.openTime, closeTime: now, pnl: 0, pips: 0, reason: 'migration', source: 'simulated',
      ...(p.tf ? { tf: p.tf } : {}),
    })
  }
  const history = [...closed.reverse(), ...(s.history || [])].map((h) => (h.source ? h : { ...h, source: 'simulated' }))
  return {
    positions: (s.positions || []).filter(isLive),
    orders: (s.orders || []).filter(isLive),
    history, nextId,
  }
}
// Fresh account: back to the starting balance, nothing left from the simulated era.
export function migrateFresh(s) {
  return {
    account: { ...s.account, balance: s.account.startBalance },
    positions: [], orders: [], history: [], transactions: [], nextId: s.nextId, // ids keep counting: no clash with journal keys
  }
}
// Live stats exclude simulated trades unless the user asks for them.
export const liveOnly = (history, includeSimulated) => (includeSimulated ? history : (history || []).filter((h) => h.source !== 'simulated'))
export const simulatedCount = (history) => (history || []).filter((h) => h.source === 'simulated').length
