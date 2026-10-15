// One-time migration of demo accounts that were traded on SIMULATED prices (Phase 14). Pure + idempotent: a record is
// "legacy" when it was opened / placed / closed before LIVE_SINCE (the day real prices went live) and is not yet tagged.
// No new synced key is needed: after migration nothing is legacy any more, so another device that downloads the migrated
// ledger sees nothing to do (cloud-safe), and a stale device re-running it just finds the same result.
import { createLedger } from './ledger.js'

export const LIVE_SINCE = Math.floor(Date.UTC(2026, 9, 15) / 1000) // 2026-10-15 00:00 UTC
const roundMoney = (n) => Math.round(n * 100) / 100

const legacyPos = (p, since) => !(p.openTime >= since)
const legacyOrd = (o, since) => !((o.createdAt ?? 0) >= since)
const legacyHist = (h, since) => h.source !== 'simulated' && !(h.closeTime >= since)

export function legacyCounts(ledger, since = LIVE_SINCE) {
  return {
    positions: (ledger.positions || []).filter((p) => legacyPos(p, since)).length,
    orders: (ledger.orders || []).filter((o) => legacyOrd(o, since)).length,
    history: (ledger.history || []).filter((h) => legacyHist(h, since)).length,
  }
}
export function needsMigration(ledger, since = LIVE_SINCE) {
  const c = legacyCounts(ledger, since)
  return c.positions + c.orders + c.history > 0
}

// Keep history: legacy open positions are closed FLAT at their entry price (P/L 0, no commission), legacy pending orders are
// cancelled, every legacy trade is tagged source:'simulated'. Balance is never touched. Live records are left alone.
export function keepHistory(ledger, now, since = LIVE_SINCE) {
  let nextId = ledger.nextId
  const closed = []
  const positions = []
  for (const p of ledger.positions || []) {
    if (!legacyPos(p, since)) { positions.push(p); continue }
    closed.push({
      id: `h${nextId++}`, positionId: p.id, symbol: p.symbol, side: p.side, lots: p.lots, entry: p.entry, exit: p.entry,
      sl: p.sl ?? null, tp: p.tp ?? null, openTime: p.openTime, closeTime: now, pnl: 0, pips: 0, reason: 'migrated', source: 'simulated',
      ...(p.tf ? { tf: p.tf } : {}),
    })
  }
  const orders = (ledger.orders || []).filter((o) => !legacyOrd(o, since))
  const history = [...closed.reverse(), ...(ledger.history || [])].map((h) => (legacyHist(h, since) ? { ...h, source: 'simulated' } : h))
  return {
    ledger: { ...ledger, nextId, positions, orders, history },
    summary: { closedFlat: closed.length, cancelled: (ledger.orders || []).length - orders.length, tagged: history.filter((h) => h.source === 'simulated').length },
  }
}

// Start fresh: a new ledger with the same starting balance and leverage.
export function freshAccount(ledger, now) {
  const start = Number(ledger.account?.startBalance)
  return createLedger(roundMoney(Number.isFinite(start) && start >= 10 ? start : 10000), ledger.account?.leverage || 100, now)
}

// History visible by default: simulated-era trades are excluded unless asked for.
export const liveHistory = (history, includeSimulated = false) => (includeSimulated ? history : history.filter((h) => h.source !== 'simulated'))
