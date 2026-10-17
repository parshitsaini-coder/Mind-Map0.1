// Phase 10 against the REAL store: closeLots, toast actions, ticket prefill, chart-modify helper
// (one modify call + toast with Undo + Ctrl+Z stack), persistence of the new settings. Run via ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { chartSettings: { trading: { plUnit: 'pips' } } } }))
await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const hub = await import('../src/lib/terminal/quoteHub.js')
const mock = await import('./fixtures/mockFeed.js')
hub.setFeedSubscribe(mock.subscribe)
const A = await import('../src/components/terminal/chartActions.js')
const s = () => useTerminalStore.getState()

check('old save: new trading settings default, old ones kept', s().chartSettings.trading.plUnit === 'pips' && s().chartSettings.trading.snap === 'off' && s().chartSettings.trading.marginWarn === 100)

hub.watch('EURUSD') // the simulated feed gives a real quote
const Q = hub.getSnapshot()
const B = Q.EURUSD.bid, K = Q.EURUSD.ask, f5 = (n) => +n.toFixed(5)
const quotes = Q
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 1 }, quotes)
const id = s().positions[0].id

// closeLots
check('closeLots rejects whole / zero / bad step and changes nothing', !s().closeLots(id, 1, quotes).ok && !s().closeLots(id, 0, quotes).ok && !s().closeLots(id, 0.333, quotes).ok && s().positions[0].lots === 1)
const before = s().history.length
check('closeLots closes exactly the typed lots', s().closeLots(id, 0.4, quotes).ok && s().positions[0].lots === 0.6 && s().history.length === before + 1 && s().history[0].lots === 0.4)
check('closeLots on a missing position fails cleanly', !s().closeLots('nope', 0.1, quotes).ok)

// toast with an action
let ran = 0
s().notify('hello', 'info', { label: 'Undo', run: () => { ran++ } })
const n = s().notices[s().notices.length - 1]
check('notify keeps an optional action; plain notify has none', n.action?.label === 'Undo' && (s().notify('x'), !s().notices[s().notices.length - 1].action))
n.action.run()
check('toast action runs', ran === 1)

// prefill
s().prefillTicket({ type: 'limit', side: 'buy', price: 1.15 })
check('prefillTicket stores type / side / price with a fresh stamp', s().ticketPrefill.type === 'limit' && s().ticketPrefill.price === 1.15 && s().ticketPrefill.n > 0)

// commitPatch + undo
const pid = s().positions[0].id
let r = A.commitPatch('position', pid, { sl: f5(B - 0.002) })
check('commitPatch moves SL once, toasts with Undo, pushes undo', r.ok && s().positions[0].sl === f5(B - 0.002) && /SL set at/.test(s().notices.at(-1).text) && s().notices.at(-1).action.label === 'Undo' && A.modifyUndo.size() === 1)
r = A.commitPatch('position', pid, { sl: f5(B - 0.0015) })
check('second move says "moved to"', /SL moved to /.test(s().notices.at(-1).text))
r = A.commitPatch('position', pid, { sl: f5(B + 0.01) })
check('invalid move is refused with the engine reason, nothing changes, nothing queued', !r.ok && /below/.test(s().notices.at(-1).text) && s().positions[0].sl === f5(B - 0.0015) && A.modifyUndo.size() === 2)
check('Ctrl+Z (undoLast) restores the previous SL', A.undoLast() && s().positions[0].sl === f5(B - 0.002))
const u2 = A.undoLast(); check('undo again restores "no SL"', u2 && s().positions[0].sl === null, JSON.stringify([u2, s().positions[0].sl, s().notices.at(-1)?.text]))
check('undo with an empty stack does nothing', A.undoLast() === false)
r = A.commitPatch('position', pid, { sl: f5(B - 0.002), tp: f5(B + 0.005) })
check('bracket = ONE call, ONE undo entry, undo restores both', r.ok && s().positions[0].tp === f5(B + 0.005) && A.modifyUndo.size() === 1 && A.undoLast() && s().positions[0].sl === null && s().positions[0].tp === null)
A.commitPatch('position', pid, { sl: f5(B - 0.002) })
s().closePosition(pid, quotes)
check('undo skips entries whose position is gone', A.undoLast() === false)

// pending order modify from the chart
const o = s().placeOrder({ symbol: 'EURUSD', type: 'limit', side: 'buy', lots: 0.1, price: f5(K - 0.01) }, quotes)
r = A.commitPatch('order', o.order.id, { price: f5(K - 0.0085) })
check('order drag: commitPatch updates the order price, undo puts it back', r.ok && s().orders[0].price === f5(K - 0.0085) && A.undoLast() && s().orders[0].price === f5(K - 0.01))
r = A.commitPatch('order', o.order.id, { price: f5(K + 0.01) })
check('invalid order price is refused', !r.ok && s().orders[0].price === f5(K - 0.01))

// new settings persist
s().setChartSettings({ trading: { snap: 'bars', defSlValue: 12.5, marginWarn: 150, plUnit: 'r' } })
const saved = JSON.parse(mem.get('mindmap-terminal-storage')).state.chartSettings.trading
check('Phase 10 settings are persisted', saved.snap === 'bars' && saved.defSlValue === 12.5 && saved.marginWarn === 150 && saved.plUnit === 'r')
process.exit(fail ? 1 : 0)

