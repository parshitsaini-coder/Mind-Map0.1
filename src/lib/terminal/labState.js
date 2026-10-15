// Tiny observable for the dev-only "Effects playground" (open with ?lab=1 in dev builds, or tap the version 5 times in Settings).
let open = false
const subs = new Set()
export const isLabOpen = () => open
export const setLabOpen = (v) => { open = !!v; subs.forEach((f) => f()) }
export const subscribeLab = (f) => { subs.add(f); return () => subs.delete(f) }
export const labAllowed = () => {
  try { return !!import.meta.env.DEV || localStorage.getItem('terminal-lab') === '1' } catch { return false }
}
