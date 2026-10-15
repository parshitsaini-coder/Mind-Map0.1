// Phase 12 (pure): event catalogue, sound design as data, packs, resolvePlay, coalescing, rate limit,
// volume scaling, muted = no nodes, settings validation + `sound` migration, effects bus. Stubbed AudioContext.
import * as C from '../src/lib/terminal/eventCatalog.js'
import * as SD from '../src/lib/terminal/soundDesign.js'
import * as SE from '../src/lib/terminal/soundEngine.js'
import * as FX from '../src/lib/terminal/effects.js'
import { cleanChartSettings, mergeChartSettings, DEFAULT_CHART_SETTINGS } from '../src/lib/terminal/chartSettings.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// ── stub AudioContext: counts nodes and records every gain peak ──
function stubCtx(state = 'running') {
  const c = { state, currentTime: 0, oscillators: 0, gains: 0, peaks: [], resumed: 0, destination: {} }
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} })
  c.createOscillator = () => { c.oscillators++; return { type: '', frequency: param(), connect() {}, start() {}, stop() {} } }
  c.createBiquadFilter = () => ({ type: '', frequency: param(), connect() {} })
  c.createGain = () => { c.gains++; const g = param(); g.exponentialRampToValueAtTime = (v) => { c.peaks.push(v) }; return { gain: g, connect() {} } }
  c.resume = () => { c.resumed++; return Promise.resolve() }
  return c
}
const cfgOf = (o = {}) => ({ master: true, volume: 100, muteBackground: true, vibrate: false, pack: 'classic', events: {}, ...o })

// ── catalogue ──
check('catalogue has every required event', ['order.buy.filled', 'order.sell.filled', 'order.pending.placed', 'order.pending.triggered', 'order.modified', 'order.cancelled', 'order.rejected', 'position.closed.win', 'position.closed.loss', 'position.closed.flat', 'position.partial', 'position.sl.hit', 'position.tp.hit', 'position.reversed', 'account.margin.warning', 'account.stopout', 'alert.price', 'connection.lost', 'connection.restored'].every((id) => C.EVENTS_BY_ID[id]))
check('event ids are unique', new Set(C.EVENT_IDS).size === C.EVENT_IDS.length)
check('every event maps to a known sound', C.EVENTS.every((e) => SD.SOUNDS[e.sound]))
check('every event has category / priority / haptic class that exist', C.EVENTS.every((e) => C.CATEGORIES.some((c) => c.id === e.category) && e.priority > 0 && (e.haptic == null || C.HAPTICS[e.haptic])))
check('every ledger event type maps to a catalogue id', Object.values(C.LEDGER_EVENT).every((id) => C.EVENTS_BY_ID[id]))
check('stop-out outranks margin warning outranks SL outranks buy', C.EVENTS_BY_ID['account.stopout'].priority > C.EVENTS_BY_ID['account.margin.warning'].priority && C.EVENTS_BY_ID['account.margin.warning'].priority > C.EVENTS_BY_ID['position.sl.hit'].priority && C.EVENTS_BY_ID['position.sl.hit'].priority > C.EVENTS_BY_ID['order.buy.filled'].priority)
check('buyOrSell / closeEvent', C.buyOrSell('sell') === 'order.sell.filled' && C.buyOrSell('buy') === 'order.buy.filled' && C.closeEvent(5) === 'position.closed.win' && C.closeEvent(-1) === 'position.closed.loss' && C.closeEvent(0) === 'position.closed.flat')

