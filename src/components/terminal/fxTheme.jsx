import { Check, Clock, Zap, Pencil, X, TriangleAlert, Target, ShieldAlert, TrendingUp, TrendingDown, Minus, ArrowLeftRight, Bell, WifiOff, Wifi, Info } from 'lucide-react'
import { css } from '../../lib/terminal/chartSettings'

// Shared by the popup, the toasts and the chart effects (Phase 13): tone -> colour, icon name -> lucide icon.
const ICONS = { check: Check, clock: Clock, bolt: Zap, pencil: Pencil, x: X, alert: TriangleAlert, target: Target, shield: ShieldAlert, 'trend-up': TrendingUp, 'trend-down': TrendingDown, minus: Minus, flip: ArrowLeftRight, bell: Bell, 'wifi-off': WifiOff, wifi: Wifi, info: Info }
export const Icon = ({ name, size = 18, ...rest }) => {
  const C = ICONS[name] || Info
  return <C size={size} aria-hidden="true" {...rest} />
}

// `t` = chartSettings.trading. Chart colours come from the person's settings; status colours are fixed.
export function toneColor(tone, t) {
  switch (tone) {
    case 'buy': return css(t.colorBuy)
    case 'sell': return css(t.colorSell)
    case 'win': return css(t.colorTP)
    case 'loss': return css(t.colorSL)
    case 'pending': return css(t.colorBuyPending)
    case 'warn': return '#f59e0b'
    case 'error': return '#ef4444'
    case 'info': return '#38bdf8'
    default: return '#94a3b8' // neutral / muted
  }
}
