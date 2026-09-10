// Section 4.6 — expand/collapse branches. Given the current nodes/edges,
// return the set of node & edge ids that should be hidden because an
// ancestor is collapsed.
export function computeHidden(nodes, edges) {
  const treeEdges = edges.filter((e) => e.type !== 'crossEdge')
  const childrenMap = new Map()
  treeEdges.forEach((e) => {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, [])
    childrenMap.get(e.source).push(e.target)
  })

  const collapsedIds = nodes.filter((n) => n.data?.collapsed).map((n) => n.id)
  const hiddenNodeIds = new Set()

  const hideDescendants = (id) => {
    const kids = childrenMap.get(id) || []
    kids.forEach((kidId) => {
      if (!hiddenNodeIds.has(kidId)) {
        hiddenNodeIds.add(kidId)
        hideDescendants(kidId)
      }
    })
  }
  collapsedIds.forEach(hideDescendants)

  const hiddenEdgeIds = new Set(
    edges.filter((e) => hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target)).map((e) => e.id)
  )

  return { hiddenNodeIds, hiddenEdgeIds, childrenMap }
}
