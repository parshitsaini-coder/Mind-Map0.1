import { buildForest } from './layoutUtils'

const GRID_GAP_X = 220
const GRID_GAP_Y = 130
const SUB_GAP = 90
const ROOT_COL_GAP = 900

export function matrixLayout(nodes, edges) {
  const { childrenMap, roots } = buildForest(nodes, edges)
  const positions = {}

  roots.forEach((rootId, rootIdx) => {
    const baseX = rootIdx * ROOT_COL_GAP
    const baseY = 0
    positions[rootId] = { x: baseX, y: baseY }

    const kids = childrenMap.get(rootId) || []
    const cols = Math.max(1, Math.ceil(Math.sqrt(kids.length)))

    kids.forEach((childId, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const cx = baseX + (col - (cols - 1) / 2) * GRID_GAP_X
      const cy = baseY + 210 + row * GRID_GAP_Y
      positions[childId] = { x: cx, y: cy }

      const grandkids = childrenMap.get(childId) || []
      grandkids.forEach((gid, j) => {
        positions[gid] = {
          x: cx + (j - (grandkids.length - 1) / 2) * SUB_GAP,
          y: cy + 95,
        }
      })
    })
  })

  return nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n))
}
