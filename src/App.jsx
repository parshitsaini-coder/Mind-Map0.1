import { useEffect, useRef } from 'react'
import TopToolbar from './components/toolbar/TopToolbar'
import Sidebar from './components/panels/Sidebar'
import ConnectorStylesPanel from './components/panels/ConnectorStylesPanel'
import AuthPanel from './components/auth/AuthPanel'
import MindMapCanvas from './components/canvas/MindMapCanvas'
import { useUiStore } from './store/uiStore'
import { useMapStore } from './store/mapStore'
import { useAuthStore } from './store/authStore'
import { THEME_PRESETS } from './theme/tokens'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { decodeMapFromParam } from './utils/exportShareLink'

export default function App() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const themeName = useUiStore((s) => s.themeName)
  const toastMessage = useUiStore((s) => s.toastMessage)
  const user = useAuthStore((s) => s.user)
  const authInitialized = useAuthStore((s) => s.initialized)
  const saveTimeout = useRef(null)
  const hasLoadedForUser = useRef(null)
  useKeyboardShortcuts()

  // Restore an existing Supabase session (if any) once on app start.
  useEffect(() => {
    useAuthStore.getState().init()
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

  // Section 4.7 — share link: load map data encoded in the URL, if present.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mapParam = params.get('map')
    if (!mapParam) return
    const decoded = decodeMapFromParam(mapParam)
    if (decoded?.nodes && window.confirm('Open the shared map from this link? This replaces your current map (your current map stays in undo history).')) {
      useMapStore.getState().pushSnapshot()
      useMapStore.setState({ nodes: decoded.nodes, edges: decoded.edges || [] })
    }
    params.delete('map')
    window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`)
  }, [])

  // Section 4.3 — themes/skins. Swaps the live CSS custom properties so the
  // whole UI (canvas bg, sidebar, cards, node fills) repaints instantly.
  useEffect(() => {
    const preset = THEME_PRESETS[themeName] || THEME_PRESETS.default
    const root = document.documentElement
    root.style.setProperty('--color-bg-main', preset.bgMain)
    root.style.setProperty('--color-sage', preset.sage)
    root.style.setProperty('--color-cream', preset.cream)
    root.style.setProperty('--color-accent', preset.accent)
    root.style.setProperty('--color-ink', preset.ink)
    root.style.setProperty('--color-slate', preset.slate)
  }, [themeName])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <TopToolbar />
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
          style={{ backgroundColor: '#f5cb5c' }}
        >
          Open panel
        </button>
      )}
      {toastMessage && (
        <div
          className="fixed left-1/2 top-14 z-50 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs shadow-lg"
          style={{ backgroundColor: '#242423', color: '#e8eddf' }}
        >
          {toastMessage}
        </div>
      )}
      <AuthPanel />
    </div>
  )
}
