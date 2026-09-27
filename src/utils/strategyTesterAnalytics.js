// Strategy Tester — turns one month's grid data into per-strategy stats
// for the Analysis view. Pure/defensive: missing data just gets skipped
// rather than producing NaN.
import { isFieldFilled, rrrToNumber, RRR_OPTIONS, FIELD_BY_ID } from './strategyTesterFields'

export function computeStrategyAnalysis(month, strategyId) {
  const rows = month?.rows || []
  let loggedDays = 0
  let pnlSum = 0
  let pnlCount = 0
  let wins = 0
  let losses = 0
  let winrateSum = 0
  let winrateCount = 0
  let bestDay = null
  let worstDay = null
  const rrrCounts = Object.fromEntries(RRR_OPTIONS.map((r) => [r, 0]))
  const rrrNumbers = []

  for (const row of rows) {
    const cell = row.cells?.[strategyId]
    if (!cell) continue
    const hasAny = row.fields.some((fieldId) => isFieldFilled(FIELD_BY_ID[fieldId]?.kind, cell[fieldId]))
    if (hasAny) loggedDays += 1

    const pnl = cell.pnl
    if (isFieldFilled('pnl', pnl)) {
      const n = Number(pnl)
      pnlSum += n
      pnlCount += 1
      if (n > 0) wins += 1
      else if (n < 0) losses += 1
      if (bestDay === null || n > bestDay.value) bestDay = { day: row.day, value: n }
      if (worstDay === null || n < worstDay.value) worstDay = { day: row.day, value: n }
    }

    const winrate = cell.winrate
    if (isFieldFilled('winrate', winrate)) {
      winrateSum += Number(winrate)
      winrateCount += 1
    }

    const rrr = cell.rrr
    if (isFieldFilled('rrr', rrr)) {
      rrrCounts[rrr] = (rrrCounts[rrr] || 0) + 1
      const n = rrrToNumber(rrr)
      if (n != null) rrrNumbers.push(n)
    }
  }

  return {
    loggedDays,
    totalDays: rows.length,
    totalPnl: pnlCount ? pnlSum : null,
    pnlCount,
    winRate: pnlCount ? Math.round((wins / pnlCount) * 100) : null,
    wins,
    losses,
    avgWinrateField: winrateCount ? Math.round(winrateSum / winrateCount) : null,
    avgRrr: rrrNumbers.length ? Math.round((rrrNumbers.reduce((a, b) => a + b, 0) / rrrNumbers.length) * 10) / 10 : null,
    rrrCounts,
    bestDay,
    worstDay,
  }
}
