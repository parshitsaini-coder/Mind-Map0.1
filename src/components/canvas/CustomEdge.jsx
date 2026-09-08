import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'

// Section 14 — perf pass: memoized like CustomNode, for the same reason.
function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#333533',
        strokeWidth: 1.5,
        strokeDasharray: 6,
        animation: 'dashdraw 1.2s linear infinite',
        ...style,
      }}
    />
  )
}

export default memo(CustomEdge)
