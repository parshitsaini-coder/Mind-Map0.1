import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import { resolvePath } from './edgePathUtils'
import { ICONS } from '../../theme/iconSet'

// Used for non-hierarchical "cross-branch relationship" links (Section 4.1),
// as opposed to CustomEdge which represents parent → child tree structure.
// Section 14 — perf pass: memoized like CustomEdge.
// Defaults to a smoothstep path (its original look) unless a Line style
// preset from the Node Inspector overrides `data.pathType`.
function CrossEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
  markerStart,
}) {
  const [edgePath, labelX, labelY] = resolvePath(data?.pathType || 'smoothstep', {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const IconComp = data?.iconMid ? ICONS[data.iconMid] : null

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: '#333533',
          strokeWidth: 1.5,
          strokeDasharray: data?.dash !== undefined ? (data.dash || undefined) : '2 4',
          strokeLinecap: data?.cap || undefined,
          animation: data?.animated ? 'dashdraw 1.2s linear infinite' : undefined,
          opacity: 0.75,
          ...style,
        }}
      />
      {IconComp && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: '#e8eddf',
              borderColor: style?.stroke || '#333533',
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full border shadow"
          >
            <IconComp size={11} color="#242423" />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(CrossEdge)
