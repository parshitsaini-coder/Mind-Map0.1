import { memo } from 'react'
import { BaseEdge, getBezierPath, useInternalNode } from '@xyflow/react'
import { getFloatingEdgeParams } from '../../utils/floatingEdgeUtils'

// Section 14 — perf pass: memoized like CustomNode, for the same reason.
// Section — floating connectors: look up the source/target nodes' *live*
// positions (useInternalNode) and re-project the edge onto whichever side
// of each node actually faces the other, on every render, instead of
// trusting the fixed left/right/top/bottom handle the connection was
// created on. Falls back to React Flow's handle-based coordinates if
// either node isn't measured yet (e.g. the very first render).
function CustomEdge({ source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const floating = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath] = getBezierPath({
    sourceX: floating?.sx ?? sourceX,
    sourceY: floating?.sy ?? sourceY,
    sourcePosition: floating?.sourcePos ?? sourcePosition,
    targetX: floating?.tx ?? targetX,
    targetY: floating?.ty ?? targetY,
    targetPosition: floating?.targetPos ?? targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      interactionWidth={24}
      style={{
        stroke: 'var(--color-slate)',
        strokeWidth: 1.5,
        strokeDasharray: 6,
        animation: 'dashdraw 1.2s linear infinite',
        ...style,
        ...(selected
          ? { stroke: 'var(--color-accent)', strokeWidth: (style?.strokeWidth || 1.5) + 1.5, filter: 'drop-shadow(0 0 2px var(--color-accent))' }
          : null),
      }}
    />
  )
}

export default memo(CustomEdge)
