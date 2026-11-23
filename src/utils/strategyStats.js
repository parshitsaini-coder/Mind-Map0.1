import { RRR_OPTIONS, daysInMonth, dateKey, isValueFilled } from './strategyTesterFields'

// Reduces one strategy's entries for the selected month into everything
// the cards below need. Pure function of (strategy, entries slice, days)
// so it's cheap to recompute on every keystroke in the grid.
export function computeStats(strategy, strategyEntries, year, month) {
  const numDays = daysInMonth(year, month)
  const outcomeFields = strategy.fields.filter((f) => f.type === 'outcome')
  const pnlFields = strategy.fields.filter((f) => f.type === 'pnl')
  const rrrFields = strategy.fields.filter((f) => f.type === 'rrr')
  const buysellFields = strategy.fields.filter((f) => f.type === 'buysell')

  let filledDays = 0
  let wins = 0
  let losses = 0
  let breakevens = 0
  let pnlTotal = 0
  let pnlCount = 0
  let buys = 0
  let sells = 0
  const rrrCounts = Object.fromEntries(RRR_OPTIONS.map((r) => [r, 0]))

  for (let day = 1; day <= numDays; day++) {
    const base = dateKey(year, month, day)
    // The day's main row plus any extra entries ('YYYY-MM-DD#id') added from the table.
    const keys = [base, ...Object.keys(strategyEntries || {}).filter((k) => k.startsWith(`${base}#`))]
    let dayHasValue = false
    for (const dk of keys) {
    const row = strategyEntries?.[dk]
    if (!row) continue

    if (strategy.fields.some((f) => isValueFilled(f.type, row[f.id]))) dayHasValue = true

    outcomeFields.forEach((f) => {
      const v = row[f.id]
      if (v === 'win') wins++
      else if (v === 'loss') losses++
      else if (v === 'be') breakevens++
    })
    pnlFields.forEach((f) => {
      const raw = row[f.id]
      const n = raw === '' || raw == null ? null : parseFloat(raw)
      if (n != null && !Number.isNaN(n)) {
        pnlTotal += n
        pnlCount++
      }
    })
    rrrFields.forEach((f) => {
      const v = row[f.id]
      if (v && rrrCounts[v] != null) rrrCounts[v]++
    })
    buysellFields.forEach((f) => {
      const v = row[f.id]
      if (v === 'buy') buys++
      else if (v === 'sell') sells++
    })
    }
    if (dayHasValue) filledDays++
  }

  const decided = wins + losses
  const winRatePct = decided > 0 ? (wins / decided) * 100 : null
  const rrrTotal = Object.values(rrrCounts).reduce((a, b) => a + b, 0)

  return {
    numDays,
    filledDays,
    progressPct: numDays > 0 ? (filledDays / numDays) * 100 : 0,
    hasOutcome: outcomeFields.length > 0,
    wins,
    losses,
    breakevens,
    winRatePct,
    hasPnl: pnlFields.length > 0,
    pnlTotal,
    pnlCount,
    pnlAvg: pnlCount > 0 ? pnlTotal / pnlCount : null,
    hasRrr: rrrFields.length > 0,
    rrrCounts,
    rrrTotal,
    hasBuysell: buysellFields.length > 0,
    buys,
    sells,
  }
}

