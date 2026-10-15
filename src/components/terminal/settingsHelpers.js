import { useTerminalStore } from '../../store/terminalStore'

// Helpers for the Settings dialog controls (kept out of the component file for fast refresh).
export const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o)
export const patchOf = (path, value) => {
  const ks = path.split('.')
  return ks.reduceRight((acc, k) => ({ [k]: acc }), value)
}
export function useCS() {
  const cs = useTerminalStore((s) => s.chartSettings)
  const set = (path, value) => useTerminalStore.getState().setChartSettings(patchOf(path, value))
  return { cs, set, get: (p) => getPath(cs, p) }
}

export const STYLE_OPTS = [{ id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }, { id: 'dotted', label: 'Dotted' }]
