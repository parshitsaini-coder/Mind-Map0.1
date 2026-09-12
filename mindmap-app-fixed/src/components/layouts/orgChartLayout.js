import { buildForest, countLeaves } from './layoutUtils'

const LEVEL_GAP = 150
const LEAF_GAP = 90
const ROOT_GAP = 120

// direction: 'vertical' (top-down, default org chart) or 'horizontal' (left-right tree)
export function orgChartLayout(nodes, edges, direction = 'vertical') {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}
  let cursor = 0
  // Section 14 — perf pass: one shared cache for the whole layout call, so
  // every node's leaf count is computed once instead of once per ancestor.
  const leafMemo = new Map()

  roots.forEach((rootId) => {
    const leaves = countLeaves(rootId, childrenMap, leafMemo)
    const start = cursor
    cursor += leaves * LEAF_GAP + ROOT_GAP

    const visited = new Set()
    const place = (id, depth, bandStart, bandEnd) => {
      if (visited.has(id)) return // cyclic childrenMap — stop instead of recursing forever
      visited.add(id)
      const mid = (bandStart + bandEnd) / 2
      if (direction === 'horizontal') {
        positions[id] = { x: depth * LEVEL_GAP, y: mid }
      } else {
        positions[id] = { x: mid, y: depth * LEVEL_GAP }
      }

      const kids = childrenMap.get(id) || []
      let kidCursor = bandStart
      kids.forEach((childId) => {
        const kidLeaves = countLeaves(childId, childrenMap, leafMemo)
        const kidBandEnd = kidCursor + kidLeaves * LEAF_GAP
        place(childId, depth + 1, kidCursor, kidBandEnd)
        kidCursor = kidBandEnd
      })
    }

    place(rootId, 0, start, start + leaves * LEAF_GAP)
  })

  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n))
}
