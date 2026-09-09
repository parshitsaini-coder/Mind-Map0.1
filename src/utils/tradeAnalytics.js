// Trade Analysis — Analytics tab derived stats (Step 0 of
// trade-analysis-analytics-master-prompt.md). Every function here is pure:
// (trades, validationRules?) in, plain numbers/arrays out. Nothing here
// touches the store or persists anything — every widget in the Analysis
// tab computes what it needs on render from the same `trades` array the
// Table view already uses.
//
// Shared vocabulary (see the master prompt's terminology table):
//   - "resolved" = status is 'Target Hit' or 'SL Hit' (i.e. not 'Pending')
//   - "win" = status is 'Target Hit'
//   - "score" = trade.validationScore.checked / trade.validationScore.total
//     (stored on the trade at add/edit time; null when there were no
//     active validation rules yet, so every score-based stat has to
//     tolerate holes)

const isResolved = (t) => t.status === 'Target Hit' || t.status === 'SL Hit'
const isWin = (t) => t.status === 'Target Hit'
const isLoss = (t) => t.status === 'SL Hit'
const isPending = (t) => !t.status || t.status === 'Pending'

const scorePct = (t) => {
  const s = t.validationScore
  if (!s || !s.total) return null
  return (s.checked / s.total) * 100
}

const stockLabel = (t) => t.instrumentName || t.pair || 'Unknown'

const dayMs = 24 * 60 * 60 * 1000

