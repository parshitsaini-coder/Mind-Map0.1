// Section 4.6 — expand/collapse branches. Given the current nodes/edges,
// return the set of node & edge ids that should be hidden because an
// ancestor is collapsed.
//
// `revealManualHidden` controls how a node manually hidden via
// toggleHidden (the Outline View's eye icon, or the canvas node's own
// right-click "Hide node") is treated:
//   - false (default) — the node AND its descendants disappear entirely.
//     Used by the read-only Shared Map View so a link never leaks a node
//     the owner chose to hide.
//   - true — the node itself stays on the canvas (CustomNode.jsx renders
//     it as a small clickable eye placeholder instead of its normal
//     contents) and its children are left untouched, so only that one
//     node's own contents are hidden. Used by the editable canvas, where
//     clicking the eye reveals the node again.
export function computeHidden(nodes, edges, { revealManualHidden = false } = {}) {
  const treeEdges = edges.filter((e) => e.type !== 'crossEdge')
  const childrenMap = new Map()
  treeEdges.forEach((e) => {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, [])
    childrenMap.get(e.source).push(e.target)
  })

  const collapsedIds = nodes.filter((n) => n.data?.collapsed).map((n) => n.id)
  // Nodes explicitly hidden from the Outline View (see toggleHidden in
  // mapStore) are hidden themselves plus all of their descendants — unless
  // revealManualHidden asked us to keep just this one node visible.
  const manuallyHiddenIds = nodes.filter((n) => n.data?.hidden).map((n) => n.id)
  const hiddenNodeIds = new Set(revealManualHidden ? [] : manuallyHiddenIds)

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
  if (!revealManualHidden) manuallyHiddenIds.forEach(hideDescendants)

  const hiddenEdgeIds = new Set(
    edges.filter((e) => hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target)).map((e) => e.id)
  )

  return { hiddenNodeIds, hiddenEdgeIds, childrenMap }
}
