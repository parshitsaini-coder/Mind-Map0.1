import { buildForest } from './layoutUtils'

const TIMELINE_GAP = 230
const STACK_GAP = 70
const ROOT_ROW_GAP = 600

export function timelineLayout(nodes, edges) {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}

  roots.forEach((rootId, rootIdx) => {
    const baseY = rootIdx * ROOT_ROW_GAP
    positions[rootId] = { x: 0, y: baseY }

    const events = childrenMap.get(rootId) || []
    events.forEach((eventId, i) => {
      const x = (i + 1) * TIMELINE_GAP
      positions[eventId] = { x, y: baseY }

      let stack = 0
      const placeDescendants = (id) => {
        const kids = childrenMap.get(id) || []
        kids.forEach((kidId) => {
          stack += 1
          positions[kidId] = { x, y: baseY + stack * STACK_GAP }
          placeDescendants(kidId)
        })
      }
      placeDescendants(eventId)
    })
  })

  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n))
}
