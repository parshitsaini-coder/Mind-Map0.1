import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import { resolvePath } from './edgePathUtils'
import { ICONS } from '../../theme/iconSet'

// Section 14 — perf pass: memoized like CustomEdge.
// Line-style presets (Node Inspector → "Line style") are stored per-edge in
// `data` (pathType/dash/animated/cap/iconMid); color/thickness stay in
// `style` (unchanged) so the two controls never clobber each other.
function CustomEdge({
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
  const [edgePath, labelX, labelY] = resolvePath(data?.pathType, {
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
          strokeDasharray: data?.dash !== undefined ? (data.dash || undefined) : 6,
          strokeLinecap: data?.cap || undefined,
          animation: data?.animated !== false ? 'dashdraw 1.2s linear infinite' : undefined,
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

export default memo(CustomEdge)
