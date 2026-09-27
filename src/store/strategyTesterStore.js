import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Section — Strategy Tester. A separate full-screen feature (own overlay,
// own top bar), inspired by a classic backtest "strategy tester" grid:
// one row per calendar day of a chosen month, one column-group per
// strategy being tested, and inside each group whatever fields that
// strategy needs (image, checkbox, notes, number, buy/sell, SL/target,
// win rate outcome, RRR, P&L) — picked per-strategy from the + menu on
// its header. Deliberately isolated from mapStore/tradeAnalysisStore;
// it borrows the same --ta-* themed look (see tradeAnalysisThemes.js)
// but keeps its own data model since "one row per day, many strategies
// side by side" doesn't fit the trade-log shape at all.

const uid = () => crypto.randomUUID()

const seedFields = () => [
  { id: uid(), type: 'buysell', label: 'Buy/Sell' },
  { id: uid(), type: 'outcome', label: 'Win Rate' },
  { id: uid(), type: 'rrr', label: 'RRR' },
  { id: uid(), type: 'pnl', label: 'P&L' },
]

const makeStrategy = (name, withSeedFields = false) => ({
  id: uid(),
  name,
  fields: withSeedFields ? seedFields() : [],
  hidden: false,
})

const today = new Date()

const initialState = {
  isOpen: false,
  theme: 'classic',
  activeView: 'table', // 'table' | 'analysis'
  year: today.getFullYear(),
  month: today.getMonth(), // 0-11
  strategies: [makeStrategy('Strategy Tester', true), makeStrategy('Strategy :- 1')],
  // Which strategy the Analysis view is currently showing. null = first
  // strategy in the list (resolved by the component, not stored, so a
  // deleted strategy never leaves this pointing at a dead id).
  analysisStrategyId: null,
  // entries[strategyId][dateKey][fieldId] = value
  entries: {},
}

export const useStrategyTesterStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveView: (activeView) => set({ activeView }),
      setTheme: (theme) => set({ theme }),
      setAnalysisStrategyId: (analysisStrategyId) => set({ analysisStrategyId }),

      goToMonth: (delta) =>
        set((s) => {
          let m = s.month + delta
          let y = s.year
          if (m < 0) {
            m = 11
            y -= 1
          } else if (m > 11) {
            m = 0
            y += 1
          }
          return { month: m, year: y }
        }),
      goToToday: () => set({ year: today.getFullYear(), month: today.getMonth() }),

      addStrategy: () =>
        set((s) => {
          const next = makeStrategy(`Strategy :- ${s.strategies.length}`)
          return { strategies: [...s.strategies, next] }
        }),
      renameStrategy: (strategyId, name) =>
        set((s) => ({
          strategies: s.strategies.map((st) => (st.id === strategyId ? { ...st, name } : st)),
        })),
      toggleStrategyHidden: (strategyId) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id === strategyId ? { ...st, hidden: !st.hidden } : st
          ),
        })),
      removeStrategy: (strategyId) =>
        set((s) => {
          if (s.strategies.length <= 1) return {}
          const entries = { ...s.entries }
          delete entries[strategyId]
          return {
            strategies: s.strategies.filter((st) => st.id !== strategyId),
            entries,
            analysisStrategyId: s.analysisStrategyId === strategyId ? null : s.analysisStrategyId,
          }
        }),

      addField: (strategyId, type, label) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id === strategyId ? { ...st, fields: [...st.fields, { id: uid(), type, label }] } : st
          ),
        })),
      removeField: (strategyId, fieldId) =>
        set((s) => {
          const strategyEntries = s.entries[strategyId]
          let entries = s.entries
          if (strategyEntries) {
            const nextByDate = {}
            for (const [dk, vals] of Object.entries(strategyEntries)) {
              const rest = { ...vals }
              delete rest[fieldId]
              nextByDate[dk] = rest
            }
            entries = { ...s.entries, [strategyId]: nextByDate }
          }
          return {
            strategies: s.strategies.map((st) =>
              st.id === strategyId ? { ...st, fields: st.fields.filter((f) => f.id !== fieldId) } : st
            ),
            entries,
          }
        }),
      renameField: (strategyId, fieldId, label) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id === strategyId
              ? { ...st, fields: st.fields.map((f) => (f.id === fieldId ? { ...f, label } : f)) }
              : st
          ),
        })),

      setCellValue: (strategyId, dk, fieldId, value) =>
        set((s) => {
          const strategyEntries = { ...(s.entries[strategyId] || {}) }
          strategyEntries[dk] = { ...(strategyEntries[dk] || {}), [fieldId]: value }
          return { entries: { ...s.entries, [strategyId]: strategyEntries } }
        }),

      // Read-only helper — not itself reactive, callers should select
      // `entries` directly if they need re-renders on change.
      getCellValue: (strategyId, dk, fieldId) => get().entries?.[strategyId]?.[dk]?.[fieldId],
    }),
    {
      name: 'mindmap-strategy-tester-storage',
    }
  )
)
