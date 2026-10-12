import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTradeShare, endTradeShare, fetchTradeShareViewCounts } from '../lib/tradeShare'

// Remembers every Trade Analysis share link this browser has created — just
// the small pointer (id/expiry/summary), never the trade snapshot itself —
// so the Share popup can list "your active links" and end one, and the
// Share button can show a small live-count badge. Separate from
// liveShareStore (the mind-map's own live-link feature) since a person can
// have several of these alive at once instead of one-per-project.
export const useTradeShareStore = create(
  persist(
    (set, get) => ({
      // [{ id, expiryValue, expiresAt, endedAt, createdAt, summary }]
      links: [],

      activeLinks: () => {
        const now = Date.now()
        return get().links.filter(
          (l) => !l.endedAt && (!l.expiresAt || new Date(l.expiresAt).getTime() > now)
        )
      },

      create: async ({ userId, trades, validationRules, filters, themeName, expiryValue, summary }) => {
        const result = await createTradeShare({ userId, trades, validationRules, filters, themeName, expiryValue })
        if (result.error) return { error: result.error }
        set((s) => ({
          links: [
            {
              id: result.id,
              expiryValue,
              expiresAt: result.expiresAt,
              endedAt: null,
              createdAt: new Date().toISOString(),
              summary,
            },
            ...s.links,
          ],
        }))
        return { id: result.id }
      },

      end: async (id) => {
        await endTradeShare(id)
        set((s) => ({
          links: s.links.map((l) => (l.id === id ? { ...l, endedAt: new Date().toISOString() } : l)),
        }))
      },

      // Pulls the latest "who's viewed this" counts from Supabase and merges
      // them onto the locally-remembered links (view_count itself only ever
      // lives server-side — it climbs every time a visitor opens the link,
      // from any browser, so this browser's own copy would go stale
      // instantly without a refresh). Called when the Share popup opens.
      refreshViewCounts: async (userId) => {
        const counts = await fetchTradeShareViewCounts(userId)
        if (!counts || Object.keys(counts).length === 0) return
        set((s) => ({
          links: s.links.map((l) => (l.id in counts ? { ...l, viewCount: counts[l.id] } : l)),
        }))
      },
    }),
    { name: 'trade-analysis-shares' }
  )
)
