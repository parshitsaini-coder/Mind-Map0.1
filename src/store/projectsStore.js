import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchAllProjectsCloud, upsertProjectCloud } from '../lib/projectCloudSync'

// ---------------------------------------------------------------------------
// Multi-project support.
//
// Each *project* is a separate saved mind map (its own nodes/edges/groups),
// identified by an id. This store only keeps lightweight metadata (name,
// timestamps, a tiny preview) plus which projects are open as tabs / which
// tab is active. The actual heavy nodes/edges payload for each project lives
// in its own localStorage key (`mindmap-project-data-<id>`) so switching
// projects doesn't require rewriting one giant blob, and mirrors the pattern
// mapStore already uses for its own `mindmap-storage` persistence.
//
// mapStore is the "live" editing surface — whatever is currently on the
// canvas. Switching the active project asks mapStore to hand over a
// snapshot (saved into the outgoing project's data key) and then load the
// incoming project's saved data back into mapStore.
// ---------------------------------------------------------------------------

let idCounter = 1
const nextProjectId = () => `proj_${Date.now()}_${idCounter++}`

const dataKey = (id) => `mindmap-project-data-${id}`

export function readProjectData(id) {
  try {
    return JSON.parse(localStorage.getItem(dataKey(id)) || 'null')
  } catch {
    return null
  }
}

export function writeProjectData(id, data) {
  try {
    localStorage.setItem(dataKey(id), JSON.stringify(data))
  } catch {
    // Storage full or unavailable — fail silently, same as the rest of the
    // app's localStorage usage.
  }
}

export function deleteProjectData(id) {
  localStorage.removeItem(dataKey(id))
}

// One-time migration: if someone is updating from the single-map version of
// this app, their existing `mindmap-storage` data becomes their first
// project instead of disappearing.
function migrateLegacyMapIfNeeded(projects) {
  if (projects.length > 0) return projects
  let legacy = null
  try {
    const raw = JSON.parse(localStorage.getItem('mindmap-storage') || 'null')
    legacy = raw?.state
  } catch {
    legacy = null
  }
  const id = nextProjectId()
  const now = Date.now()
  if (legacy?.nodes?.length) {
    writeProjectData(id, {
      nodes: legacy.nodes,
      edges: legacy.edges || [],
      groups: legacy.groups || [],
      activityLog: legacy.activityLog || [],
    })
    return [{ id, name: 'My Mind Map', createdAt: now, updatedAt: now }]
  }
  return [{ id, name: 'My Mind Map', createdAt: now, updatedAt: now }]
}

export const useProjectsStore = create(
  persist(
    (set, get) => ({
      projects: [], // [{ id, name, createdAt, updatedAt }]
      openTabs: [], // [projectId, ...] in tab order
      activeProjectId: null,
      dashboardOpen: false,

      // Called once on app start.
      init: () => {
        if (get().projects.length > 0) return
        const projects = migrateLegacyMapIfNeeded([])
        set({ projects, openTabs: [projects[0].id], activeProjectId: projects[0].id })
      },

      openDashboard: () => set({ dashboardOpen: true }),
      closeDashboard: () => set({ dashboardOpen: false }),

      createProject: (name) => {
        const id = nextProjectId()
        const now = Date.now()
        const project = { id, name: name?.trim() || 'Untitled Mind Map', createdAt: now, updatedAt: now }
        writeProjectData(id, { nodes: [], edges: [], groups: [], activityLog: [] })
        set((s) => ({
          projects: [project, ...s.projects],
          openTabs: [...s.openTabs, id],
          activeProjectId: id,
          dashboardOpen: false,
        }))
        return id
      },

      renameProject: (id, name) => {
        if (!name?.trim()) return
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim(), updatedAt: Date.now() } : p)),
        }))
      },

      deleteProject: (id) => {
        deleteProjectData(id)
        set((s) => {
          const projects = s.projects.filter((p) => p.id !== id)
          const openTabs = s.openTabs.filter((t) => t !== id)
          let activeProjectId = s.activeProjectId
          if (activeProjectId === id) {
            activeProjectId = openTabs[openTabs.length - 1] || null
          }
          return { projects, openTabs, activeProjectId }
        })
      },

      // Opens a project as a tab (if not already open) and makes it active.
      // Returns the id so callers can immediately load its data into mapStore.
      openProject: (id) => {
        set((s) => ({
          openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
          activeProjectId: id,
          dashboardOpen: false,
        }))
        return id
      },

      switchTab: (id) => set({ activeProjectId: id }),

      closeTab: (id) => {
        set((s) => {
          const openTabs = s.openTabs.filter((t) => t !== id)
          let activeProjectId = s.activeProjectId
          if (activeProjectId === id) {
            activeProjectId = openTabs[openTabs.length - 1] || null
          }
          return { openTabs, activeProjectId, dashboardOpen: openTabs.length === 0 ? true : s.dashboardOpen }
        })
      },

      touchActiveProject: () => {
        const { activeProjectId } = get()
        if (!activeProjectId) return
        set((s) => ({
          projects: s.projects.map((p) => (p.id === activeProjectId ? { ...p, updatedAt: Date.now() } : p)),
        }))
      },

      // Pulls every cloud-backed project this account has and adds whichever
      // ones aren't already in this browser's local list — never touches or
      // removes anything already here. This is the recovery path: sign in on
      // a fresh/cleared browser and any project that ever made it to the
      // cloud (pushed by the autosave in App.jsx from *any* device) reappears
      // in the dashboard. Deliberately additive-only so a first-time device
      // with an empty cloud row can never wipe real local data, and a device
      // with its own not-yet-synced projects never loses them either.
      mergeFromCloud: async (userId) => {
        const { data, error } = await fetchAllProjectsCloud(userId)
        if (error || !data?.length) return
        set((s) => {
          const localIds = new Set(s.projects.map((p) => p.id))
          const additions = []
          for (const row of data) {
            if (localIds.has(row.project_id)) continue
            writeProjectData(row.project_id, {
              nodes: row.nodes || [],
              edges: row.edges || [],
              groups: row.groups || [],
              activityLog: row.activity_log || [],
            })
            const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
            additions.push({ id: row.project_id, name: row.name || 'Untitled Mind Map', createdAt: ts, updatedAt: ts })
          }
          if (!additions.length) return {}
          return { projects: [...s.projects, ...additions] }
        })

        // Reverse direction: any project that exists locally but never made
        // it to this cloud account (e.g. created while signed out, or on a
        // device that was offline) gets pushed up now too — otherwise it'd
        // only sync up on that project's *next* edit, and would be invisible
        // to mergeFromCloud on another device until then.
        const cloudIds = new Set(data.map((row) => row.project_id))
        for (const p of get().projects) {
          if (cloudIds.has(p.id)) continue
          const pdata = readProjectData(p.id)
          upsertProjectCloud(userId, { id: p.id, name: p.name, ...(pdata || {}), updatedAt: p.updatedAt })
        }
      },
    }),
    { name: 'mindmap-projects', partialize: (s) => ({ projects: s.projects, openTabs: s.openTabs, activeProjectId: s.activeProjectId }) }
  )
)
