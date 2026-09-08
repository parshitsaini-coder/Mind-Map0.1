import { memo } from 'react'
import { BaseEdge, getBezierPath } from '@xyflow/react'

// Section 14 — perf pass: memoized like CustomNode, for the same reason.
function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected }) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

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