// ── sound design ──
check('every sound is valid data', SD.SOUND_IDS.every((id) => SD.validateSound(SD.SOUNDS[id])))
check('every pack is valid data', SD.PACK_IDS.every((id) => SD.validatePack(SD.PACKS[id])))
check('pack validation rejects junk', !SD.validatePack({ wave: 'wobble', gain: 1 }) && !SD.validatePack({ gain: 0 }) && !SD.validatePack({ gain: 1, only: 'x' }) && !SD.validatePack(null))
check('buy rises, sell falls', SD.SOUNDS.buy.notes[1].f > SD.SOUNDS.buy.notes[0].f && SD.SOUNDS.sell.notes[1].f < SD.SOUNDS.sell.notes[0].f)
check('arpeggio has 3 notes, buzz is a double, chime has sparkle', SD.SOUNDS.arpeggio.notes.length === 3 && SD.SOUNDS.buzz.notes.length === 2 && SD.SOUNDS.chime.notes.some((n) => n.f > 2000))
{
  const sigs = ['buy', 'sell', 'chime', 'descend', 'arpeggio', 'thud', 'alarm'].map((id) => JSON.stringify(SD.SOUNDS[id].notes.map((n) => [n.f, n.t])))
  check('key sounds are all different from each other', new Set(sigs).size === sigs.length)
}
{
  const c = stubCtx()
  const n = SD.playSound(c, 'arpeggio', 0, 1, 'classic')
  check('playSound creates one oscillator + gain per note', n === 3 && c.oscillators === 3 && c.gains === 3)
  const c0 = stubCtx()
  check('volume 0 creates no nodes', SD.playSound(c0, 'buy', 0, 0) === 0 && c0.oscillators === 0 && c0.gains === 0)
  check('unknown sound creates no nodes', SD.playSound(c0, 'nope', 0, 1) === 0 && c0.oscillators === 0)
  const hi = stubCtx(); SD.playSound(hi, 'buy', 0, 1)
  const lo = stubCtx(); SD.playSound(lo, 'buy', 0, 0.5)
  check('volume scales the peak gain linearly', Math.abs(lo.peaks[0] * 2 - hi.peaks[0]) < 1e-9)
  const al = stubCtx(); SD.playSound(al, 'alarm', 0, 1)
  check('alarm is never louder than the cap', Math.max(...al.peaks) <= SD.PEAK + 1e-9)
  const soft = stubCtx(); SD.playSound(soft, 'buy', 0, 1, 'soft')
  check('Soft pack is quieter than Classic', soft.peaks[0] < hi.peaks[0])
}

// ── resolvePlay ──
{
  const r = (cfg, id, o) => SE.resolvePlay(cfg, id, o)
  check('default config: buy plays its default sound at full volume', (() => { const p = r(cfgOf(), 'order.buy.filled'); return p && p.sound === 'buy' && p.volume === 1 })())
  check('master off = silent', r(cfgOf({ master: false }), 'order.buy.filled') === null)
  check('master volume 0 = silent', r(cfgOf({ volume: 0 }), 'position.tp.hit') === null)
  check('event volume 0 = silent', r(cfgOf({ events: { 'position.tp.hit': { on: true, volume: 0, sound: 'default' } } }), 'position.tp.hit') === null)
  check('one event can be disabled alone', r(cfgOf({ events: { 'order.cancelled': { on: false, volume: 100, sound: 'default' } } }), 'order.cancelled') === null && r(cfgOf({ events: { 'order.cancelled': { on: false } } }), 'order.sell.filled') !== null)
  check('volume = master × event', Math.abs(r(cfgOf({ volume: 50, events: { 'order.buy.filled': { on: true, volume: 50, sound: 'default' } } }), 'order.buy.filled').volume - 0.25) < 1e-9)
  check('custom sound choice wins over the default', r(cfgOf({ events: { 'order.buy.filled': { on: true, volume: 100, sound: 'bell' } } }), 'order.buy.filled').sound === 'bell')
  check('background tab is muted when asked, plays when not', r(cfgOf(), 'order.buy.filled', { hidden: true }) === null && r(cfgOf({ muteBackground: false }), 'order.buy.filled', { hidden: true }) !== null)
  check('ui events start muted', r(cfgOf(), 'ui.click') === null && r(cfgOf({ events: { 'ui.click': { on: true } } }), 'ui.click') !== null)
  check('Silent pro: only SL / TP / stop-out', r(cfgOf({ pack: 'silentpro' }), 'order.buy.filled') === null && r(cfgOf({ pack: 'silentpro' }), 'position.sl.hit') && r(cfgOf({ pack: 'silentpro' }), 'position.tp.hit') && r(cfgOf({ pack: 'silentpro' }), 'account.stopout'))
  check('unknown event / unknown pack are safe', r(cfgOf(), 'nope') === null && r(cfgOf({ pack: 'zzz' }), 'order.buy.filled').pack === 'classic')
  check('pickLoudest: highest priority audible wins; ties keep the first', SE.pickLoudest(cfgOf(), ['order.buy.filled', 'position.tp.hit', 'order.modified']).id === 'position.tp.hit' && SE.pickLoudest(cfgOf(), ['order.buy.filled', 'order.sell.filled']).id === 'order.buy.filled')
  check('pickLoudest skips a muted top event', SE.pickLoudest(cfgOf({ events: { 'account.stopout': { on: false } } }), ['account.stopout', 'order.buy.filled']).id === 'order.buy.filled')
  check('pickLoudest returns null when nothing is audible', SE.pickLoudest(cfgOf({ master: false }), ['order.buy.filled']) === null)
}

