// Phase 9 against the REAL store: old saves load with default chart settings, patches are validated,
// chart type is validated, persistence, cloud round trip (row <-> store, incl. old rows without the field),
// sign-out reset. Run through ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }

// An OLD save (Phase 8) has no chartSettings and a chartType the new code must keep.
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { chartType: 'line', settings: { oneClick: true } } }))
await import('./fixtures/legacyInstruments.js') // test-only legacy symbols (the app is XAUUSD-only)
const { setTradeGate, useTerminalStore } = await import('../src/store/terminalStore.js')
setTradeGate(() => null) // Phase 14: no live feed in unit tests
const C = await import('../src/lib/terminal/cloudSync.js')
const CS = await import('../src/lib/terminal/chartSettings.js')
const s = () => useTerminalStore.getState()

check('old save: chart settings default, old chart type kept', JSON.stringify(s().chartSettings) === JSON.stringify(CS.DEFAULT_CHART_SETTINGS) && s().chartType === 'line' && s().settings.oneClick === true)

s().setChartSettings({ canvas: { bg: '#102030' }, scales: { mode: 'log', countdown: true } })
check('setChartSettings merges a partial patch', s().chartSettings.canvas.bg === '#102030' && s().chartSettings.scales.mode === 'log' && s().chartSettings.scales.countdown === true && s().chartSettings.symbol.up === CS.DEFAULT_CHART_SETTINGS.symbol.up)
s().setChartSettings({ canvas: { bg: 'banana' }, scales: { mode: 'sqrt' } })
check('setChartSettings refuses bad values and keeps the previous valid ones', s().chartSettings.canvas.bg === '#102030' && s().chartSettings.scales.mode === 'log')

s().setChartType('heikin')
check('setChartType accepts all new types', s().chartType === 'heikin')
s().setChartType('renko')
check('setChartType ignores unknown types', s().chartType === 'heikin')

// persistence: the persisted JSON carries chartSettings, and a fresh load restores it
s().setChartSettings({ symbol: { up: '#0000ff' }, canvas: { wmMode: 'symbol' } })
const saved = JSON.parse(mem.get('mindmap-terminal-storage'))
check('chart settings are persisted', saved.state.chartSettings.symbol.up === '#0000ff' && saved.state.chartSettings.canvas.wmMode === 'symbol' && saved.state.chartType === 'heikin')

// corrupted persisted value never crashes the load
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { chartSettings: { canvas: 5, scales: 'x', symbol: { up: 7 } }, chartType: 'nope' } }))
await useTerminalStore.persist.rehydrate()
check('corrupted saved chart settings / chart type fall back to defaults', JSON.stringify(s().chartSettings) === JSON.stringify(CS.DEFAULT_CHART_SETTINGS) && s().chartType === 'candles')

// theme action
s().applyChartTheme('light', true)
check('applyChartTheme: light', s().chartSettings.theme === 'light' && s().chartSettings.canvas.bg === '#ffffff')
s().applyChartTheme('dark', true)
check('applyChartTheme: dark restores the default canvas', s().chartSettings.canvas.bg === CS.DEFAULT_CHART_SETTINGS.canvas.bg)

// replace (used by Cancel in the dialog) validates too
s().replaceChartSettings({ canvas: { bg: '#334455' } })
check('replaceChartSettings: validated, fills the rest with defaults', s().chartSettings.canvas.bg === '#334455' && s().chartSettings.scales.mode === 'normal')

// ── cloud round trip ──
s().resetChartSettings()
s().setChartSettings({ canvas: { bg: '#0a0b0c', bgType: 'gradient' }, symbol: { colorByPrev: true, tz: 'Asia/Kolkata' }, trading: { plUnit: 'pips', showExecutions: true } })
s().setChartType('hollow')
const { row } = C.buildRow(s())
check('buildRow carries chart settings inside the settings column', row.settings.prefs.chart.canvas.bg === '#0a0b0c' && row.settings.prefs.chartType === 'hollow')
const snap = C.parseRow(JSON.parse(JSON.stringify(row)))
check('parseRow returns them, validated', snap.prefs.chart.canvas.bgType === 'gradient' && snap.prefs.chart.symbol.tz === 'Asia/Kolkata' && snap.prefs.chartType === 'hollow')
s().resetLocalData()
check('sign-out / account switch resets the look to defaults', JSON.stringify(s().chartSettings) === JSON.stringify(CS.DEFAULT_CHART_SETTINGS) && s().chartType === 'candles')
s().applyCloud(snap)
check('applyCloud restores chart settings + chart type on the second device', s().chartSettings.canvas.bg === '#0a0b0c' && s().chartSettings.trading.plUnit === 'pips' && s().chartType === 'hollow')

// an OLD cloud row (no `chart` in prefs) must not wipe this device's look
const oldRow = JSON.parse(JSON.stringify(row)); delete oldRow.settings.prefs.chart; oldRow.settings.prefs.chartType = 'line'
const oldSnap = C.parseRow(oldRow)
check('old cloud row parses with chart = null', oldSnap.prefs.chart === null && oldSnap.prefs.chartType === 'line')
s().setChartSettings({ canvas: { bg: '#445566' } })
s().applyCloud(oldSnap)
check('…and applying it keeps the local chart settings', s().chartSettings.canvas.bg === '#445566' && s().chartType === 'line')
check('a garbage chart type in a cloud row falls back to candles', C.parseRow({ ...JSON.parse(JSON.stringify(row)), settings: { ...row.settings, prefs: { ...row.settings.prefs, chartType: 'zzz' } } }).prefs.chartType === 'candles')

// a settings change marks the account as having something new to upload
check('chartSettings is a synced key', C.SYNCED_KEYS.includes('chartSettings'))

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
