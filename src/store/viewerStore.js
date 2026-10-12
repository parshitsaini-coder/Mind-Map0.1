import { create } from 'zustand'
import { computeCalcUpdates } from '../utils/calcEngine'

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

  // Section — Numbers-only node type. The one read/write exception on an
  // otherwise read-only viewer: a node whose style has `numbersOnly` set
  // stays live-editable for anyone with the link (see the input in
  // ViewerNode.jsx), so the field itself works like a shared counter/input
  // rather than a static label. Local to this tab only — it does not write
  // back to the owner's saved map or the live-share row.
  //
  // Typing a number here used to only update that one node's own label —
  // any "=" connector chain built on the editor side (see calcEngine.js /
  // mapStore's recalcConnectors) never re-ran, so a visitor typing into the
  // formula's input node saw no result even though the exact same edit on
  // the owner's own canvas recalculates instantly. Mirrors mapStore's
  // recalcConnectors here so the same chain updates for viewers too.
  updateNodeLabel: (id, label) =>
    set((s) => {
      const nodes = s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
      const updates = computeCalcUpdates(nodes, s.edges)
      if (!updates.length) return { nodes }
      const patchById = new Map(updates.map((u) => [u.id, u.label]))
      return {
        nodes: nodes.map((n) =>
          patchById.has(n.id) ? { ...n, data: { ...n.data, label: patchById.get(n.id) } } : n
        ),
      }
    }),

  openTradeDetail: (tradeId) => set({ tradeDetail: { tradeId } }),
  closeTradeDetail: () => set({ tradeDetail: null }),
}))
