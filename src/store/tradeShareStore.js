import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTradeShare, endTradeShare, fetchTradeShareViewCounts, updateTradeShareData, fetchOwnActiveTradeShares } from '../lib/tradeShare'
import { useUiStore } from './uiStore'
import { applyFilters } from '../utils/tradeFilters'

// Last payload pushed per link — skips network writes when nothing changed.
const lastSynced = new Map()
let warned = false

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
      // Returns { found, updated, error } so callers (the "Sync now" button)
      // can tell the person exactly what happened.
      syncActiveLinks: async ({ userId, trades, validationRules, force = false }) => {
        const rows = await fetchOwnActiveTradeShares(userId)
        const result = { found: rows.length, updated: 0, error: null }
        for (const row of rows) {
          let shared = applyFilters(trades, row.filters || {})
          // "Validation details" off: remembered on the link itself. Older
          // links didn't store it, so fall back to what's already published
          // — a hidden link's trades carry no validationRuleIds key at all.
          const hideValidation =
            row.filters?.hideValidation ?? (row.first_trade ? !('validationRuleIds' in row.first_trade) : false)
          if (hideValidation) shared = shared.map(({ validationRuleIds, validationScore, ...rest }) => rest)
          const ruleIds = new Set(hideValidation ? [] : shared.flatMap((t) => t.validationRuleIds || []))
          const rules = validationRules.filter((r) => ruleIds.has(r.id))
          const payload = JSON.stringify([shared, rules])
          if (!force && lastSynced.get(row.id) === payload) continue
          const { error } = await updateTradeShareData(row.id, { trades: shared, validationRules: rules })
          if (error) {
            console.warn('[trade share sync]', row.id, error)
            result.error = error
            if (!warned) { warned = true; useUiStore.getState().showToast(`Share link sync failed: ${error}`) }
          } else {
            lastSynced.set(row.id, payload)
            result.updated += 1
          }
        }
        return result
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
