// Single table of every drawing tool's spec (Phase-6 tools + Phase-11 tools). Kept in its own file so both
// drawings.js (geometry) and drawModel.js (records) can import it without a cycle.
import { NEW_SPECS, NEW_ORDER } from './drawTools.js'

export const LEGACY_SPECS = {
  trend: { name: 'Trend line', points: 2, clicks: 2 },
  ray: { name: 'Ray', points: 2, clicks: 2 },
  hline: { name: 'Horizontal line', points: 1, clicks: 1 },
  vline: { name: 'Vertical line', points: 1, clicks: 1 },
  rect: { name: 'Rectangle', points: 2, clicks: 2 },
  fib: { name: 'Fib retracement', points: 2, clicks: 2 },
  channel: { name: 'Parallel channel', points: 2, clicks: 3 }, // 2 points + a third click for the width
  text: { name: 'Text note', points: 1, clicks: 1 },
  measure: { name: 'Measure', points: 2, clicks: 2, transient: true },
}
export const LEGACY_ORDER = ['trend', 'ray', 'hline', 'vline', 'rect', 'fib', 'channel', 'text', 'measure']
export const DRAW_SPECS = { ...LEGACY_SPECS, ...NEW_SPECS }
export const DRAW_ORDER_ALL = [...LEGACY_ORDER, ...NEW_ORDER]
