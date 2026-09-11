import { buildForest } from './layoutUtils'

const SPINE_GAP = 220
const BRANCH_OFFSET = 140
const DEEPEN_GAP = 90
const ROOT_ROW_GAP = 520

export function fishboneLayout(nodes, edges) {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}

  roots.forEach((rootId, rootIdx) => {
    const baseY = rootIdx * ROOT_ROW_GAP
    positions[rootId] = { x: 0, y: baseY } // the "effect" — head of the fish

    const causes = childrenMap.get(rootId) || []
    causes.forEach((causeId, i) => {
      const dir = i % 2 === 0 ? -1 : 1 // alternate bones above/below the spine
      const spineX = -(i + 1) * SPINE_GAP
      positions[causeId] = { x: spineX, y: baseY + dir * BRANCH_OFFSET }

      const visited = new Set([causeId])
      const placeSubCauses = (id, depth) => {
        const kids = childrenMap.get(id) || []
        kids.forEach((kidId, j) => {
          if (visited.has(kidId)) return // cyclic childrenMap — stop instead of recursing forever
          visited.add(kidId)
          positions[kidId] = {
            x: spineX - depth * 40,
            y: baseY + dir * (BRANCH_OFFSET + depth * DEEPEN_GAP + j * 46),
          }
          placeSubCauses(kidId, depth + 1)
        })
      }
      placeSubCauses(causeId, 1)
    })
  })

  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n))
}
