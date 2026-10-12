import { Position } from '@xyflow/react'

// Section — "floating" connectors. Every other mind-map app reroutes a
// branch's connector to whichever side of the two nodes actually faces
// each other as soon as you drag one of them, instead of leaving it
// pinned to whatever handle (left/right/top/bottom) it happened to be
// created on. React Flow's default behaviour is the latter — a node
// dragged above/left of its parent still connects right-edge → left-edge,
// producing long looping curves.
//
// First pass here computed the *exact* geometric intersection of the
// source→target line with each node's rectangle border. That picks the
// correct side, but the landing point can slide anywhere along that side
// (including right where the expand/collapse chevron or the add/delete
// buttons sit), and several siblings converging on the same parent each
// land at a slightly different spot — messy and overlapping the node's
// own controls, instead of the single clean dot a fixed Handle gives you.
//
// So instead: pick the side the same way (whichever of the four faces the
// other node), but always attach at the MIDPOINT of that side — exactly
// where the old fixed Left/Right/Top/Bottom handles sat. Only the choice
// of *which* side auto-adjusts; the point on it never moves.

function getNodeBox(node) {
  const position = node.internals?.positionAbsolute ?? node.position
  const width = node.measured?.width ?? node.width ?? 140
  const height = node.measured?.height ?? node.height ?? 40
  return { x: position.x, y: position.y, width, height }
}

// Midpoint of the given side, plus which Position it is.
function sideMidpoint(box, side) {
  switch (side) {
    case Position.Left:
      return { x: box.x, y: box.y + box.height / 2, pos: Position.Left }
    case Position.Right:
      return { x: box.x + box.width, y: box.y + box.height / 2, pos: Position.Right }
    case Position.Top:
      return { x: box.x + box.width / 2, y: box.y, pos: Position.Top }
    case Position.Bottom:
    default:
      return { x: box.x + box.width / 2, y: box.y + box.height, pos: Position.Bottom }
  }
}

// Returns null if either node hasn't been measured/positioned yet (e.g.
// the very first render before React Flow lays it out), so callers can
// fall back to the fixed-handle coordinates React Flow already passed in.
export function getFloatingEdgeParams(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return null
  const sourceBox = getNodeBox(sourceNode)
  const targetBox = getNodeBox(targetNode)
  if (!sourceBox || !targetBox) return null

  const sourceCenterX = sourceBox.x + sourceBox.width / 2
  const sourceCenterY = sourceBox.y + sourceBox.height / 2
  const targetCenterX = targetBox.x + targetBox.width / 2
  const targetCenterY = targetBox.y + targetBox.height / 2

  const dx = targetCenterX - sourceCenterX
  const dy = targetCenterY - sourceCenterY

  // Dominant axis decides left/right vs top/bottom, same idea as
  // whichever quadrant the target sits in relative to the source.
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const sourceSide = horizontal ? (dx >= 0 ? Position.Right : Position.Left) : dy >= 0 ? Position.Bottom : Position.Top
  const targetSide = horizontal ? (dx >= 0 ? Position.Left : Position.Right) : dy >= 0 ? Position.Top : Position.Bottom

  const source = sideMidpoint(sourceBox, sourceSide)
  const target = sideMidpoint(targetBox, targetSide)

  return {
    sx: source.x,
    sy: source.y,
    tx: target.x,
    ty: target.y,
    sourcePos: source.pos,
    targetPos: target.pos,
  }
}
