import { buildForest } from './layoutUtils'

const LEVEL_GAP = 115
const BRANCH_GAP = 210
const ROOT_COL_GAP = 900

export function logicChartLayout(nodes, edges) {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}

  roots.forEach((rootId, rootIdx) => {
    const baseX = rootIdx * ROOT_COL_GAP
    positions[rootId] = { x: baseX, y: 0 }

    const place = (id, depth, x) => {
      const kids = childrenMap.get(id) || []
      kids.forEach((childId, i) => {
        const childX = kids.length === 1 ? x : x + (i - (kids.length - 1) / 2) * BRANCH_GAP
        positions[childId] = { x: childX, y: depth * LEVEL_GAP }
        place(childId, depth + 1, childX)
      })
    }
    place(rootId, 1, baseX)
  })

  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n))
}
