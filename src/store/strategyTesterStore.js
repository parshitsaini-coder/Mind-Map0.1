import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MONTH_NAMES, monthKeyFor, parseMonthKey, daysInMonth, shiftMonthKey } from '../utils/strategyTesterFields'

function makeDefaultStrategies() {
  return Array.from({ length: 6 }, (_, i) => ({ id: crypto.randomUUID(), name: `Strategy :- ${i + 1}` }))
}

function makeMonth(key) {
  const { year, month } = parseMonthKey(key)
  const total = daysInMonth(year, month)
  return {
    key,
    year,
    month,
    label: `${MONTH_NAMES[month]} ${year}`,
    strategies: makeDefaultStrategies(),
    rows: Array.from({ length: total }, (_, i) => ({
      id: crypto.randomUUID(),
      day: i + 1,
      fields: [], // active field-type ids for this date row (applies across every strategy column)
      cells: {}, // strategyId -> { [fieldId]: value }
    })),
  }
}

function ensureMonth(months, key) {
  if (months[key]) return months
  return { ...months, [key]: makeMonth(key) }
}

export const useStrategyTesterStore = create(
  persist(
    (set) => ({
      isOpen: false,
      view: 'grid', // 'grid' | 'analysis'
      months: {}, // keyed by "YYYY-MM"
      activeMonthKey: null,
      analysisStrategyId: null, // null = "all strategies" overview

      open: () => {
        const now = new Date()
        const currentKey = monthKeyFor(now.getFullYear(), now.getMonth())
        set((s) => {
          const key = s.activeMonthKey || currentKey
          return { isOpen: true, activeMonthKey: key, months: ensureMonth(s.months, key) }
        })
      },
      close: () => set({ isOpen: false }),
      setView: (view) => set({ view }),

      goToMonth: (delta) =>
        set((s) => {
          const key = shiftMonthKey(s.activeMonthKey, delta)
          return { activeMonthKey: key, months: ensureMonth(s.months, key) }
        }),

      renameMonthLabel: (label) =>
        set((s) => {
          const key = s.activeMonthKey
          if (!key || !s.months[key]) return {}
          return { months: { ...s.months, [key]: { ...s.months[key], label } } }
        }),

      addStrategy: () =>
        set((s) => {
          const key = s.activeMonthKey
          const m = s.months[key]
          if (!m) return {}
          const n = m.strategies.length + 1
          const strategy = { id: crypto.randomUUID(), name: `Strategy :- ${n}` }
          return { months: { ...s.months, [key]: { ...m, strategies: [...m.strategies, strategy] } } }
        }),

      renameStrategy: (strategyId, name) =>
        set((s) => {
          const key = s.activeMonthKey
          const m = s.months[key]
          if (!m) return {}
          return {
            months: {
              ...s.months,
              [key]: { ...m, strategies: m.strategies.map((st) => (st.id === strategyId ? { ...st, name } : st)) },
            },
          }
        }),

      removeStrategy: (strategyId) =>
        set((s) => {
          const key = s.activeMonthKey
          const m = s.months[key]
          if (!m) return {}
          return {
            months: {
              ...s.months,
              [key]: {
                ...m,
                strategies: m.strategies.filter((st) => st.id !== strategyId),
                rows: m.rows.map((r) => {
                  if (!(strategyId in r.cells)) return r
                  const { [strategyId]: _drop, ...rest } = r.cells
                  return { ...r, cells: rest }
                }),
              },
            },
            analysisStrategyId: s.analysisStrategyId === strategyId ? null : s.analysisStrategyId,
          }
        }),

      // Toggles whether a field type is tracked on this date row. Adding it
      // makes that mini control appear under every strategy column for this
      // row; removing it hides the control (existing values are kept, so
      // re-adding the field brings old data straight back).
      toggleRowField: (rowId, fieldId) =>
        set((s) => {
          const key = s.activeMonthKey
          const m = s.months[key]
          if (!m) return {}
          return {
            months: {
              ...s.months,
              [key]: {
                ...m,
                rows: m.rows.map((r) => {
                  if (r.id !== rowId) return r
                  const has = r.fields.includes(fieldId)
                  return { ...r, fields: has ? r.fields.filter((f) => f !== fieldId) : [...r.fields, fieldId] }
                }),
              },
            },
          }
        }),

      setCellValue: (rowId, strategyId, fieldId, value) =>
        set((s) => {
          const key = s.activeMonthKey
          const m = s.months[key]
          if (!m) return {}
          return {
            months: {
              ...s.months,
              [key]: {
                ...m,
                rows: m.rows.map((r) => {
                  if (r.id !== rowId) return r
                  const cell = { ...(r.cells[strategyId] || {}), [fieldId]: value }
                  return { ...r, cells: { ...r.cells, [strategyId]: cell } }
                }),
              },
            },
          }
        }),

      setAnalysisStrategyId: (id) => set({ analysisStrategyId: id }),
    }),
    {
      name: 'mindmap-strategy-tester-storage',
      partialize: (state) => ({ months: state.months, activeMonthKey: state.activeMonthKey }),
    }
  )
)
