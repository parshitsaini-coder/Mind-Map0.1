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
  checklists: [],
  trades: [],

  setMap: (nodes, edges, checklists, trades) =>
    set({ nodes: nodes || [], edges: edges || [], checklists: checklists || [], trades: trades || [] }),

  toggleCollapse: (id) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
      ),
    })),
}))
