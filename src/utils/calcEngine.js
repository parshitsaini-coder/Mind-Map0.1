// Section — Connector Calculations. A connector (edge) between two nodes
// can be tagged with a math operator via its right-click menu
// (ConnectorCalcMenu.jsx): +, -, *, /, or =. A run of operator-tagged
// connectors reads left to right like a tiny expression — e.g.
// node(2) --(+)--> node(4) --(=)--> node(?) — and nothing is actually
// calculated until an "=" connector is hit; at that point the accumulated
// result of everything before it is written into the "=" connector's
// target node. Chains can continue past an "=" (its target becomes the
// next operand for further connectors), so multi-step math works the same
// way a small spreadsheet chain would: change any input and every "="
// downstream of it recalculates.
//
// This module is intentionally pure (plain nodes/edges in, a list of
// { id, label } updates out) so it can be called from any store action
// that might affect a calculation without needing store access itself.

export const CALC_OPERATORS = ['+', '-', '*', '/', '=']
const CHAIN_OPERATORS = new Set(['+', '-', '*', '/'])

function toNumber(label) {
  if (label === undefined || label === null || label === '') return NaN
  const n = parseFloat(String(label).trim())
  return Number.isFinite(n) ? n : NaN
}

function applyOp(acc, op, operand) {
  if (!Number.isFinite(acc) || !Number.isFinite(operand)) return NaN
  switch (op) {
    case '+':
      return acc + operand
    case '-':
      return acc - operand
    case '*':
      return acc * operand
    case '/':
      return operand === 0 ? NaN : acc / operand
    default:
      return NaN
  }
}

// Formats a computed value back into a node label — whole numbers stay
// clean ("6" not "6.0000"), decimals round to 4dp to swallow float noise
// (0.1 + 0.2 style artifacts) without hiding a real fractional result.
function formatResult(value) {
  if (!Number.isFinite(value)) return null
  const rounded = Math.round(value * 10000) / 10000
  return String(rounded)
}

export function computeCalcUpdates(nodes, edges) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const calcEdges = edges.filter((e) => CALC_OPERATORS.includes(e.data?.calcOp))
  if (!calcEdges.length) return []

  const incomingChainOp = new Map() // targetId -> edge whose calcOp is +,-,*,/
  const incomingEquals = new Map() // targetId -> edge whose calcOp is =
  const edgeBetween = new Map() // "source->target" -> edge
  calcEdges.forEach((e) => {
    edgeBetween.set(`${e.source}->${e.target}`, e)
    if (e.data.calcOp === '=') incomingEquals.set(e.target, e)
    else incomingChainOp.set(e.target, e)
  })

  const valueCache = new Map()

  function getValue(nodeId, visiting) {
    if (valueCache.has(nodeId)) return valueCache.get(nodeId)
    if (visiting.has(nodeId)) return NaN // circular connector chain — bail out safely
    const eqEdge = incomingEquals.get(nodeId)
    let value
    if (eqEdge) {
      visiting.add(nodeId)
      value = evalChainEndingAt(eqEdge.source, visiting)
      visiting.delete(nodeId)
    } else {
      value = toNumber(nodesById.get(nodeId)?.data?.label)
    }
    valueCache.set(nodeId, value)
    return value
  }

  function evalChainEndingAt(nodeId, visiting) {
    // Walk backwards through consecutive +,-,*,/ connectors to find where
    // this expression segment actually starts, then reduce left to right.
    const path = [nodeId]
    let cursor = nodeId
    let guard = 0
    while (incomingChainOp.has(cursor) && guard++ < 500) {
      cursor = incomingChainOp.get(cursor).source
      path.unshift(cursor)
    }
    let acc = getValue(path[0], visiting)
    for (let i = 1; i < path.length; i++) {
      const edge = edgeBetween.get(`${path[i - 1]}->${path[i]}`)
      acc = applyOp(acc, edge?.data?.calcOp, getValue(path[i], visiting))
    }
    return acc
  }

  const updates = []
  incomingEquals.forEach((_eqEdge, targetId) => {
    const value = getValue(targetId, new Set())
    const label = formatResult(value)
    const currentLabel = nodesById.get(targetId)?.data?.label
    if (label !== null && label !== currentLabel) {
      updates.push({ id: targetId, label })
    }
  })
  return updates
}
