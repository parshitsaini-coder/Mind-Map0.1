import { useEffect, useRef } from 'react'
import TopToolbar from './components/toolbar/TopToolbar'
import TabsBar from './components/toolbar/TabsBar'
import Sidebar from './components/panels/Sidebar'
import ConnectorStylesPanel from './components/panels/ConnectorStylesPanel'
import ProjectsDashboard from './components/panels/ProjectsDashboard'
import StyleLibraryPanel from './components/panels/StyleLibraryPanel'
import AuthPanel from './components/auth/AuthPanel'
import ImageLightbox from './components/common/ImageLightbox'
import MindMapCanvas from './components/canvas/MindMapCanvas'
import { useUiStore } from './store/uiStore'
import { useMapStore } from './store/mapStore'
import { useProjectsStore } from './store/projectsStore'
import { useAuthStore } from './store/authStore'
import { applyThemeVars } from './theme/tokens'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const themeName = useUiStore((s) => s.themeName)
  const toastMessage = useUiStore((s) => s.toastMessage)
  const user = useAuthStore((s) => s.user)
  const authInitialized = useAuthStore((s) => s.initialized)
  const saveTimeout = useRef(null)
  const hasLoadedForUser = useRef(null)
  const projectSaveTimeout = useRef(null)
  useKeyboardShortcuts()

  // Restore an existing Supabase session (if any) once on app start.
  useEffect(() => {
    useAuthStore.getState().init()
  }, [])

  // Section — multi-project support. Sets up (or migrates) the projects
  // list once, then loads whichever project was last active straight onto
  // the canvas so returning users land back where they left off.
  useEffect(() => {
    useProjectsStore.getState().init()
    const id = useProjectsStore.getState().activeProjectId
    if (id) useMapStore.getState().loadProject(id)
  }, [])

  // Autosave the live canvas into the *current* project's local storage
  // slot (debounced, same 1.2s pattern as the cloud sync below) whenever
  // nodes/edges/groups change, and bump that project's "last edited" date
  // so the dashboard sorts it to the top.
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => {
      const projectId = useMapStore.getState().activeProjectId
      if (!projectId) return
      clearTimeout(projectSaveTimeout.current)
      projectSaveTimeout.current = setTimeout(() => {
        useMapStore.getState().saveProject(projectId)
        useProjectsStore.getState().touchActiveProject()
      }, 1200)
    })
    return () => {
      clearTimeout(projectSaveTimeout.current)
      unsubscribe()
    }
  }, [])

  // Section — online account sync. As soon as someone is signed in, pull
  // their last-saved cloud map down once; after that, every map change is
  // auto-saved back up (debounced, so a burst of edits = one network call).
  useEffect(() => {
    if (!authInitialized) return
    if (user && hasLoadedForUser.current !== user.id) {
      hasLoadedForUser.current = user.id
      useMapStore.getState().loadFromCloud(user.id)
    }
    if (!user) hasLoadedForUser.current = null

    const unsubscribe = useMapStore.subscribe(() => {
      if (!user) return
      clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        useMapStore.getState().saveToCloud(user.id)
      }, 1200)
    })
    return () => {
      clearTimeout(saveTimeout.current)
      unsubscribe()
    }
  }, [user, authInitialized])

  // Section 4.3 — themes/skins. Swaps the live CSS custom properties so the
  // whole UI (canvas bg, sidebar, cards, node fills) repaints instantly.
  useEffect(() => {
    applyThemeVars(themeName)
  }, [themeName])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <TopToolbar />
      <TabsBar />
      <div className="flex min-h-0 flex-1">
        <ConnectorStylesPanel />
        <main className="min-w-0 flex-1">
          <MindMapCanvas />
        </main>
        <Sidebar />
      </div>
      {!sidebarOpen && (
        <button
          onClick={() => useUiStore.getState().toggleSidebar()}
          className="fixed bottom-3 right-3 rounded-full px-2.5 py-1.5 text-xs shadow"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          Open panel
        </button>
      )}
      {toastMessage && (
        <div
          className="fixed left-1/2 top-14 z-50 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs shadow-lg"
          style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
        >
          {toastMessage}
        </div>
      )}
      <AuthPanel />
      <ProjectsDashboard />
      <StyleLibraryPanel />
      <ImageLightbox />
    </div>
  )
}
