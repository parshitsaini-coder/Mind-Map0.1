// Phase 13 against the REAL store: events carry the data the popup / chart effects need, popup + toast follow the
// Animations settings, the stop-out banner, modify old → new, slippage. Run via ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const FX = await import('../src/lib/terminal/effects.js')
const CF = await import('../src/lib/terminal/chartFx.js')
const s = () => useTerminalStore.getState()
s().setSettings({ sound: false })
const seen = []
FX.registerSubscriber('probe', (e) => seen.push(e))
const chart = []
CF.onChartEvent((e) => chart.push(e))
const Q = { EURUSD: { bid: 1.1, ask: 1.1002 } }
const reset = () => { useTerminalStore.setState({ notices: [], popup: null, banner: null }); seen.length = 0; chart.length = 0 }
const anim = (p) => s().setChartSettings({ anim: p })

check('old save (no anim block) loads with the defaults', s().chartSettings.anim.mode === 'full' && s().chartSettings.anim.popup === 'full')

// full popup + toast
reset()
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.09, tp: 1.12 }, Q)
check('market buy → a popup model is shown', s().popup?.variant === 'filled' && s().popup.title === 'BUY FILLED')
check('…with symbol, lots, price, SL / TP in the lines', s().popup.lines.some((l) => /EURUSD · 0.1 lots/.test(l)) && s().popup.lines.some((l) => /SL 1\.09000 · TP 1\.12000/.test(l)))
check('…and the toast too (also-show-toast is ON)', s().notices.length === 1 && s().notices[0].eventId === 'order.buy.filled')
check('…and the chart effect bus got the same event with data', chart.some((e) => e.id === 'order.buy.filled' && e.data.symbol === 'EURUSD' && e.data.price === s().positions[0].entry))
check('event data carries the slippage figure (a number, ≥ 0 worse)', Number.isFinite(seen[0].data.slipPips))

anim({ alsoToast: false }); reset()
s().openPosition({ symbol: 'EURUSD', side: 'sell', lots: 0.1 }, Q)
check('also-toast OFF: popup yes, toast no', !!s().popup && s().notices.length === 0)

anim({ popup: 'toast' }); reset()
const o = s().placeOrder({ symbol: 'EURUSD', side: 'buy', type: 'limit', price: 1.05, lots: 0.1 }, Q)
check('popup = toast only: no popup, toast shown', s().popup === null && s().notices.length === 1)
check('pending placed carries order type + distance for the ring', seen[0].data.orderType === 'limit' && seen[0].data.distPips > 0)

anim({ popup: 'off' }); reset()
s().cancelOrder(o.order.id)
check('popup OFF: nothing visual for a plain cancel', s().popup === null && s().notices.length === 0)
check('popup OFF: the chart effect still runs (separate switch)', chart.some((e) => e.id === 'order.cancelled'))
FX.emitTerminalEvent({ id: 'order.rejected', text: 'Order rejected: x', kind: 'error', data: { reason: 'x' } })
check('popup OFF: errors still show a toast', s().notices.length === 1 && s().notices[0].kind === 'error')

anim({ popup: 'full', alsoToast: true, mode: 'off' }); reset()
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1 }, Q)
check('Animations OFF: plain toast, no animated popup', s().popup === null && s().notices.length === 1)
check('Animations OFF: chart effects produce nothing', CF.fxSpecs('order.buy.filled', chart[0].data, (await import('../src/lib/terminal/motionPolicy.js')).motionFlags(s().chartSettings.anim)).length === 0)

anim({ mode: 'full', popup: 'full', alsoToast: true }); reset()
const pos = s().positions[0]
s().modifyPosition(pos.id, { sl: 1.08 }, Q)
check('modify: event data has what / old / new', (() => { const d = seen[0].data; return d.what === 'SL' && d.to === 1.08 && d.from === (pos.sl ?? null) })())
check('modify: popup says SL MOVED, no toast from the store (chart toast owns that)', s().popup?.title === 'SL MOVED' && s().notices.length === 0)

reset()
const id = s().positions[0].id
s().closePosition(id, { EURUSD: { bid: 1.2, ask: 1.2002 } })
check('close in profit: popup with count-up target = the P/L', s().popup?.title === 'CLOSED IN PROFIT' && s().popup.count.to === seen[0].data.pnl && seen[0].data.pnl > 0)
check('close: event data has the exit price for the chart effect', seen[0].data.price > 1.19)

// ledger events (tick)
reset()
s().closeMany(s().positions.map((p) => p.id), Q)
s().placeOrder({ symbol: 'EURUSD', side: 'buy', type: 'limit', price: 1.09, lots: 0.1 }, Q)
reset()
s().tick({ EURUSD: { bid: 1.0885, ask: 1.0887 } })
check('limit fill by a tick: triggered popup + data (order type, price)', s().popup?.title === 'LIMIT FILLED' && seen.some((e) => e.id === 'order.pending.triggered' && e.data.orderType === 'limit' && e.data.price > 1.08))
const p2 = s().positions[0]
s().modifyPosition(p2.id, { sl: 1.08 }, { EURUSD: { bid: 1.0885, ask: 1.0887 } })
reset()
s().tick({ EURUSD: { bid: 1.079, ask: 1.0792 } })
check('SL hit by a tick: STOPPED OUT popup, loss count, exit price in data', s().popup?.title === 'STOPPED OUT' && s().popup.count.to < 0 && seen.some((e) => e.id === 'position.sl.hit' && e.data.price <= 1.08))

// stop-out banner
reset()
FX.emitTerminalEvent({ id: 'account.stopout', text: 'STOP-OUT: x', kind: 'loss', data: { symbol: 'EURUSD', marginLevel: 42, pnl: -300, price: 1.07 } })
check('stop-out: banner stays until dismissed', s().banner?.text === 'margin level 42 %')
s().dismissBanner()
check('dismissBanner clears it', s().banner === null)
s().dismissPopup()
check('dismissPopup clears the popup', s().popup === null)

// toast stack
reset()
for (let i = 0; i < 7; i++) s().notify(`n${i}`, 'info')
check('at most 4 toasts stay', s().notices.length === 4 && s().notices.at(-1).text === 'n6')

// settings persist
const saved = JSON.parse(mem.get('mindmap-terminal-storage'))
check('anim settings persist', saved.state.chartSettings.anim.popup === 'full' && saved.state.chartSettings.anim.mode === 'full')
check('popup / banner / adaptive are not persisted', !('popup' in saved.state) && !('banner' in saved.state) && !('adaptive' in saved.state))
process.exit(fail ? 1 : 0)

