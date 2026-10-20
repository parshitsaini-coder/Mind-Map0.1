import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTradeShare, endTradeShare, fetchTradeShareViewCounts, updateTradeShareData, fetchOwnTradeShareFilters } from '../lib/tradeShare'
import { applyFilters } from '../utils/tradeFilters'

// Last payload pushed per link — skips network writes when nothing changed.
const lastSynced = new Map()

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
              filters,
            },
            ...s.links,
          ],
        }))
        return { id: result.id }
      },

      // Keeps every active link in step with the owner's trades: re-applies
      // each link's saved filters to the current trades and uploads the
      // result when it changed. Called (debounced) from App on any edit.
      syncActiveLinks: async ({ trades, validationRules }) => {
        const links = get().activeLinks()
        for (const l of links) {
          let filters = l.filters
          if (!filters) {
            filters = await fetchOwnTradeShareFilters(l.id)
            if (!filters) continue
            set((s) => ({ links: s.links.map((x) => (x.id === l.id ? { ...x, filters } : x)) }))
          }
          const shared = applyFilters(trades, filters)
          const ruleIds = new Set(shared.flatMap((t) => t.validationRuleIds || []))
          const rules = validationRules.filter((r) => ruleIds.has(r.id))
          const payload = JSON.stringify([shared, rules])
          if (lastSynced.get(l.id) === payload) continue
          const prev = lastSynced.get(l.id)
          lastSynced.set(l.id, payload)
          const { error } = await updateTradeShareData(l.id, { trades: shared, validationRules: rules })
          if (error) { if (prev === undefined) lastSynced.delete(l.id); else lastSynced.set(l.id, prev) }
        }
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
