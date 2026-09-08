import { create } from 'zustand'

export const useUiStore = create((set) => ({
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

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleConnectorPanel: () => set((s) => ({ connectorPanelOpen: !s.connectorPanelOpen })),
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
  showToast: (toastMessage) => {
    set({ toastMessage })
    setTimeout(() => set((s) => (s.toastMessage === toastMessage ? { toastMessage: null } : {})), 2200)
  },
}))