const parseDate = (t) => {
  // trade.date is a plain 'YYYY-MM-DD' string from the DatePicker; fall
  // back to createdAt for older/partial rows so nothing throws.
  if (t.date) {
    const d = new Date(`${t.date}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(t.createdAt || Date.now())
}

// Whole calendar days between two Dates (ignores time-of-day).
const dayDiff = (from, to = new Date()) => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / dayMs)
}

const winRatePct = (won, lost) => {
  const resolved = won + lost
  return resolved === 0 ? null : (won / resolved) * 100
}

const rankBy = (map, limit) =>
  [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count).slice(0, limit)

// ---------------------------------------------------------------------
// Step 3 — KPI strip + Top Stocks / Timeframe Usage
// ---------------------------------------------------------------------

export function getKpis(trades) {
  const total = trades.length
  const pending = trades.filter(isPending).length
  const targetHit = trades.filter(isWin).length
  const slHit = trades.filter(isLoss).length
  return { total, pending, targetHit, slHit, winRatePct: winRatePct(targetHit, slHit) }
}

export function getTopStocks(trades, limit = 6) {
  const map = new Map()
  trades.forEach((t) => {
    const key = stockLabel(t)
    map.set(key, { count: (map.get(key)?.count || 0) + 1 })
  })
  return rankBy(map, limit)
}

export function getTimeframeUsage(trades) {
  const map = new Map()
  trades.forEach((t) => {
    const key = t.timeframe || '—'
    map.set(key, { count: (map.get(key)?.count || 0) + 1 })
  })
  return rankBy(map, 12)
}

// ---------------------------------------------------------------------
// Step 4 — Monthly Activity, Activity Heatmap, Direction & Status
// ---------------------------------------------------------------------

export function getMonthlyActivity(trades, months = 6) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' }), count: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  trades.forEach((t) => {
    const d = parseDate(t)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (byKey.has(key)) byKey.get(key).count += 1
  })
  return buckets
}

// Returns a Mon-first 7-row grid of the last `weeks` weeks, each cell
// { date: Date, count } — ready to render as a GitHub-style heatmap.
export function getActivityHeatmap(trades, weeks = 13) {
  const counts = new Map()
  trades.forEach((t) => {
    const d = parseDate(t)
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDow = (today.getDay() + 6) % 7 // Mon=0..Sun=6
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - todayDow)) // end of this week (Sunday)
  const totalDays = weeks * 7
  const start = new Date(end)
  start.setDate(start.getDate() - totalDays + 1)

  const columns = []
  let max = 0
  for (let w = 0; w < weeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + w * 7 + d)
      const key = date.toISOString().slice(0, 10)
      const count = date > today ? null : counts.get(key) || 0
      if (count) max = Math.max(max, count)
      col.push({ date, count })
    }
    columns.push(col)
  }
  return { columns, max }
}

export function getDirectionCounts(trades) {
  const buy = trades.filter((t) => t.direction === 'Buy').length
  const sell = trades.filter((t) => t.direction === 'Sell').length
  return { buy, sell }
}

export function getStatusCounts(trades) {
  return {
    pending: trades.filter(isPending).length,
    targetHit: trades.filter(isWin).length,
    slHit: trades.filter(isLoss).length,
  }
}

// ---------------------------------------------------------------------
// Step 5 — Win Rate widgets + Setup Strength leaderboard
// ---------------------------------------------------------------------

export function getWinRateByDirection(trades) {
  const build = (dir) => {
    const rows = trades.filter((t) => t.direction === dir)
    const won = rows.filter(isWin).length
    const lost = rows.filter(isLoss).length
    return { won, lost, winRatePct: winRatePct(won, lost) }
  }
  return { Buy: build('Buy'), Sell: build('Sell') }
}

export function getWinRateByTimeframe(trades) {
  const map = new Map()
  trades.forEach((t) => {
    const key = t.timeframe || '—'
    if (!map.has(key)) map.set(key, { won: 0, lost: 0, total: 0 })
    const row = map.get(key)
    row.total += 1
    if (isWin(t)) row.won += 1
    if (isLoss(t)) row.lost += 1
  })
  return [...map.entries()]
    .map(([tf, r]) => ({ tf, ...r, winRatePct: winRatePct(r.won, r.lost) }))
    .sort((a, b) => b.total - a.total)
}

export function getSetupStrength(trades, limit = 6) {
  const map = new Map()
  trades.forEach((t) => {
    const pct = scorePct(t)
    if (pct === null) return
    const key = stockLabel(t)
    if (!map.has(key)) map.set(key, { sum: 0, n: 0 })
    const row = map.get(key)
    row.sum += pct
    row.n += 1
  })
  return [...map.entries()]
    .map(([name, r]) => ({ name, avgScorePct: r.sum / r.n }))
    .sort((a, b) => b.avgScorePct - a.avgScorePct)
    .slice(0, limit)
}

// ---------------------------------------------------------------------
// Step 6 — Quick Stats row
// ---------------------------------------------------------------------

export function getQuickStats(trades) {
  const scored = trades.map(scorePct).filter((v) => v !== null)
  const avgScorePct = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null

  const topStock = getTopStocks(trades, 1)[0] || null

  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const todayCount = trades.filter((t) => parseDate(t).toISOString().slice(0, 10) === todayKey).length

  const startOfWeek = new Date(now)
  const dow = (now.getDay() + 6) % 7
  startOfWeek.setDate(now.getDate() - dow)
  startOfWeek.setHours(0, 0, 0, 0)
  const weekCount = trades.filter((t) => parseDate(t) >= startOfWeek).length

  const pendingRows = trades.filter(isPending)
  let oldestPending = null
  pendingRows.forEach((t) => {
    const days = dayDiff(parseDate(t))
    if (!oldestPending || days > oldestPending.days) oldestPending = { name: stockLabel(t), days }
  })

  return {
    avgScorePct,
    mostActive: topStock,
    todayCount,
    weekCount,
    oldestPending,
  }
}

// ---------------------------------------------------------------------
// Step 7 — Weekly Day Pattern, Trade Age spread, Validation Score
// Distribution
// ---------------------------------------------------------------------

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function getWeeklyDayPattern(trades) {
  const counts = new Array(7).fill(0)
  trades.forEach((t) => {
    const d = parseDate(t)
    counts[(d.getDay() + 6) % 7] += 1
  })
  return DOW_LABELS.map((label, i) => ({ label, count: counts[i] }))
}

export function getTradeAgeBuckets(trades) {
  const pendingRows = trades.filter(isPending)
  const buckets = { fresh: 0, mid: 0, old: 0 }
  pendingRows.forEach((t) => {
    const days = dayDiff(parseDate(t))
    if (days <= 7) buckets.fresh += 1
    else if (days <= 30) buckets.mid += 1
    else buckets.old += 1
  })
  return { ...buckets, total: pendingRows.length }
}

export function getValidationScoreDistribution(trades) {
  const buckets = { low: 0, mid: 0, high: 0 }
  trades.forEach((t) => {
    const pct = scorePct(t)
    if (pct === null) return
    if (pct < 30) buckets.low += 1
    else if (pct < 60) buckets.mid += 1
    else buckets.high += 1
  })
  return buckets
}

// ---------------------------------------------------------------------
// Step 8 — Buy vs Sell Trend + Timeframe Breakdown
// ---------------------------------------------------------------------

export function getDirectionTrend(trades, months = 6) {
  const base = getMonthlyActivity(trades, months).map((b) => ({ ...b, buy: 0, sell: 0 }))
  const byKey = new Map(base.map((b) => [b.key, b]))
  trades.forEach((t) => {
    const d = parseDate(t)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = byKey.get(key)
    if (!row) return
    if (t.direction === 'Buy') row.buy += 1
    else if (t.direction === 'Sell') row.sell += 1
  })
  return base
}

export function getTimeframeBreakdown(trades) {
  return getTimeframeUsage(trades)
}

// ---------------------------------------------------------------------
// Step 9 — Leaderboards
// ---------------------------------------------------------------------

export function getTopScoringTrades(trades, limit = 5) {
  return trades
    .map((t) => ({ name: stockLabel(t), pct: scorePct(t), tf: t.timeframe, id: t.id }))
    .filter((r) => r.pct !== null)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
}

export function getBestTfWinRate(trades, limit = 3) {
  return getWinRateByTimeframe(trades)
    .filter((r) => r.winRatePct !== null)
    .sort((a, b) => b.winRatePct - a.winRatePct)
    .slice(0, limit)
}

export function getStockWinRate(trades, limit = 6) {
  const map = new Map()
  trades.forEach((t) => {
    const key = stockLabel(t)
    if (!map.has(key)) map.set(key, { won: 0, lost: 0, total: 0 })
    const row = map.get(key)
    row.total += 1
    if (isWin(t)) row.won += 1
    if (isLoss(t)) row.lost += 1
  })
  return [...map.entries()]
    .map(([name, r]) => ({ name, ...r, winRatePct: winRatePct(r.won, r.lost) }))
    .sort((a, b) => (b.winRatePct ?? -1) - (a.winRatePct ?? -1))
    .slice(0, limit)
}

// ---------------------------------------------------------------------
// Step 10 — Activity Calendar
// ---------------------------------------------------------------------

// Builds `monthsCount` consecutive calendar months ending on the current
// month, each as a standard 6-row (S..S) grid with per-day markers.
export function getCalendarMonths(trades, monthsCount = 4) {
  const byDay = new Map()
  trades.forEach((t) => {
    const key = parseDate(t).toISOString().slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, { added: 0, targetHit: 0, slHit: 0, pending: 0 })
    const row = byDay.get(key)
    row.added += 1
    if (isWin(t)) row.targetHit += 1
    else if (isLoss(t)) row.slHit += 1
    else row.pending += 1
  })

  const now = new Date()
  const months = []
  for (let i = monthsCount - 1; i >= 0; i--) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = first.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const leadBlanks = first.getDay() // Sun-first grid, matches reference screenshots
    const cells = []
    for (let b = 0; b < leadBlanks; b++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d)
      const key = date.toISOString().slice(0, 10)
      cells.push({ date, day: d, ...(byDay.get(key) || { added: 0, targetHit: 0, slHit: 0, pending: 0 }) })
    }
    months.push({ label, cells })
  }
  return months
}

// ---------------------------------------------------------------------
// Step 11 — Pro Analytics: Market Bias, Health, Streak
// ---------------------------------------------------------------------

export function getMarketBias(trades) {
  const { buy, sell } = getDirectionCounts(trades)
  const total = buy + sell
  const buyPct = total ? (buy / total) * 100 : 0
  const sellPct = total ? (sell / total) * 100 : 0
  // -100 (all sell) .. +100 (all buy), 0 = balanced/no data.
  const biasPct = total ? buyPct - sellPct : 0
  return { buy, sell, total, buyPct, sellPct, biasPct }
}

export function getHealthScore(trades) {
  const { targetHit, slHit } = getKpis(trades)
  const wr = winRatePct(targetHit, slHit)
  const winRateScore = wr === null ? 0 : wr

  const scored = trades.map(scorePct).filter((v) => v !== null)
  const avgScorePct = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0

  const uniqueStocks = new Set(trades.map(stockLabel)).size
  const diversityPct = trades.length ? Math.min(100, (uniqueStocks / Math.min(trades.length, 8)) * 100) : 0

  const score = Math.round(winRateScore * 0.5 + avgScorePct * 0.35 + diversityPct * 0.15)
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'

  return { score, grade, winRatePct: wr, avgScorePct, diversityPct }
}

export function getStreak(trades) {
  // Most-recent-first among resolved trades; count consecutive wins from
  // the most recent resolved trade backwards.
  const resolved = trades
    .filter(isResolved)
    .slice()
    .sort((a, b) => parseDate(b) - parseDate(a) || (b.updatedAt || 0) - (a.updatedAt || 0))
  let streak = 0
  for (const t of resolved) {
    if (isWin(t)) streak += 1
    else break
  }
  return { streak, hasResolved: resolved.length > 0 }
}

// ---------------------------------------------------------------------
// Step 12 — Confidence + Risk/Reward
// ---------------------------------------------------------------------

export function getConfidence(trades) {
  const { targetHit, slHit, total } = getKpis(trades)
  const resolvedCount = targetHit + slHit
  const wr = winRatePct(targetHit, slHit)
  const scored = trades.map(scorePct).filter((v) => v !== null)
  const avgScorePct = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null
  const strengthPct = wr === null || avgScorePct === null ? null : (wr + avgScorePct) / 2
  return { strengthPct, winRatePct: wr, avgScorePct, resolvedCount, totalCount: total }
}

// Avg R:R needs a stored target/stop price this app's trade form doesn't
// capture yet (see the master prompt's Open Questions) — always returns
// null for now so the widget can show a clean "—" instead of guessing.
export function getRiskReward(trades) {
  const total = trades.length
  const { targetHit, slHit, pending } = getKpis(trades)
  return {
    winsPct: total ? (targetHit / total) * 100 : 0,
    lossesPct: total ? (slHit / total) * 100 : 0,
    pendingPct: total ? (pending / total) * 100 : 0,
    avgRR: null,
  }
}

// ---------------------------------------------------------------------
// Step 13 — Trade Funnel, Trade Age list, TF x Direction Matrix
// ---------------------------------------------------------------------

export function getTradeFunnel(trades) {
  const total = trades.length
  const { targetHit, slHit } = getKpis(trades)
  const resolved = targetHit + slHit
  return {
    total,
    resolved,
    resolvedPct: total ? (resolved / total) * 100 : 0,
    targetHit,
    targetHitPct: total ? (targetHit / total) * 100 : 0,
    winRatePct: winRatePct(targetHit, slHit),
    lossRatePct: resolved ? (slHit / resolved) * 100 : null,
    pendingCount: total - resolved,
  }
}

export function getTradeAgeList(trades, limit = 5) {
  const pendingRows = trades.filter(isPending).map((t) => ({
    id: t.id,
    name: stockLabel(t),
    timeframe: t.timeframe,
    days: dayDiff(parseDate(t)),
  }))
  const total = pendingRows.length
  const fresh = pendingRows.filter((r) => r.days <= 7).length
  const old = pendingRows.filter((r) => r.days > 30).length
  const avgDays = total ? Math.round(pendingRows.reduce((a, r) => a + r.days, 0) / total) : 0
  const oldestList = pendingRows.slice().sort((a, b) => b.days - a.days).slice(0, limit)
  return { fresh, avgDays, old, oldestList }
}

export function getTfDirectionMatrix(trades) {
  const map = new Map()
  trades.forEach((t) => {
    const tf = t.timeframe || '—'
    if (!map.has(tf)) {
      map.set(tf, {
        Buy: { count: 0, won: 0, lost: 0 },
        Sell: { count: 0, won: 0, lost: 0 },
      })
    }
    const row = map.get(tf)
    const cell = row[t.direction === 'Sell' ? 'Sell' : 'Buy']
    cell.count += 1
    if (isWin(t)) cell.won += 1
    if (isLoss(t)) cell.lost += 1
  })
  return [...map.entries()].map(([tf, row]) => ({
    tf,
    buy: { ...row.Buy, winRatePct: winRatePct(row.Buy.won, row.Buy.lost) },
    sell: { ...row.Sell, winRatePct: winRatePct(row.Sell.won, row.Sell.lost) },
    total: row.Buy.count + row.Sell.count,
  }))
}

// ---------------------------------------------------------------------
// Step 14 — Alerts
// ---------------------------------------------------------------------

export function getAlerts(trades) {
  const alerts = []
  const stale = trades.filter((t) => isPending(t) && dayDiff(parseDate(t)) > 14)
  if (stale.length) {
    const names = [...new Set(stale.map(stockLabel))].slice(0, 4).join(', ')
    alerts.push({
      id: 'stale',
      title: `${stale.length} Stale Pending Trade${stale.length > 1 ? 's' : ''} (>14d)`,
      detail: `${names} — still open, worth a re-check.`,
      tone: 'warn',
    })
  }
  const unscored = trades.filter((t) => scorePct(t) === null)
  if (unscored.length) {
    alerts.push({
      id: 'unscored',
      title: `${unscored.length} Trade${unscored.length > 1 ? 's' : ''} Without a Validation Score`,
      detail: 'Add or check validation rules so these count toward Setup Strength.',
      tone: 'info',
    })
  }
  return alerts
}

// ---------------------------------------------------------------------
// Step 15 — Stock Intensity Heatmap
// ---------------------------------------------------------------------

export function getStockIntensity(trades, stockLimit = 8) {
  const stocks = getTopStocks(trades, stockLimit).map((s) => s.name)
  const timeframes = [...new Set(trades.map((t) => t.timeframe || '—'))]

  const cellFor = (stock, tf) => {
    const rows = trades.filter((t) => stockLabel(t) === stock && (t.timeframe || '—') === tf)
    const won = rows.filter(isWin).length
    const lost = rows.filter(isLoss).length
    return { count: rows.length, winRatePct: winRatePct(won, lost) }
  }

  const cells = stocks.map((stock) => ({
    stock,
    row: timeframes.map((tf) => ({ tf, ...cellFor(stock, tf) })),
  }))

  return { stocks, timeframes, cells }
}
