import { create } from 'zustand'

// Section — shared-link viewer. Deliberately separate from `mapStore`
// (no `persist` middleware) so opening someone else's shared link never
// touches the viewer's own local storage or cloud-saved map — it only ever
// holds whatever was decoded from the `?map=` URL param, in memory, for as
// long as the tab is open. The only interaction it supports is expanding/
// collapsing branches.
export const useViewerStore = create((set) => ({
  nodes: [],
  edges: [],
  // Denormalized snapshots embedded in the share link itself (see
  // utils/exportShareLink.js) — the viewer never touches the real
  // checklistStore/tradeAnalysisStore, so any checklist a node carries or
  // any trade a node links to has to travel inside the map payload.
  checklists: [],
  trades: [],
  validationRules: [],

  // Read-only counterpart to uiStore's tradeDetail: which trade's popup is
  // currently open, keyed off the embedded `trades` snapshot above rather
  // than the editor's live store.
  tradeDetail: null, // { tradeId } | null

  setMap: (nodes, edges, extra = {}) =>
    set({
      nodes: nodes || [],
      edges: edges || [],
      checklists: extra.checklists || [],
      trades: extra.trades || [],
      validationRules: extra.validationRules || [],
    }),

  toggleCollapse: (id) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
      ),
    })),

  openTradeDetail: (tradeId) => set({ tradeDetail: { tradeId } }),
  closeTradeDetail: () => set({ tradeDetail: null }),
}))
