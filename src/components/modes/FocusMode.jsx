// Section 4.6 — focus mode. Returns the set of node ids belonging to the
// same branch as `nodeId` (its ancestors and all its descendants), so the
// canvas can dim everything else.
export function getSubtreeIds(nodeId, edges) {
  const treeEdges = edges.filter((e) => e.type !== 'crossEdge')
  const ids = new Set([nodeId])

  const descend = (id) => {
    treeEdges
      .filter((e) => e.source === id)
      .forEach((e) => {
        if (!ids.has(e.target)) {
          ids.add(e.target)
          descend(e.target)
        }
      })
  }
  const ascend = (id) => {
    treeEdges
      .filter((e) => e.target === id)
      .forEach((e) => {
        if (!ids.has(e.source)) {
          ids.add(e.source)
          ascend(e.source)
        }
      })
  }
  descend(nodeId)
  ascend(nodeId)
  return ids
}
