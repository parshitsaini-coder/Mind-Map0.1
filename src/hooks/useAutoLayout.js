import { radialLayout } from '../components/layouts/radialLayout'
import { orgChartLayout } from '../components/layouts/orgChartLayout'
import { fishboneLayout } from '../components/layouts/fishboneLayout'
import { timelineLayout } from '../components/layouts/timelineLayout'
import { matrixLayout } from '../components/layouts/matrixLayout'
import { logicChartLayout } from '../components/layouts/logicChartLayout'

// Section 4.2 — layout options, switchable from the toolbar/sidebar.
// 'Horizontal/Vertical tree' is exposed as a direction toggle on the
// org-chart algorithm rather than a separate algorithm (see uiStore.treeDirection).
export function runLayout(layoutId, nodes, edges, direction = 'vertical') {
  switch (layoutId) {
    case 'orgChart':
      return orgChartLayout(nodes, edges, direction)
    case 'fishbone':
      return fishboneLayout(nodes, edges)
    case 'timeline':
      return timelineLayout(nodes, edges)
    case 'matrix':
      return matrixLayout(nodes, edges)
    case 'logicChart':
      return logicChartLayout(nodes, edges)
    case 'radial':
    default:
      return radialLayout(nodes, edges)
  }
}