// ── engine: coalescing, rate limit, muted creates no nodes, no-audio safe ──
{
  let now = 0
  let cb = null
  SE.setEngineTimers({ set: (f) => { cb = f; return 1 }, clear: () => { cb = null }, now: () => now })
  let cfg = cfgOf()
  SE.configureSound({ getConfig: () => cfg })
  let ctx = stubCtx()
  SE.setAudioFactory(() => ctx)
  SE.resetEngine()
  FX.emitTerminalEvent('order.buy.filled'); FX.emitTerminalEvent('position.tp.hit'); FX.emitTerminalEvent('order.modified')
  check('nothing plays before the window closes', ctx.oscillators === 0 && cb)
  cb()
  check('coalescing: 3 events in the window → ONE sound (the take-profit chime)', ctx.oscillators === SD.SOUNDS.chime.notes.length, `${ctx.oscillators}`)

  ctx = stubCtx(); SE.setAudioFactory(() => ctx); SE.resetEngine()
  cfg = cfgOf({ master: false })
  FX.emitTerminalEvent('order.buy.filled'); 
  check('master off: no timer, no context, no nodes', cb === null || ctx.oscillators === 0)
  SE.flushNow()
  check('master off: still zero nodes after flush', ctx.oscillators === 0 && ctx.gains === 0)
  cfg = cfgOf({ volume: 0 }); FX.emitTerminalEvent('position.sl.hit'); SE.flushNow()
  check('volume 0: zero nodes', ctx.oscillators === 0)

  cfg = cfgOf(); SE.resetEngine(); ctx = stubCtx(); SE.setAudioFactory(() => ctx)
  let played = 0
  for (let i = 0; i < 10; i++) { now = 5000 + i * 10; SE.playEvent('order.buy.filled'); if (SE.flushNow()) played++ }
  check(`rate limit: ${SE.RATE_LIMIT} sounds per second, then silent`, played === SE.RATE_LIMIT, `${played}`)
  now = 9000; SE.playEvent('order.buy.filled')
  check('rate limit window slides', SE.flushNow() === 'order.buy.filled')

  // settings are read at PLAY time: queue while on, turn off before the window closes
  SE.resetEngine(); ctx = stubCtx(); SE.setAudioFactory(() => ctx); now = 20000
  SE.playEvent('order.sell.filled'); cfg = cfgOf({ master: false }); SE.flushNow()
  check('settings are respected at play time', ctx.oscillators === 0)

  // suspended context → chip, resume attempted, no throw
  cfg = cfgOf(); ctx = stubCtx('suspended'); SE.setAudioFactory(() => ctx); SE.resetEngine(); now = 30000
  let notified = 0; SE.subscribeChip(() => notified++)
  SE.playEvent('order.buy.filled'); SE.flushNow()
  check('suspended context: resume tried and the "Tap to enable sound" chip is requested', ctx.resumed >= 1 && SE.getChip() === true && notified >= 1)
  ctx.state = 'running'; SE.unlockAudio()
  check('unlock on a gesture clears the chip', SE.getChip() === false)

  // unsupported / throwing audio never throws
  SE.setAudioFactory(() => { throw new Error('no audio') }); SE.resetEngine(); now = 40000
  let threw = false
  try { SE.playEvent('order.buy.filled'); SE.flushNow(); SE.previewSound('buy'); SE.testAll(); SE.previewEvent('position.tp.hit') } catch { threw = true }
  check('audio unsupported: never throws', !threw)
  SE.setAudioFactory(() => ({ ...stubCtx(), createOscillator() { throw new Error('boom') } })); SE.resetEngine(); now = 50000
  threw = false
  try { SE.playEvent('order.buy.filled'); SE.flushNow() } catch { threw = true }
  check('a failing node never throws', !threw)

  // preview ignores the per-event switch but honours master volume
  ctx = stubCtx(); SE.setAudioFactory(() => ctx)
  cfg = cfgOf({ events: { 'order.buy.filled': { on: false, volume: 100, sound: 'default' } } })
  SE.previewEvent('order.buy.filled')
  check('preview plays even when the event is switched off', ctx.oscillators === 2)
  ctx = stubCtx(); SE.setAudioFactory(() => ctx); cfg = cfgOf({ volume: 0 }); SE.previewSound('buy')
  check('preview at master volume 0 is silent', ctx.oscillators === 0)
  ctx = stubCtx(); SE.setAudioFactory(() => ctx); cfg = cfgOf()
  const total = SE.testAll()
  const liveSounds = C.LIVE_EVENTS.reduce((a, e) => a + SD.SOUNDS[e.sound].notes.length, 0)
  check('Test all plays every live event in sequence', ctx.oscillators === liveSounds && total > C.LIVE_EVENTS.length * 0.25, `${ctx.oscillators}/${liveSounds}`)

  // vibration
  const vib = []
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p) => { vib.push(p); return true } }, configurable: true })
  check('vibration: off by default', SE.vibrateFor(cfgOf(), 'order.buy.filled') === false && vib.length === 0)
  check('vibration: alarm uses the long pattern', SE.vibrateFor(cfgOf({ vibrate: true }), 'account.stopout') && vib[0].length >= 5)
  check('vibration: events without a class never vibrate', SE.vibrateFor(cfgOf({ vibrate: true }), 'order.modified') === false)
  delete globalThis.navigator
}

