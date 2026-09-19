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

// Step A of trade-analysis-validation-v3-master-prompt.md — rules now live
// in named categories instead of one flat list. `validationCategories` is
// the list of category "folders" (id, name, icon, order); each rule in
// `validationRules` points back at one via `categoryId`. Seed data below
// matches the two default categories shown in the Validation Settings
// design reference exactly.
const DEFAULT_VALIDATION_CATEGORIES_SEED = [
  {
    name: 'Candle Rules',
    icon: 'Flame',
    rules: [
      'Strong bullish/bearish engulfing candle',
      'No upper/lower wick at zone',
      'Big body candle (body > 60% of range)',
      'Candle closes above/below key level',
      'Low volume on consolidation candles',
      'Breakout candle on high volume',
    ],
  },
  {
    name: 'SMC Rules',
    icon: 'BarChart3',
    rules: [
      'Order Block identified on HTF',
      'Fair Value Gap (FVG) present',
      'Break of Structure (BOS) confirmed',
      'Change of Character (CHoCH) seen',
      'Liquidity swept before entry',
      'Premium / Discount zone aligned',
    ],
  },
]

function buildDefaultValidationData() {
  const categories = []
  const rules = []
  DEFAULT_VALIDATION_CATEGORIES_SEED.forEach((cat, ci) => {
    const categoryId = crypto.randomUUID()
    categories.push({ id: categoryId, name: cat.name, icon: cat.icon, order: ci })
    cat.rules.forEach((label, ri) => {
      rules.push({ id: crypto.randomUUID(), categoryId, label, active: true, order: ri })
    })
  })
  return { categories, rules }
}

