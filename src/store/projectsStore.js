import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchProjectsMetaCloud, fetchProjectFullCloud, upsertProjectCloud } from '../lib/projectCloudSync'

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
        const project = { id, name: name?.trim() || 'Untitled Mind Map', createdAt: now, updatedAt: now, cloudSynced: false }
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

      markSynced: (id) => {
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, cloudSynced: true } : p)) }))
      },

      // Full two-way sync — this is what makes every device converge on the
      // exact same dashboard, not just recover from a wipe. Called on login,
      // and then repeatedly (poll + on window focus + on opening the
      // dashboard) from App.jsx while signed in:
      //   - cloud has a project this browser doesn't  -> add it here
      //   - both have it, cloud row is newer           -> pull cloud's copy
      //     down over the local one (name + full data)
      //   - both have it, this browser's copy is newer -> push it up
      //   - this browser has it but cloud doesn't, AND it was previously
      //     confirmed synced -> it was deleted on another device; remove it
      //     here too (a brand-new, never-yet-synced project is left alone)
      // The currently *open* project is skipped for incoming pulls only, so
      // a sync tick can never yank the canvas out from under someone mid-edit
      // — it still gets pushed up normally on its own debounce.
      syncWithCloud: async (userId) => {
        const { data: metaRows, error: metaErr } = await fetchProjectsMetaCloud(userId)
        if (metaErr) {
          console.warn('[project sync] list failed:', metaErr)
          return { error: metaErr, count: 0, added: 0 }
        }
        // Fetch full data only for projects we will actually write locally.
        const localById = new Map(get().projects.map((p) => [p.id, p]))
        const openId = get().activeProjectId
        const need = metaRows.filter((r) => {
          const lp = localById.get(r.project_id)
          if (!lp) return true
          const ts = r.updated_at ? new Date(r.updated_at).getTime() : 0
          return ts > (lp.updatedAt || 0) && lp.id !== openId
        })
        const fullById = new Map()
        for (let i = 0; i < need.length; i += 4) {
          const results = await Promise.all(need.slice(i, i + 4).map((r) => fetchProjectFullCloud(userId, r.project_id)))
          for (const res of results) {
            if (res.error || !res.data) {
              // Abort instead of guessing — a half-loaded list must never be
              // treated as "deleted elsewhere".
              console.warn('[project sync] project fetch failed:', res.error)
              return { error: res.error || 'project row missing', count: metaRows.length, added: 0 }
            }
            fullById.set(res.data.project_id, res.data)
          }
        }
        const data = metaRows.map((r) => fullById.get(r.project_id) || r)
        const cloudById = new Map(data.map((row) => [row.project_id, row]))
        const activeId = get().activeProjectId

        const addedCount = data.filter((r) => !localById.has(r.project_id)).length
        const kept = []
        for (const p of get().projects) {
          const row = cloudById.get(p.id)
          if (!row) {
            if (p.cloudSynced) {
              deleteProjectData(p.id) // deleted elsewhere — drop it here too
              continue
            }
            kept.push(p) // never synced yet — keep, will push below
            continue
          }
          const cloudTs = row.updated_at ? new Date(row.updated_at).getTime() : 0
          if (cloudTs > (p.updatedAt || 0)) {
            if (p.id !== activeId) {
              writeProjectData(p.id, {
                nodes: row.nodes || [],
                edges: row.edges || [],
                groups: row.groups || [],
                activityLog: row.activity_log || [],
              })
            }
            // Metadata (name) is safe to take from the cloud even for the
            // active project — only its live canvas *data* is protected.
            kept.push({ ...p, name: row.name || p.name, updatedAt: cloudTs, cloudSynced: true })
          } else {
            kept.push({ ...p, cloudSynced: true })
          }
          cloudById.delete(p.id)
        }

        // Whatever's left in cloudById exists only in the cloud -> add it.
        for (const row of cloudById.values()) {
          writeProjectData(row.project_id, {
            nodes: row.nodes || [],
            edges: row.edges || [],
            groups: row.groups || [],
            activityLog: row.activity_log || [],
          })
          const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
          kept.push({ id: row.project_id, name: row.name || 'Untitled Mind Map', createdAt: ts, updatedAt: ts, cloudSynced: true })
        }

        set((s) => {
          const keptIds = new Set(kept.map((p) => p.id))
          const openTabs = s.openTabs.filter((t) => keptIds.has(t))
          let activeProjectId = s.activeProjectId
          if (activeProjectId && !keptIds.has(activeProjectId)) {
            activeProjectId = openTabs[openTabs.length - 1] || null
          }
          return { projects: kept, openTabs, activeProjectId }
        })

        // Push up anything that was newer locally or never synced yet.
        const freshCloudIds = new Set(data.map((row) => row.project_id))
        for (const p of kept) {
          const row = data.find((r) => r.project_id === p.id)
          const cloudTs = row?.updated_at ? new Date(row.updated_at).getTime() : 0
          if (!freshCloudIds.has(p.id) || (p.updatedAt || 0) > cloudTs) {
            const pdata = readProjectData(p.id)
            const { error: pushErr } = await upsertProjectCloud(userId, { id: p.id, name: p.name, ...(pdata || {}), updatedAt: p.updatedAt })
            if (!pushErr) get().markSynced(p.id)
          }
        }
        return { error: null, count: data.length, added: addedCount }
      },
    }),
    { name: 'mindmap-projects', partialize: (s) => ({ projects: s.projects, openTabs: s.openTabs, activeProjectId: s.activeProjectId }) }
  )
)
