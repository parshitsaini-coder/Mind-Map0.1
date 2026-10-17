// Phase 12 against the REAL store: old `settings.sound` boolean migrates to master on/off, the store's actions
// emit the right catalogue events through the bus (toast + sound), sounds settings persist. Run via ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// OLD save: Phase 11 era, sound switched off, no sounds block
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { settings: { sound: false, oneClick: true } } }))
await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore, cleanSettings } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const FX = await import('../src/lib/terminal/effects.js')
const SE = await import('../src/lib/terminal/soundEngine.js')
const CS = await import('../src/lib/terminal/chartSettings.js')
const s = () => useTerminalStore.getState()

check('old save: boolean sound=false becomes master OFF, other settings kept', s().settings.sound === false && s().settings.oneClick === true)
check('old save: sounds block gets defaults', JSON.stringify(s().chartSettings.sounds) === JSON.stringify(CS.DEFAULT_CHART_SETTINGS.sounds))
check('cleanSettings: junk sound value falls back to ON, true stays', cleanSettings({ sound: 'maybe' }).sound === true && cleanSettings({ sound: true }).sound === true)

// stub audio + synchronous timers; the engine reads the store through configureSound
const ctx = { state: 'running', currentTime: 0, oscillators: 0, destination: {}, resume: () => Promise.resolve() }
const par = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} })
ctx.createOscillator = () => { ctx.oscillators++; return { frequency: par(), connect() {}, start() {}, stop() {} } }
ctx.createGain = () => ({ gain: par(), connect() {} })
ctx.createBiquadFilter = () => ({ frequency: par(), connect() {} })
SE.setAudioFactory(() => ctx)
let flush = null
SE.setEngineTimers({ set: (f) => { flush = f; return 1 }, clear: () => { flush = null }, now: () => Date.now() })

const seen = []
FX.registerSubscriber('probe', (e) => seen.push(e.id))
const Q = { EURUSD: { bid: 1.1, ask: 1.1002 } }
const last = () => seen[seen.length - 1]
const toasts = () => s().notices.map((n) => n.text)

s().setSettings({ sound: true })
const r = s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1 }, Q)
check('market buy → order.buy.filled + toast', r.ok && last() === 'order.buy.filled' && toasts().some((t) => /Bought/.test(t)))
check('buy sound plays after the coalescing window', flush && (flush(), ctx.oscillators === 2))
s().openPosition({ symbol: 'EURUSD', side: 'sell', lots: 0.1 }, Q)
check('market sell → order.sell.filled', last() === 'order.sell.filled')
const o = s().placeOrder({ symbol: 'EURUSD', side: 'buy', type: 'limit', price: 1.05, lots: 0.1 }, Q)
check('placeOrder → order.pending.placed', o.ok && last() === 'order.pending.placed')
s().modifyOrder(o.order.id, { price: 1.06 }, Q)
check('modifyOrder → order.modified with NO toast', last() === 'order.modified' && !toasts().some((t) => /modif/i.test(t)))
s().cancelOrder(o.order.id)
check('cancelOrder → order.cancelled', last() === 'order.cancelled')
const pid = s().positions[0].id
s().modifyPosition(pid, { sl: 1.0 }, Q)
check('modifyPosition → order.modified', last() === 'order.modified')
s().partialClose(pid, 50, Q)
check('partialClose → position.partial', last() === 'position.partial')
const Qw = { EURUSD: { bid: 1.2, ask: 1.2002 } }
const before = seen.length
s().closePosition(s().positions.find((p) => p.side === 'buy').id, Qw)
check('close in profit → position.closed.win', seen[before] === 'position.closed.win')
s().reversePosition(s().positions[0].id, Qw)
check('reverse → position.reversed', last() === 'position.reversed')

// ledger events via tick: a pending order fills, SL hits
s().closeMany(s().positions.map((p) => p.id), Qw)
s().placeOrder({ symbol: 'EURUSD', side: 'buy', type: 'limit', price: 1.19, lots: 0.1 }, Qw)
const n0 = seen.length
s().tick({ EURUSD: { bid: 1.188, ask: 1.1882 } })
check('pending order filled by a tick → order.pending.triggered', seen.slice(n0).includes('order.pending.triggered'))
const p2 = s().positions[0]
s().modifyPosition(p2.id, { sl: 1.18, tp: 1.25 }, { EURUSD: { bid: 1.188, ask: 1.1882 } })
const n1 = seen.length
s().tick({ EURUSD: { bid: 1.179, ask: 1.1792 } })
check('stop loss hit by a tick → position.sl.hit (+ toast)', seen.slice(n1).includes('position.sl.hit') && toasts().some((t) => /stop/i.test(t)))

// every ledger event type has a mapping the store uses
const C = await import('../src/lib/terminal/eventCatalog.js')
check('all store ledger event types are mapped', ['fill', 'trigger', 'sl', 'tp', 'ptp', 'be', 'stopout', 'expired', 'oco', 'rejected'].every((t) => C.LEDGER_EVENT[t]))

// settings persist
s().setChartSettings({ sounds: { pack: 'arcade', events: { 'order.cancelled': { on: false } } } })
const saved = JSON.parse(mem.get('mindmap-terminal-storage'))
check('sounds settings persist', saved.state.chartSettings.sounds.pack === 'arcade' && saved.state.chartSettings.sounds.events['order.cancelled'].on === false)
// store → engine config
ctx.oscillators = 0; SE.resetEngine()
SE.playEvent('order.cancelled'); SE.flushNow()
check('engine reads the store at play time: disabled event is silent', ctx.oscillators === 0)
s().setSettings({ sound: false }); SE.playEvent('position.tp.hit'); SE.flushNow()
check('master off in the store silences everything', ctx.oscillators === 0)
s().setSettings({ sound: true }); SE.playEvent('position.tp.hit'); SE.flushNow()
check('master on again: plays', ctx.oscillators > 0)
process.exit(fail ? 1 : 0)