const initialState = {
  isOpen: false,
  sidebarOpen: true,

  // Step 1 of trade-analysis-analytics-master-prompt.md — which tab the
  // overlay's top bar shows: the existing entries table, or the new
  // read-only Analysis dashboard. Persisted like sidebarOpen/theme so
  // reopening the overlay remembers where you left off.
  activeView: 'table', // 'table' | 'analysis'

  // Table tab only — whether entries render as the classic horizontal
  // row table, or as a responsive grid of cards (3-up on a wide screen).
  // Persisted the same way as activeView/theme.
  entriesView: 'list', // 'list' | 'cards'

  // ── Analysis tab (pro build) ───────────────────────────────────────
  // Which section of the Analysis dashboard is showing. Split into
  // sections rather than one endless scroll so each area can be dense
  // without becoming a 30-screen page.
  analysisSection: 'overview',

  // Text/spacing scale for the whole Analysis tab — see the
  // [data-ta-density] block in index.css. Persisted because it's a
  // display preference, not per-session state.
  density: 'compact', // 'cozy' | 'compact' | 'dense'

  // Date window every Analysis widget reads through. `preset` is one of
  // 'all' | '7d' | '30d' | '90d' | '6m' | '1y' | 'custom'; from/to are
  // ISO date strings used only when preset is 'custom'.
  analysisScope: { preset: 'all', from: null, to: null },

  // Persisted inputs for the calculators in the Tools section. These are
  // the person's own numbers (account size, risk %, broker leverage) —
  // retyping them on every visit would make the tools useless in
  // practice, so they're remembered exactly like any other preference.
  toolInputs: {
    accountSize: '',
    riskPercent: '1',
    leverage: '20',
    usdInrRate: '',
    costPerTrade: '',
    taxPct: '',
  },

  // User-defined alert rules — { id, metric, comparator, threshold,
  // scope, enabled }. Evaluated live against real stats in the Tools
  // section; nothing is scheduled or sent anywhere.
  alertRules: [],

  // User-set targets — { id, label, metric, target, period }.
  goals: [],

  // Widget ids the person pinned to the top of the Overview section.
  pinnedWidgets: [],

  // Selected color theme id for the whole feature — see
  // src/theme/tradeAnalysisThemes.js for the palette list. Applied as CSS
  // var overrides on the overlay root in TradeAnalysis.jsx.
  theme: 'classic',

  // Editing state — null when the left form is a blank "add new trade"
  // form; set to a trade id when Edit was clicked on a table row (Step 8).
  editingTradeId: null,

  trades: [], // { id, name, date, pair, instrumentType, timeframe, direction, price, pnl, notes, validationRuleIds, screenshotUrl, screenshotHosted, resultImageUrl, resultImageHosted, status, createdAt, updatedAt }

  // { id, name, icon, order } — the categories shown in the Validation
  // Settings panel's left sidebar (e.g. "Candle Rules", "SMC Rules").
  validationCategories: [],
  validationRules: [], // { id, categoryId, label, active, order }

  // Multi-select filters — pair/instrumentType/timeframe/direction/status/
  // validationRuleId each hold an ARRAY of selected values (empty array =
  // no restriction, matches everything). dateFrom/dateTo stay single
  // values since a date range only ever has one start and one end.
  filters: {
    pair: [],
    instrumentType: [],
    timeframe: [],
    direction: [],
    status: [],
    validationRuleId: [],
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

      open: () => {
        set({ isOpen: true })
        get().ensureValidationSeeded()
      },
      close: () => set({ isOpen: false, editingTradeId: null }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setActiveView: (activeView) => set({ activeView }),
      setEntriesView: (entriesView) => set({ entriesView }),

      // ── Analysis tab actions ─────────────────────────────────────
      setAnalysisSection: (analysisSection) => set({ analysisSection }),
      setDensity: (density) => set({ density }),
      setAnalysisScope: (patch) =>
        set((s) => ({ analysisScope: { ...s.analysisScope, ...patch } })),
      resetAnalysisScope: () => set({ analysisScope: { preset: 'all', from: null, to: null } }),

      setToolInput: (key, value) =>
        set((s) => ({ toolInputs: { ...s.toolInputs, [key]: value } })),
      setToolInputs: (patch) =>
        set((s) => ({ toolInputs: { ...s.toolInputs, ...patch } })),

      addAlertRule: (rule) =>
        set((s) => ({
          alertRules: [
            ...s.alertRules,
            {
              id: crypto.randomUUID(),
              metric: 'winRate',
              comparator: 'below',
              threshold: 50,
              scope: 'all',
              enabled: true,
              ...rule,
            },
          ],
        })),
      updateAlertRule: (id, patch) =>
        set((s) => ({ alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteAlertRule: (id) => set((s) => ({ alertRules: s.alertRules.filter((r) => r.id !== id) })),

      addGoal: (goal) =>
        set((s) => ({
          goals: [
            ...s.goals,
            { id: crypto.randomUUID(), label: 'New goal', metric: 'netPnl', target: 0, period: 'month', currency: 'USD', ...goal },
          ],
        })),
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      togglePinnedWidget: (id) =>
        set((s) => ({
          pinnedWidgets: s.pinnedWidgets.includes(id)
            ? s.pinnedWidgets.filter((w) => w !== id)
            : [...s.pinnedWidgets, id],
        })),

      // Bulk import from the CSV tool. Stamps ids/timestamps the same way
      // addTrade does so imported rows are indistinguishable from typed
      // ones everywhere downstream, and returns how many landed.
      importTrades: (rows) => {
        if (!Array.isArray(rows) || !rows.length) return 0
        const now = Date.now()
        set((s) => ({
          trades: [
            ...s.trades,
            ...rows.map((t, i) => ({
              id: crypto.randomUUID(),
              status: 'Pending',
              createdAt: t.date ? new Date(`${t.date}T10:00:00`).getTime() : now + i,
              updatedAt: now + i,
              validationRuleIds: [],
              ...t,
            })),
          ],
        }))
        return rows.length
      },

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

      // Step A of trade-analysis-validation-v3-master-prompt.md — one-time
      // seed/migration, called from TradeAnalysis.jsx's open(). Safe to
      // call every time the overlay opens: it's a no-op once categories
      // already exist and every rule has a categoryId.
      ensureValidationSeeded: () =>
        set((s) => {
          if (s.validationCategories.length === 0 && s.validationRules.length === 0) {
            const { categories, rules } = buildDefaultValidationData()
            return { validationCategories: categories, validationRules: rules }
          }
          const orphanRules = s.validationRules.filter((r) => !r.categoryId)
          if (orphanRules.length === 0) return {}
          // Pre-v3 flat rules (or anything created before this migration
          // ran) land in a catch-all "General" category instead of being
          // dropped — never silently delete a user's own custom rules.
          let general = s.validationCategories.find((c) => c.name === 'General')
          let categories = s.validationCategories
          if (!general) {
            general = { id: crypto.randomUUID(), name: 'General', icon: 'ListChecks', order: categories.length }
            categories = [...categories, general]
          }
          const rules = s.validationRules.map((r, i) =>
            r.categoryId ? r : { ...r, categoryId: general.id, order: r.order ?? i }
          )
          return { validationCategories: categories, validationRules: rules }
        }),

      // Step B — Validation Settings panel: category actions.
      addCategory: (name, icon = 'ListChecks') => {
        const id = crypto.randomUUID()
        set((s) => ({
          validationCategories: [
            ...s.validationCategories,
            { id, name: (name || '').trim() || 'Untitled category', icon, order: s.validationCategories.length },
          ],
        }))
        return id
      },
      renameCategory: (id, name) =>
        set((s) => ({
          validationCategories: s.validationCategories.map((c) => (c.id === id ? { ...c, name } : c)),
        })),
      // Deletes the category, its rules, and unticks those rules from any
      // trade that had them checked (so the table's score % stays honest).
      deleteCategory: (id) =>
        set((s) => {
          const removedRuleIds = new Set(s.validationRules.filter((r) => r.categoryId === id).map((r) => r.id))
          return {
            validationCategories: s.validationCategories.filter((c) => c.id !== id),
            validationRules: s.validationRules.filter((r) => r.categoryId !== id),
            trades: s.trades.map((t) =>
              (t.validationRuleIds || []).some((rid) => removedRuleIds.has(rid))
                ? { ...t, validationRuleIds: t.validationRuleIds.filter((rid) => !removedRuleIds.has(rid)) }
                : t
            ),
          }
        }),
      reorderCategory: (id, direction) =>
        set((s) => {
          const sorted = [...s.validationCategories].sort((a, b) => a.order - b.order)
          const idx = sorted.findIndex((c) => c.id === id)
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return {}
          const a = sorted[idx]
          const b = sorted[swapIdx]
          return {
            validationCategories: s.validationCategories.map((c) => {
              if (c.id === a.id) return { ...c, order: b.order }
              if (c.id === b.id) return { ...c, order: a.order }
              return c
            }),
          }
        }),
      resetValidationDefaults: () => {
        const { categories, rules } = buildDefaultValidationData()
        set({ validationCategories: categories, validationRules: rules })
      },

      // Step B/D — rule actions, now scoped to a category.
      addValidationRule: (categoryId, label) => {
        const trimmed = (label || '').trim()
        if (!trimmed || !categoryId) return
        set((s) => {
          const siblingCount = s.validationRules.filter((r) => r.categoryId === categoryId).length
          return {
            validationRules: [
              ...s.validationRules,
              { id: crypto.randomUUID(), categoryId, label: trimmed, active: true, order: siblingCount, color: null },
            ],
          }
        })
      },
      updateValidationRuleLabel: (id, label) =>
        set((s) => ({
          validationRules: s.validationRules.map((r) => (r.id === id ? { ...r, label } : r)),
        })),
      // `color` is a custom background for this rule's row (in both
      // Validation Settings and the "Add Validation" checklist popup).
      // `null` clears it back to the default row background.
      updateValidationRuleColor: (id, color) =>
        set((s) => ({
          validationRules: s.validationRules.map((r) => (r.id === id ? { ...r, color } : r)),
        })),
      toggleValidationRuleActive: (id) =>
        set((s) => ({
          validationRules: s.validationRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
        })),
      deleteValidationRule: (id) =>
        set((s) => ({
          validationRules: s.validationRules.filter((r) => r.id !== id),
          trades: s.trades.map((t) =>
            (t.validationRuleIds || []).includes(id)
              ? { ...t, validationRuleIds: t.validationRuleIds.filter((rid) => rid !== id) }
              : t
          ),
        })),
      // Reorders a rule up/down within its own category — a rule in
      // "SMC Rules" never swaps places with one in "Candle Rules".
      moveValidationRule: (id, direction) =>
        set((s) => {
          const rule = s.validationRules.find((r) => r.id === id)
          if (!rule) return {}
          const siblings = s.validationRules
            .filter((r) => r.categoryId === rule.categoryId)
            .sort((a, b) => a.order - b.order)
          const idx = siblings.findIndex((r) => r.id === id)
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          if (swapIdx < 0 || swapIdx >= siblings.length) return {}
          const a = siblings[idx]
          const b = siblings[swapIdx]
          return {
            validationRules: s.validationRules.map((r) => {
              if (r.id === a.id) return { ...r, order: b.order }
              if (r.id === b.id) return { ...r, order: a.order }
              return r
            }),
          }
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

      // P&L quick-edit — lets the table's inline P&L cell update just that
      // one field without opening the full Edit modal. `pnl` is a number or
      // null (cleared).
      updateTradePnl: (id, pnl) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, pnl, updatedAt: Date.now() } : t)),
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
      // Same write as updateTrade, but leaves editingTradeId alone — used
      // by the edit form's autosave so a silent background save doesn't
      // boot the person out of the modal while they're still editing.
      autosaveTrade: (id, patch) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
        })),
      deleteTrade: (id) =>
        set((s) => ({
          trades: s.trades.filter((t) => t.id !== id),
          editingTradeId: s.editingTradeId === id ? null : s.editingTradeId,
        })),

      // Step 7 — Filters popover actions. `filters` shape lives in
      // initialState above. `setFilter` writes one key at a time — used
      // for the single-value date range (null clears that one filter).
      // `toggleFilterValue` is for the multi-select fields: adds `value`
      // to that key's array if absent, removes it if present, so each
      // filter can hold several selections at once. `clearFilters` resets
      // the whole set back to empty arrays / null dates.
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      toggleFilterValue: (key, value) =>
        set((s) => {
          const current = s.filters[key] || []
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value]
          return { filters: { ...s.filters, [key]: next } }
        }),
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
          .select('trades, validation_rules, validation_categories')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return

        const cloudTrades = data?.trades || []
        const cloudRules = data?.validation_rules || []
        const cloudCategories = data?.validation_categories || []
        const { trades: localTrades, validationRules: localRules } = get()
        const cloudIsEmpty = cloudTrades.length === 0 && cloudRules.length === 0
        const localHasData = localTrades.length > 0 || localRules.length > 0

        // Guard against the very first sync (or a not-yet-created cloud
        // row) wiping out real local data with an empty cloud row: if the
        // cloud has nothing yet but this device already has trades/rules,
        // push the local data up instead of overwriting it with emptiness.
        if (cloudIsEmpty && localHasData) {
          get().saveToCloud(userId)
          return
        }

        set({
          trades: cloudTrades,
          validationRules: cloudRules,
          validationCategories: cloudCategories,
        })
        get().ensureValidationSeeded()
      },
      saveToCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        set({ cloudStatus: 'saving' })
        const { trades, validationRules, validationCategories } = get()
        const { error } = await supabase.from('trade_analysis').upsert({
          user_id: userId,
          trades,
          validation_rules: validationRules,
          validation_categories: validationCategories,
          updated_at: new Date().toISOString(),
        })
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
        validationCategories: state.validationCategories,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        activeView: state.activeView,
        entriesView: state.entriesView,
        analysisSection: state.analysisSection,
        density: state.density,
        analysisScope: state.analysisScope,
        toolInputs: state.toolInputs,
        alertRules: state.alertRules,
        goals: state.goals,
        pinnedWidgets: state.pinnedWidgets,
      }),
      // Older persisted payloads predate every key added in the pro
      // Analysis build, so merge defaults in rather than letting
      // `undefined` reach a component that expects an object or array.
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        analysisScope: { ...current.analysisScope, ...(persisted?.analysisScope || {}) },
        toolInputs: { ...current.toolInputs, ...(persisted?.toolInputs || {}) },
        alertRules: persisted?.alertRules ?? current.alertRules,
        goals: persisted?.goals ?? current.goals,
        pinnedWidgets: persisted?.pinnedWidgets ?? current.pinnedWidgets,
        density: persisted?.density ?? current.density,
        analysisSection: persisted?.analysisSection ?? current.analysisSection,
      }),
    }
  )
)
