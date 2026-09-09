import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUiStore = create(
  persist(
    (set) => ({
      sidebarOpen: true,
      activePanel: 'inspector', // inspector | icons | theme | outline | tasks | comments | activity
      layout: 'radial',
      treeDirection: 'vertical', // 'vertical' | 'horizontal' — used by the orgChart layout
      themeName: 'default',
      focusMode: false,
      presentationMode: false,
      presentationIndex: 0,
      relationshipMode: false, // when true, dragging a connection creates a cross-branch relationship edge
      searchOpen: false,
      showMockCursors: false,
      toastMessage: null,
      connectorPanelOpen: false,
      authModalOpen: false,
      styleLibraryOpen: false,
      imageLightboxUrl: null, // set to an image URL to open it fullscreen; null when closed
      jumpToken: null, // { id, ts } — set to ask the canvas to pan/zoom to and select a node (used by Linked Nodes / Backlinks jump buttons)

      // Section — Link a Trade to a node. `tradeLinkPickerNodeId` opens the
      // "pick a trade from Trade Analysis" popup for that node id (from the
      // node's right-click menu or the inspector's Linked Trade section).
      // `tradeDetail` opens the read-only trade detail popup; it keeps the
      // triggering nodeId alongside the tradeId so that popup can offer an
      // "Unlink from this node" action without needing extra plumbing.
      tradeLinkPickerNodeId: null,
      tradeDetail: null, // { nodeId, tradeId } | null

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleConnectorPanel: () => set((s) => ({ connectorPanelOpen: !s.connectorPanelOpen })),
      toggleAuthModal: () => set((s) => ({ authModalOpen: !s.authModalOpen })),
      toggleStyleLibrary: () => set((s) => ({ styleLibraryOpen: !s.styleLibraryOpen })),
      toggleRelationshipMode: () => set((s) => ({ relationshipMode: !s.relationshipMode })),
      setActivePanel: (panel) => set({ activePanel: panel, sidebarOpen: true }),
      setLayout: (layout) => set({ layout }),
      setTreeDirection: (treeDirection) => set({ treeDirection }),
      setThemeName: (themeName) => set({ themeName }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      togglePresentationMode: () => set((s) => ({ presentationMode: !s.presentationMode, presentationIndex: 0 })),
      setPresentationIndex: (presentationIndex) => set({ presentationIndex }),
      toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
      toggleMockCursors: () => set((s) => ({ showMockCursors: !s.showMockCursors })),
      openImageLightbox: (url) => set({ imageLightboxUrl: url }),
      closeImageLightbox: () => set({ imageLightboxUrl: null }),
      openTradeLinkPicker: (nodeId) => set({ tradeLinkPickerNodeId: nodeId }),
      closeTradeLinkPicker: () => set({ tradeLinkPickerNodeId: null }),
      openTradeDetail: (nodeId, tradeId) => set({ tradeDetail: { nodeId, tradeId } }),
      closeTradeDetail: () => set({ tradeDetail: null }),
      jumpToNode: (id) => set({ jumpToken: { id, ts: Date.now() }, activePanel: 'inspector', sidebarOpen: true }),
      showToast: (toastMessage) => {
        set({ toastMessage })
        setTimeout(() => set((s) => (s.toastMessage === toastMessage ? { toastMessage: null } : {})), 2200)
      },
    }),
    {
      name: 'mindmap-ui-storage',
      // Only persist theme + layout choices across a refresh. Everything
      // else here (modals, toasts, focus/presentation mode, panel open
      // state, etc.) is transient UI state and should reset to its
      // default each time the app loads.
      partialize: (state) => ({
        layout: state.layout,
        treeDirection: state.treeDirection,
        themeName: state.themeName,
      }),
    }
  )
)
