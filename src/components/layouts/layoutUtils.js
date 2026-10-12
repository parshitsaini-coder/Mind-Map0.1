// Shared helpers used by every layout algorithm in this folder.
// A "tree" edge is any edge that isn't a cross-branch relationship edge
// (type 'crossEdge') — those are ignored for layout purposes since they
// don't define hierarchy.

export function buildForest(nodes, edges) {
  const realNodes = nodes.filter((n) => n.type !== 'boundaryGroup')
  const treeEdges = edges.filter((e) => e.type !== 'crossEdge')

  const childrenMap = new Map()
  const hasParent = new Set()
  realNodes.forEach((n) => childrenMap.set(n.id, []))
  treeEdges.forEach((e) => {
    if (childrenMap.has(e.source) && childrenMap.has(e.target)) {
      childrenMap.get(e.source).push(e.target)
      hasParent.add(e.target)
    }
  })

  const roots = realNodes
    .filter((n) => n.data?.isRoot || !hasParent.has(n.id))
    .map((n) => n.id)

  // De-dupe (a node could be both isRoot and parentless)
  const uniqueRoots = [...new Set(roots)]

  return { childrenMap, roots: uniqueRoots }
}

export function nodeSize(node) {
  return {
    w: node.measured?.width ?? 130,
    h: node.measured?.height ?? 36,
  }
}

// Depth-first count of leaves under a node — used to allocate horizontal
// space proportionally in tree-style layouts.
//
// Section 14 — perf pass: an optional `memo` cache is threaded through the
// recursion. Without it, orgChartLayout calls this once per node in the
// tree, and each call used to re-walk its entire subtree from scratch — for
// a tree of n nodes that's O(n^2) (e.g. a single long chain re-counts a
// shrinking subtree n times). With the cache, each node's leaf count is
// computed once and reused, so the whole layout is O(n).
//
// `visiting` guards against a cyclic childrenMap (e.g. a connector edge
// that loops back to an ancestor) — without it, two nodes that are each
// other's descendant recurse forever and crash the tab with a stack
// overflow. A node already on the current path is treated as a leaf
// (count 1) instead of being walked again.
export function countLeaves(id, childrenMap, memo = new Map(), visiting = new Set()) {
  if (memo.has(id)) return memo.get(id)
  if (visiting.has(id)) return 1
  visiting.add(id)
  const kids = childrenMap.get(id) || []
  const result = kids.length === 0 ? 1 : kids.reduce((sum, c) => sum + countLeaves(c, childrenMap, memo, visiting), 0)
  visiting.delete(id)
  memo.set(id, result)
  return result
}
