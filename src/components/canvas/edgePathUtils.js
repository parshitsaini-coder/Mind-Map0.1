import { getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from '@xyflow/react'

// Shared by CustomEdge, CrossEdge and ConnectorDemoEdge — one place that maps
// a `pathType` string to the React Flow path-generator function, so the
// "Line style" picker in NodeInspector and the connector-styles demo map
// stay perfectly in sync.
export function resolvePath(pathType, params) {
  switch (pathType) {
    case 'straight':
      return getStraightPath(params)
    case 'smoothstep':
      return getSmoothStepPath({ ...params, borderRadius: 10 })
    case 'step':
      return getSmoothStepPath({ ...params, borderRadius: 0 })
    case 'simplebezier':
      return getSimpleBezierPath(params)
    case 'bezier':
    default:
      return getBezierPath(params)
  }
}

// The 9 one-click presets shown in the Node Inspector's "Line style" section.
// Each preset is a partial `data` patch applied to the selected edge — kept
// separate from `style` (stroke/strokeWidth, controlled by the color/
// thickness pickers) so the two sets of controls don't clobber each other.
export const LINE_STYLE_PRESETS = [
  { key: 'curved', label: 'Curved', data: { pathType: 'bezier', dash: '', animated: false, cap: undefined } },
  { key: 'curved-dashed', label: 'Curved dashed', data: { pathType: 'bezier', dash: '6', animated: false, cap: undefined } },
  { key: 'straight', label: 'Straight', data: { pathType: 'straight', dash: '', animated: false, cap: undefined } },
  { key: 'straight-dashed', label: 'Straight dashed', data: { pathType: 'straight', dash: '6', animated: false, cap: undefined } },
  { key: 'step', label: 'Step (right-angle)', data: { pathType: 'step', dash: '', animated: false, cap: undefined } },
  { key: 'smoothstep', label: 'Smooth step', data: { pathType: 'smoothstep', dash: '', animated: false, cap: undefined } },
  { key: 'dotted', label: 'Dotted', data: { pathType: 'bezier', dash: '1.5 5', animated: false, cap: 'round' } },
  { key: 'animated', label: 'Animated flow', data: { pathType: 'bezier', dash: '6', animated: true, cap: undefined } },
  { key: 'simplebezier', label: 'Simple curve', data: { pathType: 'simplebezier', dash: '', animated: false, cap: undefined } },
]
