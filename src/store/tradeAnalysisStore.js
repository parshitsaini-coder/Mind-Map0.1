import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// Section — Trade Analysis. A separate full-screen feature (own overlay,
// own left "new trade" form, own entries table) for logging trades against
// a stock/forex/commodity instrument with a screenshot, notes, a
// user-defined checklist of "validation rules", and an outcome status.
// Deliberately isolated from mapStore/whiteboardStore — nothing here touches
// the mind map itself. See trade-analysis-master-prompt.md for the full
// build spec and step-by-step progress tracker (this file only implements
// Step 0's empty shell — later steps add the real fields/actions).

const initialState = {
  isOpen: false,
  sidebarOpen: true,

  // Selected color theme id for the whole feature — see
  // src/theme/tradeAnalysisThemes.js for the palette list. Applied as CSS
  // var overrides on the overlay root in TradeAnalysis.jsx.
  theme: 'classic',

  // Editing state — null when the left form is a blank "add new trade"
  // form; set to a trade id when Edit was clicked on a table row (Step 8).
  editingTradeId: null,

  trades: [], // { id, name, date, pair, instrumentType, timeframe, direction, price, notes, validationRuleIds, screenshotUrl, screenshotHosted, resultImageUrl, resultImageHosted, status, createdAt, updatedAt }

  validationRules: [], // { id, label, active }

  filters: {
    pair: null,
    instrumentType: null,
    timeframe: null,
    direction: null,
    status: null,
    validationRuleId: null,
    dateFrom: null,
    dateTo: null,
  },

  // Step 9 — optional cloud sync status, same 'idle'|'saving'|'saved'|
  // 'error' shape as mapStore's cloudStatus.
  cloudStatus: 'idle',
}

export const useTradeAnalysisStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false, editingTradeId: null }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),

      // Step 3 — "Add" button on the New Trade form. `trade` is the field
      // payload assembled by TradeForm.jsx; this just stamps an id/status/
      // timestamps and appends it. Editing an existing trade (Step 8) will
      // reuse this same shape via a future `updateTrade` action.
      addTrade: (trade) =>
        set((s) => ({
          trades: [
            ...s.trades,
            {
              id: crypto.randomUUID(),
              status: 'Pending',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ...trade,
            },
          ],
        })),

      // Validation-rule / filter actions and edit/delete land in Steps 5,
      // 7 & 8.

      // Step 5 — "Manage Validation Rules" popup actions.
      addValidationRule: (label) =>
        set((s) => ({
          validationRules: [...s.validationRules, { id: crypto.randomUUID(), label, active: true }],
        })),
      updateValidationRuleLabel: (id, label) =>
        set((s) => ({
          validationRules: s.validationRules.map((r) => (r.id === id ? { ...r, label } : r)),
        })),
      toggleValidationRuleActive: (id) =>
        set((s) => ({
          validationRules: s.validationRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
        })),
      deleteValidationRule: (id) =>
        set((s) => ({ validationRules: s.validationRules.filter((r) => r.id !== id) })),
      // Optional nice-to-have drag-to-reorder — implemented as simple
      // up/down moves rather than a pointer-drag lib, same net effect.
      moveValidationRule: (id, direction) =>
        set((s) => {
          const idx = s.validationRules.findIndex((r) => r.id === id)
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          if (idx === -1 || swapIdx < 0 || swapIdx >= s.validationRules.length) return {}
          const next = [...s.validationRules]
          ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
          return { validationRules: next }
        }),

      // Step 6 — right-panel entries table actions (status edit, result
      // image upload). Edit/delete row flows are Step 8.
      updateTradeStatus: (id, status) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)),
        })),
      updateTradeResultImage: (id, resultImageUrl, resultImageHosted) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === id ? { ...t, resultImageUrl, resultImageHosted, updatedAt: Date.now() } : t
          ),
        })),

      // Step 8 (revised) — edit / delete row flow. `setEditingTrade` just
      // records which trade is being edited; EditTradeModal.jsx renders
      // whenever `editingTradeId` is set and owns prefilling itself (via
      // TradeForm in mode="modal") from that id + `trades`. `updateTrade`
      // merges a patch into the existing row instead of appending a new
      // one, `deleteTrade` removes it outright (the table's exit
      // animation handles the visual removal).
      setEditingTrade: (id) => set({ editingTradeId: id }),
      cancelEditingTrade: () => set({ editingTradeId: null }),
      updateTrade: (id, patch) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
          editingTradeId: null,
        })),
      deleteTrade: (id) =>
        set((s) => ({
          trades: s.trades.filter((t) => t.id !== id),
          editingTradeId: s.editingTradeId === id ? null : s.editingTradeId,
        })),

      // Step 7 — Filters popover actions. `filters` shape lives in
      // initialState above; `setFilter` writes one key at a time (null
      // clears that single filter), `clearFilters` resets the whole set.
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      clearFilters: () => set({ filters: { ...initialState.filters } }),

      // Step 9 — optional cloud sync (stretch goal). Same shape as
      // mapStore's loadFromCloud/saveToCloud: one row per signed-in user
      // in a `trade_analysis` table, guarded by isSupabaseConfigured so
      // everything keeps working locally-only when Supabase isn't set up.
      // Wired up (debounced) from App.jsx alongside the mind-map's own
      // cloud sync.
      loadFromCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        const { data, error } = await supabase
          .from('trade_analysis')
          .select('trades, validation_rules')
          .eq('user_id', userId)
          .maybeSingle()
        if (error || !data) return
        set({
          trades: data.trades || [],
          validationRules: data.validation_rules || [],
        })
      },
      saveToCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        set({ cloudStatus: 'saving' })
        const { trades, validationRules } = get()
        const { error } = await supabase
          .from('trade_analysis')
          .upsert({ user_id: userId, trades, validation_rules: validationRules, updated_at: new Date().toISOString() })
        set({ cloudStatus: error ? 'error' : 'saved' })
      },
    }),
    {
      name: 'mindmap-trade-analysis-storage',
      // Open/editing/cloud-status state is transient per-session;
      // sidebarOpen mirrors whiteboardStore's own partialize (small UI
      // prefs are worth remembering, unlike isOpen/editingTradeId).
      partialize: (state) => ({
        trades: state.trades,
        validationRules: state.validationRules,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
    }
  )
)
