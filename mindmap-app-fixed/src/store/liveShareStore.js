import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertLiveShare, pushLiveShareUpdate, endLiveShare } from '../lib/liveShare'
import { buildSharePayload } from '../utils/exportShareLink'

// Remembers, per project, which live share link (if any) is currently
// active — just the small pointer (id/expiry/ended-at), not the map data
// itself, so this stays tiny in localStorage and survives page reloads on
// the owner's own browser (App.jsx's auto-sync effect reads it to know
// whether to push edits up to Supabase).
export const useLiveShareStore = create(
  persist(
    (set, get) => ({
      // { [projectId]: { id, expiryValue, expiresAt, endedAt } }
      links: {},

      // Null once expired/ended, even before the next Supabase round trip
      // confirms it — keeps the UI honest without waiting on a request.
      getActiveLink: (projectId) => {
        const link = get().links[projectId]
        if (!link || link.endedAt) return null
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null
        return link
      },

      // Creates a new live link, or updates the existing one for this
      // project (new expiry, latest content) and keeps the same URL.
      createOrUpdate: async ({ userId, projectId, nodes, edges, expiryValue }) => {
        if (!projectId) return { error: 'Open a project first.' }
        const existing = get().links[projectId]
        const payload = buildSharePayload(nodes, edges)
        const result = await upsertLiveShare({
          userId,
          projectId,
          payload,
          expiryValue,
          existingId: existing && !existing.endedAt ? existing.id : null,
        })
        if (result.error) return { error: result.error }
        set((s) => ({
          links: {
            ...s.links,
            [projectId]: { id: result.id, expiryValue, expiresAt: result.expiresAt, endedAt: null },
          },
        }))
        return { id: result.id }
      },

      // Debounced push from App.jsx on every map change — no-op unless this
      // project currently has an active (not ended/expired) live link.
      pushUpdate: async (projectId, nodes, edges) => {
        const link = get().getActiveLink(projectId)
        if (!link) return
        await pushLiveShareUpdate(link.id, buildSharePayload(nodes, edges))
      },

      endSession: async (projectId) => {
        const link = get().links[projectId]
        if (!link) return
        await endLiveShare(link.id)
        set((s) => ({
          links: { ...s.links, [projectId]: { ...link, endedAt: new Date().toISOString() } },
        }))
      },
    }),
    { name: 'mindmap-live-shares' }
  )
)
