import { useEffect, useRef, useState } from 'react'

// How long a node/edge stays rendered (fading via the global CSS opacity
// transition on `.react-flow__node` / `.react-flow__edge-path`) after it's
// been marked hidden, before actually being filtered out of what's passed
// to React Flow. Without this, collapsing a branch would pop its children
// out of existence the instant `computeHidden` marks them — React Flow has
// no built-in exit animation for a node leaving the `nodes` array.
const EXIT_MS = 280

// `hiddenIds` is expected to be a fresh Set each render (computeHidden
// recomputes it from nodes/edges) — this hook only reacts to its actual
// membership changing, not the object identity, via `hiddenKey`.
export function useDeferredHidden(hiddenIds) {
  const [exitingIds, setExitingIds] = useState(() => new Set())
  const [removedIds, setRemovedIds] = useState(() => new Set())
  const timers = useRef(new Map())
  const hiddenKey = [...hiddenIds].sort().join(',')

  useEffect(() => {
    // Newly hidden — start the fade, then actually remove after EXIT_MS.
    hiddenIds.forEach((id) => {
      if (removedIds.has(id) || exitingIds.has(id) || timers.current.has(id)) return
      setExitingIds((prev) => new Set(prev).add(id))
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id)
          setExitingIds((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          setRemovedIds((prev) => new Set(prev).add(id))
        }, EXIT_MS)
      )
    })

    // No longer hidden (branch re-expanded before the fade finished, or
    // right after) — cancel any pending removal and show it again.
    ;[...exitingIds, ...removedIds].forEach((id) => {
      if (hiddenIds.has(id)) return
      const t = timers.current.get(id)
      if (t) {
        clearTimeout(t)
        timers.current.delete(id)
      }
      setExitingIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setRemovedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    })
    // Only the actual membership of hiddenIds should re-run this — see
    // hiddenKey above. exitingIds/removedIds are read as of this commit,
    // which is exactly what's wanted (no separate re-run needed for those).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])

  return { exitingIds, removedIds }
}
