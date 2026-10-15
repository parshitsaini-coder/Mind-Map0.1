// Phase 12 — the ONE catalogue of terminal events. Everything that reacts to something happening in the
// terminal (sound, toast, chart effect, vibration) reads from this table. Pure data, no imports.
//
// id        stable key, also the key in chartSettings.sounds.events
// category  groups the rows in Settings → Sounds
// priority  higher wins when several events land within the coalescing window (one sound plays)
// sound     default sound id (see soundDesign.js SOUNDS)
// animation default chart effect id — Phase 13 plugs the renderer in; nothing draws it yet
// toast     default toast text (emitters usually pass a more specific one)
// kind      toast colour: info | win | loss | error
// loud      true = also raises an OS notification when the tab is in the background
// haptic    vibration class (see HAPTICS); null = never vibrates
// live      true = something in the app emits it today; false = reserved (stays in the playground only)
// defaultOn false = starts muted
export const CATEGORIES = [
  { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'account', label: 'Account' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'connection', label: 'Connection' },
  { id: 'ui', label: 'Interface' },
]

const E = (id, label, category, priority, sound, o = {}) => ({
  id, label, category, priority, sound,
  animation: o.animation ?? null,
  toast: o.toast ?? null,
  kind: o.kind ?? 'info',
  loud: !!o.loud,
  haptic: o.haptic ?? null,
  live: o.live !== false,
  defaultOn: o.defaultOn !== false,
})

export const EVENTS = [
  E('order.buy.filled', 'Buy filled', 'orders', 50, 'buy', { animation: 'pulse-up', toast: 'Buy order filled', loud: true, haptic: 'success' }),
  E('order.sell.filled', 'Sell filled', 'orders', 50, 'sell', { animation: 'pulse-down', toast: 'Sell order filled', loud: true, haptic: 'success' }),
  E('order.pending.placed', 'Pending order placed', 'orders', 35, 'tick', { animation: 'line-in', toast: 'Pending order placed', haptic: 'tick' }),
  E('order.pending.triggered', 'Pending order triggered', 'orders', 55, 'arpeggio', { animation: 'flash', toast: 'Pending order triggered', loud: true, haptic: 'success' }),
  E('order.modified', 'Order / SL / TP modified', 'orders', 30, 'blip', { animation: null, toast: null }),
  E('order.cancelled', 'Order cancelled', 'orders', 40, 'thud', { animation: 'fade-out', toast: 'Order cancelled', haptic: 'tick' }),
  E('order.rejected', 'Order rejected', 'orders', 60, 'buzz', { animation: 'shake', toast: 'Order rejected', kind: 'error', loud: true, haptic: 'loss' }),
  E('position.closed.win', 'Closed in profit', 'positions', 70, 'chime', { animation: 'confetti', toast: 'Position closed in profit', kind: 'win', haptic: 'success' }),
  E('position.closed.loss', 'Closed at a loss', 'positions', 70, 'descend', { animation: 'dim', toast: 'Position closed at a loss', kind: 'loss', haptic: 'loss' }),
  E('position.closed.flat', 'Closed flat', 'positions', 45, 'flat', { animation: null, toast: 'Position closed flat', haptic: 'tick' }),
  E('position.partial', 'Partial close', 'positions', 45, 'partial', { animation: 'pulse', toast: 'Partial close', haptic: 'tick' }),
  E('position.sl.hit', 'Stop loss hit', 'positions', 80, 'descend', { animation: 'dim', toast: 'Stop loss hit', kind: 'loss', loud: true, haptic: 'loss' }),
  E('position.tp.hit', 'Take profit hit', 'positions', 75, 'chime', { animation: 'confetti', toast: 'Take profit hit', kind: 'win', loud: true, haptic: 'success' }),
  E('position.reversed', 'Position reversed', 'positions', 45, 'reverse', { animation: 'flip', toast: 'Position reversed', haptic: 'tick' }),
  E('account.margin.warning', 'Margin warning', 'account', 90, 'alarm', { animation: 'pulse-red', toast: 'Margin level is low', kind: 'error', loud: true, haptic: 'alarm' }),
  E('account.stopout', 'Stop-out', 'account', 100, 'alarm', { animation: 'pulse-red', toast: 'Stop-out: positions closed', kind: 'error', loud: true, haptic: 'alarm' }),
  E('alert.price', 'Price alert', 'alerts', 65, 'bell', { animation: 'ring', toast: 'Price alert', loud: true, haptic: 'success', live: false }),
  E('connection.lost', 'Connection lost', 'connection', 85, 'linkdown', { animation: null, toast: 'Connection lost', kind: 'error', haptic: 'loss', live: false }),
  E('connection.restored', 'Connection restored', 'connection', 55, 'linkup', { animation: null, toast: 'Connection restored', kind: 'win', live: false }),
  E('ui.click', 'Button click', 'ui', 5, 'click', { defaultOn: false, live: false }),
  E('ui.toggle', 'Switch toggle', 'ui', 5, 'toggle', { defaultOn: false, live: false }),
]

export const EVENT_IDS = EVENTS.map((e) => e.id)
export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]))
export const LIVE_EVENTS = EVENTS.filter((e) => e.live)

// vibration patterns (ms) per event class — navigator.vibrate
export const HAPTICS = {
  tick: [12],
  success: [18, 45, 18],
  loss: [70, 50, 70],
  alarm: [220, 90, 220, 90, 220],
}

// ── mapping from what the ledger / store does to an event id ──────────────
// ledger events (engine ticks and offline catch-up) → catalogue id. `be`, `expired` and `oco` are
// order edits / cancellations, `fill` is a pending order that became a position.
export const LEDGER_EVENT = {
  fill: 'order.pending.triggered',
  trigger: 'order.pending.triggered',
  sl: 'position.sl.hit',
  tp: 'position.tp.hit',
  ptp: 'position.partial',
  be: 'order.modified',
  stopout: 'account.stopout',
  expired: 'order.cancelled',
  oco: 'order.cancelled',
  rejected: 'order.rejected',
}

export const buyOrSell = (side) => (side === 'sell' ? 'order.sell.filled' : 'order.buy.filled')
export const closeEvent = (pnl) => (pnl > 0 ? 'position.closed.win' : pnl < 0 ? 'position.closed.loss' : 'position.closed.flat')
