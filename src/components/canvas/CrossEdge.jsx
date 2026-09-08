import { memo } from 'react'
import { BaseEdge, getSmoothStepPath } from '@xyflow/react'

// Used for non-hierarchical "cross-branch relationship" links (Section 4.1),
// as opposed to CustomEdge which represents parent → child tree structure.
// Section 14 — perf pass: memoized like CustomEdge.
function CrossEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#333533',
        strokeWidth: 1.5,
        strokeDasharray: '2 4',
        opacity: 0.75,
        ...style,
      }}
    />
  )
}

export default memo(CrossEdge)
