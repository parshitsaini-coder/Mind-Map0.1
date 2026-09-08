import { memo } from 'react'
import { BaseEdge, getSmoothStepPath } from '@xyflow/react'

// Used for non-hierarchical "cross-branch relationship" links (Section 4.1),
// as opposed to CustomEdge which represents parent → child tree structure.
// Section 14 — perf pass: memoized like CustomEdge.
function CrossEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected }) {
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
