import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Section — Checklist Library. Lets someone build their own named
// checklists (e.g. "Trade Setup", "Daily Review"), each holding any number
// of checkbox items, independently of any single node — then apply any of
// those checklists to any node from the canvas. A checklist's name/items
// live centrally here; whether a given item is *checked* is per-node state
// stored on that node's own data (see applyChecklistToNode /
// toggleChecklistItemOnNode in mapStore.js) — the same "shared definition,
// per-instance progress" split Trade Analysis uses for validationRules vs
// a trade's validationRuleIds.

const initialState = {
  checklists: [], // { id, name, items: [{ id, label }], createdAt }
}

export const useChecklistStore = create(
  persist(
    (set) => ({
      ...initialState,

      addChecklist: (name) => {
        const id = crypto.randomUUID()
        set((s) => ({
          checklists: [
            ...s.checklists,
            { id, name: (name || '').trim() || 'Untitled checklist', items: [], createdAt: Date.now() },
          ],
        }))
        return id
      },
      renameChecklist: (id, name) =>
        set((s) => ({ checklists: s.checklists.map((c) => (c.id === id ? { ...c, name } : c)) })),
      deleteChecklist: (id) => set((s) => ({ checklists: s.checklists.filter((c) => c.id !== id) })),

      addChecklistItem: (checklistId, label) => {
        const trimmed = (label || '').trim()
        if (!trimmed) return
        set((s) => ({
          checklists: s.checklists.map((c) =>
            c.id === checklistId ? { ...c, items: [...c.items, { id: crypto.randomUUID(), label: trimmed }] } : c
          ),
        }))
      },
      updateChecklistItemLabel: (checklistId, itemId, label) =>
        set((s) => ({
          checklists: s.checklists.map((c) =>
            c.id === checklistId
              ? { ...c, items: c.items.map((it) => (it.id === itemId ? { ...it, label } : it)) }
              : c
          ),
        })),
      deleteChecklistItem: (checklistId, itemId) =>
        set((s) => ({
          checklists: s.checklists.map((c) =>
            c.id === checklistId ? { ...c, items: c.items.filter((it) => it.id !== itemId) } : c
          ),
        })),
      moveChecklistItem: (checklistId, itemId, direction) =>
        set((s) => ({
          checklists: s.checklists.map((c) => {
            if (c.id !== checklistId) return c
            const idx = c.items.findIndex((it) => it.id === itemId)
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1
            if (idx === -1 || swapIdx < 0 || swapIdx >= c.items.length) return c
            const next = [...c.items]
            ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
            return { ...c, items: next }
          }),
        })),
    }),
    { name: 'mindmap-checklist-storage' }
  )
)
