// Tiny observable for what is on screen right now (Phase 13): the current popup, the stop-out banner, and whether the
// adaptive guard has dropped motion to "reduced". Plain module state + useSyncExternalStore in the components.
let state = { popup: null, banner: null, degraded: false, margin: 'none' }
let seq = 0
const subs = new Set()
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()) }

export const getFx = () => state
export const subscribeFx = (f) => { subs.add(f); return () => subs.delete(f) }
// A new popup REPLACES the current one (it never piles up). `key` changes so the component animates the swap.
export const showPopup = (model, ms) => set({ popup: { ...model, key: ++seq, ms } })
export const hidePopup = (key) => { if (!state.popup || (key != null && state.popup.key !== key)) return; set({ popup: null }) }
export const showBanner = (banner) => set({ banner: { ...banner, key: ++seq } })
export const hideBanner = () => { if (state.banner) set({ banner: null }) }
export const setDegraded = (v) => { if (state.degraded !== !!v) set({ degraded: !!v }) }
// margin: 'none' | 'ok' | 'warn' | 'danger' (written by MarginWatch; the chart border and the account strip pulse from it)
export const setMargin = (m) => { if (state.margin !== m) set({ margin: m }) }
export const resetFx = () => { state = { popup: null, banner: null, degraded: false, margin: 'none' }; subs.forEach((f) => f()) }
