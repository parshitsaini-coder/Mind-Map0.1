import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, useInternalNode } from '@xyflow/react'
import { getFloatingEdgeParams } from '../../utils/floatingEdgeUtils'

// Used for non-hierarchical "cross-branch relationship" links (Section 4.1),
// as opposed to CustomEdge which represents parent → child tree structure.
// Section 14 — perf pass: memoized like CustomEdge.
// Section — floating connectors, same as CustomEdge: re-projects onto
// whichever side of each node actually faces the other based on live
// position, instead of the fixed handle the link was created on.
function CrossEdge({ source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const floating = getFloatingEdgeParams(sourceNode, targetNode)

  const [edgePath] = getSmoothStepPath({
    sourceX: floating?.sx ?? sourceX,
    sourceY: floating?.sy ?? sourceY,
    sourcePosition: floating?.sourcePos ?? sourcePosition,
    targetX: floating?.tx ?? targetX,
    targetY: floating?.ty ?? targetY,
    targetPosition: floating?.targetPos ?? targetPosition,
    borderRadius: 12,
  })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      interactionWidth={24}
      style={{
        stroke: 'var(--color-slate)',
        strokeWidth: 1.5,
        strokeDasharray: '2 4',
        opacity: 0.75,
        ...style,
        ...(selected
          ? { stroke: 'var(--color-accent)', strokeWidth: (style?.strokeWidth || 1.5) + 1.5, opacity: 1, filter: 'drop-shadow(0 0 2px var(--color-accent))' }
          : null),
      }}
    />
  )
}

export default memo(CrossEdge)
