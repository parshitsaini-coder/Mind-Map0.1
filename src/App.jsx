import { useEffect, useRef } from 'react'
import TopToolbar from './components/toolbar/TopToolbar'
import TabsBar from './components/toolbar/TabsBar'
import Sidebar from './components/panels/Sidebar'
import ConnectorStylesPanel from './components/panels/ConnectorStylesPanel'
import ProjectsDashboard from './components/panels/ProjectsDashboard'
import StyleLibraryPanel from './components/panels/StyleLibraryPanel'
import NodeLibraryPanel from './components/panels/NodeLibraryPanel'
import ChecklistPanel from './components/panels/ChecklistPanel'
import AuthPanel from './components/auth/AuthPanel'
import ShareModal from './components/toolbar/ShareModal'
import ImageLightbox from './components/common/ImageLightbox'
import Whiteboard from './components/whiteboard/Whiteboard'
import TradeAnalysis from './components/trade-analysis/TradeAnalysis'
import TradeLinkPickerModal from './components/trade-analysis/TradeLinkPickerModal'
import TradeDetailModal from './components/trade-analysis/TradeDetailModal'
import MindMapCanvas from './components/canvas/MindMapCanvas'
import { useUiStore } from './store/uiStore'
import { useMapStore } from './store/mapStore'
import { useProjectsStore, readProjectData } from './store/projectsStore'
import { useAuthStore } from './store/authStore'
import { useTradeAnalysisStore } from './store/tradeAnalysisStore'
import { useLiveShareStore } from './store/liveShareStore'
import { applyThemeVars } from './theme/tokens'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { upsertProjectCloud, deleteProjectCloud } from './lib/projectCloudSync'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const themeName = useUiStore((s) => s.themeName)
  const toastMessage = useUiStore((s) => s.toastMessage)
  const user = useAuthStore((s) => s.user)
  const authInitialized = useAuthStore((s) => s.initialized)
  const saveTimeout = useRef(null)
  const hasLoadedForUser = useRef(null)
  const tradeSaveTimeout = useRef(null)
  const hasLoadedTradesForUser = useRef(null)
  const projectSaveTimeout = useRef(null)
  const liveShareSaveTimeout = useRef(null)
  const projectCloudSaveTimeout = useRef(null)
  const hasMergedProjectsForUser = useRef(null)
  const prevProjectsRef = useRef(null)
  useKeyboardShortcuts()

  // Restore an existing Supabase session (if any) once on app start.
  useEffect(() => {
    useAuthStore.getState().init()
  }, [])

  // Section — nudge signed-out visitors to log in, once per visit. Without
  // an account the map lives only in this browser's localStorage — clearing
  // site data or opening on another device loses it — so as soon as we know
  // for sure no one's signed in, prompt once rather than relying on someone
  // noticing the small account icon in the toolbar.
  const hasPromptedLogin = useRef(false)
  useEffect(() => {
    if (!authInitialized || user || !isSupabaseConfigured || hasPromptedLogin.current) return
    hasPromptedLogin.current = true
    useUiStore.getState().toggleAuthModal()
  }, [authInitialized, user])

  // Section — multi-project support. Sets up (or migrates) the projects
  // list once, then loads whichever project was last active straight onto
  // the canvas so returning users land back where they left off.
  useEffect(() => {
    useProjectsStore.getState().init()
    prevProjectsRef.current = useProjectsStore.getState().projects
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

  // Section — per-project cloud backup (data). Piggybacks on the same
  // "canvas changed" signal as the local autosave above, but on its own
  // debounce/timer and gated on being signed in, so this is the fix for the
  // bug that caused real data loss: every project's full nodes/edges now
  // gets backed up to its own cloud row, not just whichever one is open —
  // clearing site data (or moving devices) no longer loses anything that
  // ever synced once while signed in.
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => {
      if (!user) return
      const projectId = useMapStore.getState().activeProjectId
      if (!projectId) return
      clearTimeout(projectCloudSaveTimeout.current)
      projectCloudSaveTimeout.current = setTimeout(() => {
        const { nodes, edges, groups, activityLog } = useMapStore.getState()
        const project = useProjectsStore.getState().projects.find((p) => p.id === projectId)
        upsertProjectCloud(user.id, {
          id: projectId,
          name: project?.name,
          nodes,
          edges,
          groups,
          activityLog,
          updatedAt: Date.now(),
        })
      }, 1200)
    })
    return () => {
      clearTimeout(projectCloudSaveTimeout.current)
      unsubscribe()
    }
  }, [user])

  // Section — per-project cloud backup (metadata: create/rename/delete).
  // Diffs the projects list against its previous snapshot so a brand-new
  // project gets its first cloud row immediately (not just at the 1.2s data
  // debounce above), a rename pushes the new name, and — importantly — a
  // deletion actually removes that project's cloud row too, so it doesn't
  // reappear via mergeFromCloud on another device later.
  useEffect(() => {
    const unsubscribe = useProjectsStore.subscribe((s) => {
      if (!user) {
        prevProjectsRef.current = s.projects
        return
      }
      const prev = prevProjectsRef.current || []
      const prevIds = new Set(prev.map((p) => p.id))
      const currIds = new Set(s.projects.map((p) => p.id))

      for (const p of s.projects) {
        const prior = prev.find((x) => x.id === p.id)
        if (!prior || prior.name !== p.name) {
          const data = readProjectData(p.id)
          upsertProjectCloud(user.id, { id: p.id, name: p.name, ...(data || {}), updatedAt: p.updatedAt })
        }
      }
      for (const p of prev) {
        if (!currIds.has(p.id)) deleteProjectCloud(user.id, p.id)
      }
      prevProjectsRef.current = s.projects
    })
    return unsubscribe
  }, [user])

  // Section — keep every device converged, not just recover from a wipe.
  // The login sync above catches this browser up once; this keeps it in
  // step with *other* open devices too — polling every 15s, plus instantly
  // on regaining window focus or opening the "Your Mind Maps" dashboard —
  // so a rename or edit made elsewhere shows up here without a full
  // logout/login. See syncWithCloud in projectsStore.js for the merge
  // rules (last-write-wins by timestamp; the currently open project's own
  // canvas data is never overwritten mid-edit, only its name).
  useEffect(() => {
    if (!user) return
    const sync = () => useProjectsStore.getState().syncWithCloud(user.id)
    const interval = setInterval(sync, 15000)
    window.addEventListener('focus', sync)
    let wasOpen = useProjectsStore.getState().dashboardOpen
    const unsubscribeDashboard = useProjectsStore.subscribe((s) => {
      if (s.dashboardOpen && !wasOpen) sync()
      wasOpen = s.dashboardOpen
    })
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', sync)
      unsubscribeDashboard()
    }
  }, [user])

  // Section — live share sync. If the active project currently has a live
  // link out (see ShareModal), push every edit up to Supabase (debounced,
  // same pattern as the cloud/project autosaves) so a visitor refreshing
  // that link sees the latest map instead of a frozen snapshot. No-ops
  // instantly (no network call) when there's no active live link.
  useEffect(() => {
    const unsubscribe = useMapStore.subscribe(() => {
      const projectId = useMapStore.getState().activeProjectId || 'default'
      clearTimeout(liveShareSaveTimeout.current)
      liveShareSaveTimeout.current = setTimeout(() => {
        const { nodes, edges } = useMapStore.getState()
        const themeName = useUiStore.getState().themeName
        useLiveShareStore.getState().pushUpdate(projectId, nodes, edges, themeName)
      }, 1200)
    })
    return () => {
      clearTimeout(liveShareSaveTimeout.current)
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

    if (user && hasMergedProjectsForUser.current !== user.id) {
      hasMergedProjectsForUser.current = user.id
      useProjectsStore.getState().syncWithCloud(user.id)
    }
    if (!user) hasMergedProjectsForUser.current = null

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

  // Step 9 (stretch goal) — same online sync pattern as the mind map
  // above, applied to the Trade Analysis feature's trades/validation
  // rules. Independent debounce/timers so a burst of edits in either
  // feature doesn't cancel the other's pending save.
  useEffect(() => {
    if (!authInitialized) return
    if (user && hasLoadedTradesForUser.current !== user.id) {
      hasLoadedTradesForUser.current = user.id
      useTradeAnalysisStore.getState().loadFromCloud(user.id)
    }
    if (!user) hasLoadedTradesForUser.current = null

    const unsubscribe = useTradeAnalysisStore.subscribe(() => {
      if (!user) return
      clearTimeout(tradeSaveTimeout.current)
      tradeSaveTimeout.current = setTimeout(() => {
        useTradeAnalysisStore.getState().saveToCloud(user.id)
      }, 1200)
    })
    return () => {
      clearTimeout(tradeSaveTimeout.current)
      unsubscribe()
    }
  }, [user, authInitialized])

  // Section 4.3 — themes/skins. Swaps the live CSS custom properties so the
  // whole UI (canvas bg, sidebar, cards, node fills) repaints instantly.
  useEffect(() => {
    applyThemeVars(themeName)
  }, [themeName])

  // Section — live share theme sync. Changing the theme alone (no node/edge
  // edit) wouldn't otherwise trigger the map-change subscriber above, so an
  // active live link's visitors would keep seeing the old background until
  // the owner's next actual edit. Push it through on its own the moment the
  // theme changes, same debounce pattern as everything else here.
  useEffect(() => {
    const projectId = useMapStore.getState().activeProjectId || 'default'
    clearTimeout(liveShareSaveTimeout.current)
    liveShareSaveTimeout.current = setTimeout(() => {
      const { nodes, edges } = useMapStore.getState()
      useLiveShareStore.getState().pushUpdate(projectId, nodes, edges, themeName)
    }, 1200)
    return () => clearTimeout(liveShareSaveTimeout.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <ShareModal />
      <ProjectsDashboard />
      <StyleLibraryPanel />
      <NodeLibraryPanel />
      <ImageLightbox />
      <Whiteboard />
      <TradeAnalysis />
      <TradeLinkPickerModal />
      <TradeDetailModal />
      <ChecklistPanel />
    </div>
  )
}