// ── bus ──
{
  const got = []
  const off = FX.registerSubscriber('probe', (e) => got.push(e))
  FX.emitTerminalEvent('order.cancelled')
  FX.emitTerminalEvent({ id: 'order.cancelled', text: 'custom', kind: 'win' })
  FX.emitTerminalEvent({ id: 'order.modified', text: null })
  check('bus: default toast text / kind from the catalogue', got[0].text === 'Order cancelled' && got[0].kind === 'info' && got[0].def.id === 'order.cancelled')
  check('bus: emitter text and kind override; null text kept', got[1].text === 'custom' && got[1].kind === 'win' && got[2].text === null)
  check('bus: unknown id returns false and reaches nobody', FX.emitTerminalEvent('nope') === false && got.length === 3)
  FX.registerSubscriber('bad', () => { throw new Error('x') })
  check('bus: a throwing subscriber does not stop the others', (FX.emitTerminalEvent('order.cancelled'), got.length === 4))
  off()
  check('bus: unsubscribe works; sound subscriber is built in', (FX.emitTerminalEvent('order.cancelled'), got.length === 4) && FX.subscriberNames().includes('sound'))
}

// ── settings: validation, defaults, migration ──
{
  const d = DEFAULT_CHART_SETTINGS.sounds
  check('defaults list every catalogue event', C.EVENT_IDS.every((id) => d.events[id] && d.events[id].sound === 'default' && d.events[id].volume === 100))
  const c = cleanChartSettings({ sounds: { volume: 900, pack: 'evil', vibrate: 'yes', events: { 'order.buy.filled': { on: false, volume: -4, sound: 'bell' }, 'order.sell.filled': { sound: 'nope' }, bogus: { on: false } } } })
  check('clean: volume clamped, bad pack / flag fall back', c.sounds.volume === 100 && c.sounds.pack === 'classic' && c.sounds.vibrate === false)
  check('clean: per-event values validated, unknown events dropped', c.sounds.events['order.buy.filled'].on === false && c.sounds.events['order.buy.filled'].volume === 0 && c.sounds.events['order.buy.filled'].sound === 'bell' && c.sounds.events['order.sell.filled'].sound === 'default' && !c.sounds.events.bogus)
  const old = cleanChartSettings({ v: 1, canvas: { bg: '#000000' } })
  check('migration: a save from before Phase 12 gets the full sounds block', old.sounds.pack === 'classic' && old.sounds.volume === 80 && Object.keys(old.sounds.events).length === C.EVENTS.length)
  const m = mergeChartSettings(old, { sounds: { events: { 'position.sl.hit': { on: false } } } })
  check('merge patch touches only that event', m.sounds.events['position.sl.hit'].on === false && m.sounds.events['position.tp.hit'].on === true && m.sounds.events['position.sl.hit'].volume === 100)
  check('merge: junk keeps the previous value', mergeChartSettings(m, { sounds: { pack: 'x' } }).sounds.pack === 'classic' && mergeChartSettings(m, { sounds: { volume: 'loud' } }).sounds.volume === 80)
}

process.exit(fail ? 1 : 0)
