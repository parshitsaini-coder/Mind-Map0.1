// Trade-history analytics, filters and CSV export for the demo terminal. Pure functions.
// A "trade" is one history entry (a partial close counts as its own trade).

const idNum = (t) => Number(String(t.id).replace(/\D/g, '')) || 0
const byClose = (a, b) => a.closeTime - b.closeTime || idNum(a) - idNum(b)
const sum = (a) => a.reduce((x, y) => x + y, 0)
const r2 = (n) => Math.round(n * 100) / 100

export const REASON_LABEL = { manual: 'Manual', sl: 'Stop loss', tp: 'Take profit', stopout: 'Stop-out', reverse: 'Reverse', ptp: 'Partial TP' }

// f: { symbol, side, result: 'win'|'loss', reason, period: 'today'|'7d'|'30d' }  (empty/'all' = no filter)
export function filterTrades(history, f = {}, now = Math.floor(Date.now() / 1000)) {
  const since = f.period === 'today' ? Math.floor(new Date(now * 1000).setHours(0, 0, 0, 0) / 1000)
    : f.period === '7d' ? now - 7 * 86400 : f.period === '30d' ? now - 30 * 86400 : null
  return history.filter((t) =>
    (!f.symbol || f.symbol === 'all' || t.symbol === f.symbol) &&
    (!f.side || f.side === 'all' || t.side === f.side) &&
    (!f.reason || f.reason === 'all' || t.reason === f.reason) &&
    (!f.result || f.result === 'all' || (f.result === 'win' ? t.pnl > 0 : f.result === 'loss' ? t.pnl < 0 : t.pnl === 0)) &&
    (since == null || t.closeTime >= since))
}

function group(trades) {
  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl < 0)
  const gp = sum(wins.map((t) => t.pnl))
  const gl = sum(losses.map((t) => t.pnl)) // negative
  return {
    trades: trades.length, wins: wins.length, losses: losses.length, breakeven: trades.length - wins.length - losses.length,
    net: r2(gp + gl), grossProfit: r2(gp), grossLoss: r2(gl),
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    profitFactor: gl === 0 ? (gp > 0 ? Infinity : null) : gp / Math.abs(gl),
    pips: Math.round(sum(trades.map((t) => t.pips)) * 10) / 10,
  }
}

// Closed-trade equity = starting balance + running sum of trade P&L (deposits/withdrawals are
// deliberately left out so they can't fake a drawdown or a profit).
export function statsFor(trades, startBalance = 10000) {
  const sorted = [...trades].sort(byClose)
  const g = group(sorted)
  const wins = sorted.filter((t) => t.pnl > 0)
  const losses = sorted.filter((t) => t.pnl < 0)

  const curve = [{ t: sorted.length ? sorted[0].openTime : 0, balance: startBalance }]
  let bal = startBalance, peak = startBalance, maxDD = 0, maxDDPct = 0
  for (const t of sorted) {
    bal = r2(bal + t.pnl)
    curve.push({ t: t.closeTime, balance: bal })
    if (bal > peak) peak = bal
    const dd = peak - bal
    if (dd > maxDD) maxDD = dd
    if (peak > 0 && (dd / peak) * 100 > maxDDPct) maxDDPct = (dd / peak) * 100
  }

  let winStreak = 0, lossStreak = 0, w = 0, l = 0
  for (const t of sorted) {
    if (t.pnl > 0) { w++; l = 0 } else if (t.pnl < 0) { l++; w = 0 } else { w = 0; l = 0 }
    winStreak = Math.max(winStreak, w)
    lossStreak = Math.max(lossStreak, l)
  }

  const bySymbol = {}
  for (const sym of [...new Set(sorted.map((t) => t.symbol))]) bySymbol[sym] = group(sorted.filter((t) => t.symbol === sym))

  const avgWin = wins.length ? g.grossProfit / wins.length : null
  const avgLoss = losses.length ? g.grossLoss / losses.length : null
  return {
    ...g,
    avgWin, avgLoss,
    payoff: avgWin != null && avgLoss != null ? avgWin / Math.abs(avgLoss) : null,
    expectancy: sorted.length ? g.net / sorted.length : null,
    best: sorted.length ? sorted.reduce((a, t) => (t.pnl > a.pnl ? t : a)) : null,
    worst: sorted.length ? sorted.reduce((a, t) => (t.pnl < a.pnl ? t : a)) : null,
    avgDurationSec: sorted.length ? sum(sorted.map((t) => t.closeTime - t.openTime)) / sorted.length : null,
    maxDrawdown: r2(maxDD), maxDrawdownPct: maxDDPct,
    currentDrawdown: r2(peak - bal), endBalance: bal,
    winStreak, lossStreak, curve, bySymbol,
  }
}

export function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

const CSV_COLS = ['id', 'symbol', 'side', 'lots', 'open_time_utc', 'close_time_utc', 'entry', 'exit', 'sl', 'tp', 'pips', 'pnl_usd', 'duration_min', 'reason', 'approx_offline']
const cell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(trades) {
  const iso = (t) => new Date(t * 1000).toISOString()
  const rows = [...trades].sort(byClose).map((t) => [
    t.id, t.symbol, t.side, t.lots, iso(t.openTime), iso(t.closeTime), t.entry, t.exit, t.sl, t.tp,
    t.pips, t.pnl, Math.round(((t.closeTime - t.openTime) / 60) * 10) / 10, REASON_LABEL[t.reason] || t.reason, t.approx ? 'yes' : 'no',
  ])
  return [CSV_COLS, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
