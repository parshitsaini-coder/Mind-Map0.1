import { RRR_OPTIONS, isValueFilled } from './strategyTesterFields'

// Everything the Analysis "Compare" section and the Calendar need to count
// options (Buy/Sell, SL/Target, Select / Multi-select tags, Result, RRR …).
// One "entry" = one row of a strategy: the day's main row ('YYYY-MM-DD') or an
// extra row ('YYYY-MM-DD#id') added from the Table view.

// All rows of one strategy that fall on a given day, main row first.
export function rowsForDay(strategyEntries, dk) {
  if (!strategyEntries) return []
  const out = []
  if (strategyEntries[dk]) out.push({ rk: dk, row: strategyEntries[dk] })
  const prefix = `${dk}#`
  for (const k of Object.keys(strategyEntries)) if (k.startsWith(prefix)) out.push({ rk: k, row: strategyEntries[k] })
  return out
}

// All rows of one strategy inside a month ('YYYY-MM').
export function rowsForMonth(strategyEntries, year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}-`
  return Object.entries(strategyEntries || {})
    .filter(([k]) => k.startsWith(ym))
    .map(([rk, row]) => ({ rk, day: Number(rk.slice(ym.length, ym.length + 2)), row }))
}

export const rowHasValue = (strategy, row) => !!row && strategy.fields.some((f) => isValueFilled(f.type, row[f.id]))

const slTargetKey = (v) => {
  if (v === 'sl' || v === 'target') return v
  if (v && typeof v === 'object') {
    if ((v.sl ?? '') !== '') return 'sl'
    if ((v.target ?? '') !== '') return 'target'
  }
  return null
}

// Countable fields of a strategy and their options.
export function categoriesOf(strategy) {
  const out = []
  for (const f of strategy.fields) {
    let options = null
    if (f.type === 'select' || f.type === 'multiselect' || (f.type === 'checkbox' && (f.options || []).length > 0)) {
      options = (f.options || []).map((o) => ({ key: o.id, label: o.label || 'Untitled', color: o.color }))
    } else if (f.type === 'checkbox') options = [{ key: 'yes', label: 'Yes', color: '#16a34a' }]
    else if (f.type === 'buysell') options = [{ key: 'buy', label: 'Buy', color: '#16a34a' }, { key: 'sell', label: 'Sell', color: '#dc2626' }]
    else if (f.type === 'sltarget') options = [{ key: 'sl', label: 'SL', color: '#dc2626' }, { key: 'target', label: 'Target', color: '#16a34a' }]
    else if (f.type === 'outcome')
      options = [{ key: 'win', label: 'Win', color: '#16a34a' }, { key: 'loss', label: 'Loss', color: '#dc2626' }, { key: 'be', label: 'Breakeven', color: '#64748b' }]
    else if (f.type === 'rrr') options = RRR_OPTIONS.map((r) => ({ key: r, label: r }))
    if (options && options.length) out.push({ fieldId: f.id, label: f.label, type: f.type, options })
  }
  return out
}

// Does this row carry option `key` of field `cat`?
export function rowHasOption(row, cat, key) {
  const v = row?.[cat.fieldId]
  if (v == null) return false
  switch (cat.type) {
    case 'multiselect':
      return Array.isArray(v) && v.includes(key)
    case 'checkbox':
      if (Array.isArray(v)) return v.includes(key)
      return key === 'yes' && v === true
    case 'sltarget':
      return slTargetKey(v) === key
    default:
      return v === key
  }
}

// Per-option counts for the month: how many entries carry it, and (when the
// strategy has a Result field) how many of those were wins / losses.
export function computeBreakdown(strategy, strategyEntries, year, month) {
  const rows = rowsForMonth(strategyEntries, year, month).filter((r) => rowHasValue(strategy, r.row))
  const cats = categoriesOf(strategy)
  const outcome = cats.find((c) => c.type === 'outcome')
  const total = rows.length
  const categories = cats.map((cat) => ({
    ...cat,
    options: cat.options.map((opt) => {
      let count = 0
      let wins = 0
      let losses = 0
      for (const { row } of rows) {
        if (!rowHasOption(row, cat, opt.key)) continue
        count++
        if (outcome) {
          const r = row[outcome.fieldId]
          if (r === 'win') wins++
          else if (r === 'loss') losses++
        }
      }
      return { ...opt, fieldId: cat.fieldId, fieldLabel: cat.label, count, wins, losses }
    }),
  }))
  return { total, categories, hasOutcome: !!outcome }
}

// Per-day totals for the calendar: how many entries, how many carried SL /
// Target / Buy / Sell, and wins / losses (an entry counts once per day-row).
export function dayTotals(strategy, strategyEntries, dk) {
  const cats = categoriesOf(strategy)
  const slCat = cats.find((c) => c.type === 'sltarget')
  const bsCat = cats.find((c) => c.type === 'buysell')
  const ocCat = cats.find((c) => c.type === 'outcome')
  const rows = rowsForDay(strategyEntries, dk).filter((r) => rowHasValue(strategy, r.row))
  const t = { entries: rows.length, sl: 0, target: 0, buy: 0, sell: 0, wins: 0, losses: 0, be: 0, rows }
  for (const { row } of rows) {
    if (slCat) {
      if (rowHasOption(row, slCat, 'sl')) t.sl++
      if (rowHasOption(row, slCat, 'target')) t.target++
    }
    if (bsCat) {
      if (rowHasOption(row, bsCat, 'buy')) t.buy++
      if (rowHasOption(row, bsCat, 'sell')) t.sell++
    }
    if (ocCat) {
      if (row[ocCat.fieldId] === 'win') t.wins++
      else if (row[ocCat.fieldId] === 'loss') t.losses++
      else if (row[ocCat.fieldId] === 'be') t.be++
    }
  }
  t.hasSl = !!slCat
  return t
}
