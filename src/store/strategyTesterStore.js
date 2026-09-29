import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { SELECT_COLORS, migrateStrategies } from '../utils/strategyTesterFields'

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
  { id: uid(), type: 'outcome', label: 'Result' },
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
  // Whether the "+ Strategy" column at the right edge of the table is shown.
  showAddStrategy: true,
  // Weekdays shown as rows (JS getDay(): 0 = Sun … 6 = Sat). All by default.
  visibleWeekdays: [0, 1, 2, 3, 4, 5, 6],
  // Custom column widths (px). Date column here; field columns keep theirs on the field (`field.width`).
  dateColWidth: 72,
  year: today.getFullYear(),
  month: today.getMonth(), // 0-11
  strategies: [makeStrategy('Strategy Tester', true), makeStrategy('Strategy :- 1')],
  // Which strategy the Analysis view is currently showing. null = first
  // strategy in the list (resolved by the component, not stored, so a
  // deleted strategy never leaves this pointing at a dead id).
  analysisStrategyId: null,
  // entries[strategyId][dateKey][fieldId] = value
  entries: {},
  // 'idle' | 'saving' | 'saved' | 'error' — surfaced by the cloud-sync
  // pill in TopToolbar/StrategyTester the same way tradeAnalysisStore's
  // cloudStatus is, not persisted (see partialize below).
  cloudStatus: 'idle',
}

export const useStrategyTesterStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setActiveView: (activeView) => set({ activeView }),
      setTheme: (theme) => set({ theme }),
      setDateColWidth: (dateColWidth) => set({ dateColWidth }),
      setFieldWidth: (strategyId, fieldId, width) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id !== strategyId
              ? st
              : { ...st, fields: st.fields.map((f) => (f.id === fieldId ? { ...f, width } : f)) }
          ),
        })),
      setVisibleWeekdays: (days) => set({ visibleWeekdays: days.length ? days : [0, 1, 2, 3, 4, 5, 6] }),
      // At least one weekday always stays visible so the table is never empty.
      toggleWeekday: (idx) =>
        set((s) => {
          const has = s.visibleWeekdays.includes(idx)
          if (has && s.visibleWeekdays.length === 1) return {}
          return { visibleWeekdays: has ? s.visibleWeekdays.filter((d) => d !== idx) : [...s.visibleWeekdays, idx] }
        }),
      toggleAddStrategyPanel: () => set((s) => ({ showAddStrategy: !s.showAddStrategy })),
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
            st.id === strategyId
              ? { ...st, fields: [...st.fields, { id: uid(), type, label, ...(type === 'select' || type === 'multiselect' || type === 'checkbox' ? { options: [] } : {}) }] }
              : st
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
      // Move a column within one strategy (drag & drop in the table header).
      reorderFields: (strategyId, from, to) =>
        set((s) => ({
          strategies: s.strategies.map((st) => {
            if (st.id !== strategyId || from === to) return st
            if (from < 0 || to < 0 || from >= st.fields.length || to >= st.fields.length) return st
            const fields = [...st.fields]
            const [moved] = fields.splice(from, 1)
            fields.splice(to, 0, moved)
            return { ...st, fields }
          }),
        })),
      renameField: (strategyId, fieldId, label) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id === strategyId
              ? { ...st, fields: st.fields.map((f) => (f.id === fieldId ? { ...f, label } : f)) }
              : st
          ),
        })),

      // Select-field options: [{ id, label, color }] stored on the field itself;
      // cells only keep the chosen option's id.
      addFieldOption: (strategyId, fieldId, label, color) => {
        const id = uid()
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id !== strategyId
              ? st
              : {
                  ...st,
                  fields: st.fields.map((f) => {
                    if (f.id !== fieldId) return f
                    const opts = f.options || []
                    return { ...f, options: [...opts, { id, label, color: color || SELECT_COLORS[(opts.length + 1) % SELECT_COLORS.length] }] }
                  }),
                }
          ),
        }))
        return id
      },
      // Box colour of a plain (single) checkbox column.
      setFieldColor: (strategyId, fieldId, color) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id !== strategyId
              ? st
              : { ...st, fields: st.fields.map((f) => (f.id === fieldId ? { ...f, color } : f)) }
          ),
        })),
      updateFieldOption: (strategyId, fieldId, optionId, patch) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id !== strategyId
              ? st
              : {
                  ...st,
                  fields: st.fields.map((f) =>
                    f.id !== fieldId ? f : { ...f, options: (f.options || []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
                  ),
                }
          ),
        })),
      removeFieldOption: (strategyId, fieldId, optionId) =>
        set((s) => ({
          strategies: s.strategies.map((st) =>
            st.id !== strategyId
              ? st
              : {
                  ...st,
                  fields: st.fields.map((f) =>
                    f.id !== fieldId ? f : { ...f, options: (f.options || []).filter((o) => o.id !== optionId) }
                  ),
                }
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

      // Cross-device sync — same one-row-per-user pattern as
      // tradeAnalysisStore's loadFromCloud/saveToCloud, in its own
      // `strategy_tester` table (see SUPABASE_SETUP.md § 3e). Images
      // themselves are already cloud-hosted URLs (Cloudinary/Supabase
      // Storage, see imageUpload.js) — this is what carries the
      // strategies/entries that *point* at those URLs to another
      // device, so opening the app signed in elsewhere shows the same
      // grid, screenshots included. Works fine locally-only (localStorage)
      // when Supabase isn't configured or nobody's signed in.
      loadFromCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        const { data, error } = await supabase
          .from('strategy_tester')
          .select('strategies, entries')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return

        const cloudStrategies = data?.strategies || []
        const cloudEntries = data?.entries || {}
        const { strategies: localStrategies, entries: localEntries } = get()
        const cloudIsEmpty = cloudStrategies.length === 0
        const localHasData = localStrategies.length > 0 && Object.keys(localEntries).length > 0

        // First sync (or the cloud row doesn't exist yet): don't let an
        // empty cloud row stomp real local data — push local up instead.
        if (cloudIsEmpty && localHasData) {
          get().saveToCloud(userId)
          return
        }
        if (cloudIsEmpty) return

        set({ strategies: migrateStrategies(cloudStrategies), entries: cloudEntries })
      },
      saveToCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        set({ cloudStatus: 'saving' })
        const { strategies, entries } = get()
        const { error } = await supabase.from('strategy_tester').upsert({
          user_id: userId,
          strategies,
          entries,
          updated_at: new Date().toISOString(),
        })
        set({ cloudStatus: error ? 'error' : 'saved' })
      },
    }),
    {
      name: 'mindmap-strategy-tester-storage',
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted || {}) }
        merged.strategies = migrateStrategies(merged.strategies)
        return merged
      },
      partialize: (state) => ({
        isOpen: state.isOpen,
        theme: state.theme,
        activeView: state.activeView,
        showAddStrategy: state.showAddStrategy,
        visibleWeekdays: state.visibleWeekdays,
        dateColWidth: state.dateColWidth,
        year: state.year,
        month: state.month,
        strategies: state.strategies,
        analysisStrategyId: state.analysisStrategyId,
        entries: state.entries,
      }),
    }
  )
)
