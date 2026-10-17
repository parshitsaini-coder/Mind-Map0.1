// Phase 8 against the REAL store: settings sanitising/migration, commission + slippage through the
// store actions, spread mode following the setting, cloud round-trip of the new fields.
// Run through ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// An OLD save (before Phase 8) has a settings object without the new keys, plus junk values.
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { settings: { oneClick: true, lots: 0.5, stopOutLevel: 30, sound: false, spreadMode: 'wild', slippage: 'yes', lots2: 1 } } }))
await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore, cleanSettings } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const { getSpreadMode } = await import('../src/lib/terminal/feed/spread.js')
const C = await import('../src/lib/terminal/cloudSync.js')
const s = () => useTerminalStore.getState()
const Q = { EURUSD: { bid: 1.0999, ask: 1.1001 } }
const H = await import('../src/components/terminal/phase8Hooks.js')

check('old save: existing settings kept', s().settings.oneClick === true && s().settings.lots === 0.5 && s().settings.stopOutLevel === 30 && s().settings.sound === false)
check('old save: new settings get defaults (not undefined)', s().settings.spreadMode === 'fixed' && s().settings.slippage === false && s().settings.wakeLock === false)
check('old save: junk values are dropped, unknown keys removed', s().settings.lots2 === undefined)

const c = cleanSettings({ lots: -1, stopOutLevel: 500, spreadMode: 'variable', slippage: true, oneClick: 'x', autoSince: -4 })
check('cleanSettings clamps / ignores bad values', c.lots === 0.01 && c.stopOutLevel === 50 && c.spreadMode === 'variable' && c.slippage === true && c.oneClick === false && c.autoSince === 0)
check('cleanSettings(null) = defaults', cleanSettings(null).lots === 0.01 && cleanSettings(undefined).spreadMode === 'fixed')

s().resetLocalData()
s().setSettings({ spreadMode: 'variable' })
check('spread mode setting drives the feed', getSpreadMode() === 'variable')
s().setSettings({ spreadMode: 'fixed' })
check('…and back', getSpreadMode() === 'fixed')
s().setSettings({ lots: 9999, stopOutLevel: -3 })
check('setSettings refuses out-of-range numbers (keeps old values)', s().settings.lots === 0.01 && s().settings.stopOutLevel === 50)

// commission through the store
check('setCommission rejects negatives / junk / > max', !s().setCommission(-1).ok && !s().setCommission('abc').ok && !s().setCommission(101).ok && !s().setCommission(NaN).ok)
check('setCommission(7) lands on the account', s().setCommission(7).ok && s().account.commission === 7)
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 1 }, Q)
s().closePosition('p1', { EURUSD: { bid: 1.1011, ask: 1.1013 } })
const t = s().history[0]
check('closing through the store charges commission (net $93, commission 7)', Math.abs(t.pnl - 93) < 0.01 && t.commission === 7 && Math.abs(s().account.balance - 10093) < 0.01)
s().resetAccount(5000, 50)
check('resetAccount keeps the commission setting', s().account.commission === 7 && s().account.balance === 5000 && s().history.length === 0)
s().setCommission(0)

// slippage through the store (Math.random pinned to the worst case = 0.5 pip)
const realRandom = Math.random
Math.random = () => 1
s().setSettings({ slippage: true })
s().openPosition({ symbol: 'EURUSD', side: 'buy', lots: 0.1 }, Q)
check('slippage ON: BUY fills 0.5 pip above the ask', s().positions[0].entry === 1.10015, String(s().positions[0].entry))
s().closePosition(s().positions[0].id, Q)
check('slippage ON: closing that long fills 0.5 pip below the bid', s().history[0].exit === 1.09985, String(s().history[0].exit))
s().setSettings({ slippage: false })
s().openPosition({ symbol: 'EURUSD', side: 'sell', lots: 0.1 }, Q)
check('slippage OFF: SELL fills exactly at the bid', s().positions[0].entry === 1.0999)
Math.random = realRandom

// keyboard shortcuts stay out of the way of typing and browser shortcuts
check('shortcuts are ignored while typing in a field', H.isTypingTarget({ target: { tagName: 'INPUT' } }) && H.isTypingTarget({ target: { tagName: 'TEXTAREA' } }) && H.isTypingTarget({ target: { tagName: 'SELECT' } }) && H.isTypingTarget({ target: { tagName: 'DIV', isContentEditable: true } }))
check('…and with Ctrl / Cmd / Alt held (browser shortcuts, e.g. Ctrl+S)', H.isTypingTarget({ ctrlKey: true, target: { tagName: 'DIV' } }) && H.isTypingTarget({ metaKey: true, target: {} }) && H.isTypingTarget({ altKey: true, target: {} }))
check('…but active on the chart / page', !H.isTypingTarget({ target: { tagName: 'DIV' } }) && !H.isTypingTarget({ target: { tagName: 'BUTTON' } }) && !H.isTypingTarget({ target: null }))
check('shortcut list documents B/S, Enter, Esc, 1–8, zoom', ['B / S', 'Enter', 'Esc', '1 – 8'].every((k) => H.SHORTCUTS.some(([key]) => key === k)))
check('wake lock reports unsupported where the API is missing', H.wakeLockSupported() === false)

// hotkey plumbing
s().fireHotkey('buy')
check('fireHotkey records side + stamp; ticketPending starts false', s().hotkey.side === 'buy' && Number.isFinite(s().hotkey.n) && s().ticketPending === false)
check('hotkey / ticketPending are not persisted', (() => { const st = JSON.parse(mem.get('mindmap-terminal-storage')).state; return !('hotkey' in st) && !('ticketPending' in st) })())

// cloud round-trip of the new fields
{
  s().resetLocalData()
  s().setSettings({ spreadMode: 'variable', slippage: true, wakeLock: true, oneClick: true })
  s().setCommission(3.5)
  const { row } = C.buildRow(s())
  check('cloud row carries spread mode, slippage and commission — but NOT wakeLock (device-only)', row.settings.terminal.spreadMode === 'variable' && row.settings.terminal.slippage === true && row.settings.terminal.wakeLock === undefined && row.account.account.commission === 3.5)
  const snap = C.parseRow(JSON.parse(JSON.stringify(row)))
  check('cloud parse restores them', snap.settings.spreadMode === 'variable' && snap.settings.slippage === true && snap.account.commission === 3.5)
  const bad = C.parseRow({ ...JSON.parse(JSON.stringify(row)), account: { ...row.account, account: { ...row.account.account, commission: 99999 } }, settings: { ...row.settings, terminal: { spreadMode: 'wild', slippage: 'y' } } })
  check('cloud parse rejects absurd commission / bad enum', bad.account.commission === undefined && bad.settings.spreadMode === undefined && bad.settings.slippage === undefined)
  s().resetLocalData()
  s().setSettings({ wakeLock: true })
  s().applyCloud(snap)
  check('applyCloud: spread mode switches the feed, wake-lock stays a local choice', getSpreadMode() === 'variable' && s().settings.wakeLock === true && s().account.commission === 3.5)
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
