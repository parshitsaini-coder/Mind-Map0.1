import { useEffect } from 'react'
import { useStrategyTesterStore } from '../store/strategyTesterStore'
import { useAuthStore } from '../store/authStore'
import { fetchOwnStrategyShares, updateStrategyShareData } from '../lib/strategyShare'

// Keeps every active share link in step with the owner's edits: while the
// Strategy Tester is open, any change to a strategy that has a live link is
// pushed (debounced) so visitors see new entries without a new link.
export function useStrategyShareSync(active) {
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!active || !userId) return undefined
    let cancelled = false
    let byStrategy = {} // strategyId -> [shareId]
    let timer = null
    let last = { strategies: null, entries: null }

    const load = async () => {
      const rows = await fetchOwnStrategyShares(userId)
      if (cancelled) return
      byStrategy = {}
      for (const r of rows) (byStrategy[r.strategy_id] ||= []).push(r.id)
    }

    const push = () => {
      const s = useStrategyTesterStore.getState()
      for (const [sid, ids] of Object.entries(byStrategy)) {
        const strategy = s.strategies.find((x) => x.id === sid)
        if (!strategy) continue
        for (const id of ids) updateStrategyShareData(id, { strategy, entries: s.entries, themeName: s.theme })
      }
    }

    load().then(() => {
      last = { strategies: useStrategyTesterStore.getState().strategies, entries: useStrategyTesterStore.getState().entries }
    })
    const unsub = useStrategyTesterStore.subscribe((s) => {
      if (s.strategies === last.strategies && s.entries === last.entries) return
      last = { strategies: s.strategies, entries: s.entries }
      if (!Object.keys(byStrategy).length) return
      clearTimeout(timer)
      timer = setTimeout(push, 2500)
    })
    // The modal creates / ends links — let it tell us to reload the list.
    const onChanged = () => load()
    window.addEventListener('strategy-share-changed', onChanged)

    return () => {
      cancelled = true
      clearTimeout(timer)
      unsub()
      window.removeEventListener('strategy-share-changed', onChanged)
    }
  }, [active, userId])
}
