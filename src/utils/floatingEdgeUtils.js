import { Position } from '@xyflow/react'

// Section — "floating" connectors. Every other mind-map app reroutes a
// branch's connector to whichever side of the two nodes actually faces
// each other as soon as you drag one of them, instead of leaving it
// pinned to whatever handle (left/right/top/bottom) it happened to be
// created on. React Flow's default behaviour is the latter — a node
// dragged above/left of its parent still connects right-edge → left-edge,
// producing the long looping curves seen when a child ends up "behind"
// its parent.
//
// This computes, on every render, where a straight line between the two
// nodes' centers crosses each node's own rectangle border — that
// intersection point (and which side it lands on) becomes the edge's
// actual endpoint/Position, so CustomEdge/CrossEdge always draw from the
// nearest facing sides no matter how the nodes get moved around.
// Adapted from React Flow's own "floating edges" example.

function getNodeIntersection(intersectionNode, targetNode) {
  const intersectionNodeWidth = intersectionNode.measured?.width ?? intersectionNode.width ?? 140
  const intersectionNodeHeight = intersectionNode.measured?.height ?? intersectionNode.height ?? 40
  const intersectionNodePosition = intersectionNode.internals?.positionAbsolute ?? intersectionNode.position
  const targetPosition = targetNode.internals?.positionAbsolute ?? targetNode.position
  const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 140
  const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 40

  const w = intersectionNodeWidth / 2
  const h = intersectionNodeHeight / 2

  const x2 = intersectionNodePosition.x + w
  const y2 = intersectionNodePosition.y + h
  const x1 = targetPosition.x + targetWidth / 2
  const y1 = targetPosition.y + targetHeight / 2

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  const x = w * (xx3 + yy3) + x2
  const y = h * (-xx3 + yy3) + y2

  return { x, y }
}

function getEdgePosition(node, intersectionPoint) {
  const position = node.internals?.positionAbsolute ?? node.position
  const width = node.measured?.width ?? node.width ?? 140
  const height = node.measured?.height ?? node.height ?? 40
  const nx = Math.round(position.x)
  const ny = Math.round(position.y)
  const px = Math.round(intersectionPoint.x)
  const py = Math.round(intersectionPoint.y)

  if (px <= nx + 1) return Position.Left
  if (px >= nx + width - 1) return Position.Right
  if (py <= ny + 1) return Position.Top
  if (py >= ny + height - 1) return Position.Bottom
  return Position.Top
}

// Returns null if either node hasn't been measured/positioned yet (e.g.
// the very first render before React Flow lays it out), so callers can
// fall back to the fixed-handle coordinates React Flow already passed in.
export function getFloatingEdgeParams(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return null
  const sourcePos = sourceNode.internals?.positionAbsolute ?? sourceNode.position
  const targetPos = targetNode.internals?.positionAbsolute ?? targetNode.position
  if (!sourcePos || !targetPos) return null

  const sourceIntersectionPoint = getNodeIntersection(sourceNode, targetNode)
  const targetIntersectionPoint = getNodeIntersection(targetNode, sourceNode)

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos: getEdgePosition(sourceNode, sourceIntersectionPoint),
    targetPos: getEdgePosition(targetNode, targetIntersectionPoint),
  }
}
