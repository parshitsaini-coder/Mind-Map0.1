import { buildForest } from './layoutUtils'

const RADIUS_STEP = 190
const ROOT_SPACING_X = 700

export function radialLayout(nodes, edges) {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}

  roots.forEach((rootId, rootIndex) => {
    const cx = rootIndex * ROOT_SPACING_X
    const cy = 0
    positions[rootId] = { x: cx, y: cy }

    const visited = new Set()
    const place = (id, depth, angleStart, angleEnd) => {
      if (visited.has(id)) return // cyclic childrenMap — stop instead of recursing forever
      visited.add(id)
      const kids = childrenMap.get(id) || []
      if (kids.length === 0) return
      const span = angleEnd - angleStart
      const step = span / kids.length
      kids.forEach((childId, i) => {
        const angle = angleStart + step * (i + 0.5)
        const radius = RADIUS_STEP * depth
        positions[childId] = {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        }
        // Give each child a slice of the full circle proportional to its own branch
        place(childId, depth + 1, angle - step / 2, angle + step / 2)
      })
    }

    place(rootId, 1, -Math.PI, Math.PI)
  })

  return nodes.map((n) =>
    positions[n.id] ? { ...n, position: positions[n.id] } : n
  )
}
