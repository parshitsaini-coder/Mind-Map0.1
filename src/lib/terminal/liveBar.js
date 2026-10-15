// A tiny observable holding the newest REAL candle of one chart (plus the close before it), so the
// status line can re-render on every live tick without reading refs during render.
export function createLiveBar() {
  let value = { last: null, prevClose: null }
  const subs = new Set()
  return {
    get: () => value,
    set: (next) => { value = next; subs.forEach((f) => f()) },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f) },
  }
}
