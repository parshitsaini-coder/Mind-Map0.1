import { useTerminalStore } from '../../store/terminalStore'
import { chromeOf } from '../../lib/terminal/chartSettings'
import { useMediaQuery } from './hooks'

// The current chart settings + the chrome palette of the chosen theme ('system' follows the OS).
export function useChartTheme() {
  const cs = useTerminalStore((s) => s.chartSettings)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const chrome = chromeOf(cs, prefersDark)
  return { cs, chrome, prefersDark, light: chrome.light }
}

// CSS variables for the terminal root. Panels / buttons read them (var(--tm-panel) ...); the chart
// canvas gets its colours from chartApply.js instead.
export const themeVars = (chrome, cs) => ({
  '--tm-bg': chrome.bg, '--tm-panel': chrome.panel, '--tm-panel2': chrome.panel2, '--tm-deep': chrome.deep,
  '--tm-border': chrome.border, '--tm-border2': chrome.border2, '--tm-active': chrome.active, '--tm-muted': chrome.muted, '--tm-text': chrome.text,
  '--tm-chart-bg': cs.canvas.bg,
})
