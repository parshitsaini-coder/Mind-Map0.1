// Phase 6 store behaviour: indicators, drawings, chart layouts, safe rehydration.
// Run through ./tests/run.sh (it mirrors src/ with .js import extensions).
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }

// A pre-Phase-6 save (no indicators/drawings/charts) plus junk in the new fields.
mem.set('mindmap-terminal-storage', JSON.stringify({
  version: 0,
  state: {
    symbol: 'GBPUSD', timeframe: 'H1', layout: 7, activeChart: 99,
    indicators: [{ id: 'a', type: 'sma', params: { period: 'abc' } }, { id: 'b', type: 'nope' }, null],
    drawings: { EURUSD: [{ id: 'x', type: 'hline', points: [{ t: 1, p: 1.1 }] }, { id: 'bad', type: 'trend', points: [] }], FAKE: [{ id: 'y', type: 'hline', points: [{ t: 1, p: 1 }] }] },
    charts: 'garbage',
  },
}))

const { useTerminalStore } = await import('../src/store/terminalStore.js')
const s = () => useTerminalStore.getState()

// ── rehydration ──
check('old save: layout falls back to 1', s().layout === 1)
check('old save: symbol/timeframe kept and mirrored into the active cell', s().symbol === 'GBPUSD' && s().timeframe === 'H1' && s().charts[s().activeChart].symbol === 'GBPUSD' && s().charts[s().activeChart].timeframe === 'H1')
check('4 chart cells always exist', s().charts.length === 4 && s().charts.every((c) => c.symbol && c.timeframe))
check('junk indicators dropped, params repaired', s().indicators.length === 1 && s().indicators[0].params.period === 20)
check('junk drawings dropped, unknown symbols ignored', s().drawings.EURUSD.length === 1 && s().drawings.FAKE === undefined)
check('drawing tool never starts armed', s().drawTool === 'cursor' && s().drawSel === null)

// ── indicators ──
s().clearIndicators()
const id1 = s().addIndicator('rsi')
check('addIndicator uses default params', s().indicators[0].params.period === 14 && s().indicators[0].visible)
check('unknown indicator type is refused', s().addIndicator('bogus') === null && s().indicators.length === 1)
s().updateIndicator(id1, { params: { period: '9' } })
check('param update is cleaned to a number', s().indicators[0].params.period === 9)
s().updateIndicator(id1, { params: { period: 99999 } })
check('param is clamped to its max', s().indicators[0].params.period === 200)
s().updateIndicator(id1, { colors: { rsi: '#ff0000' } })
check('colour override stored', s().indicators[0].colors.rsi === '#ff0000')
s().updateIndicator(id1, { visible: false })
check('hide toggle', s().indicators[0].visible === false)
for (let i = 0; i < 20; i++) s().addIndicator('sma')
check('indicator count is capped at 12', s().indicators.length === 12)
s().removeIndicator(id1)
check('removeIndicator', s().indicators.length === 11 && !s().indicators.some((i) => i.id === id1))
s().clearIndicators()
check('clearIndicators', s().indicators.length === 0)

// ── drawings ──
const mk = (id) => ({ id, type: 'trend', points: [{ t: 1, p: 1 }, { t: 2, p: 2 }], color: '#38bdf8', width: 2, dash: false, locked: false })
s().setSymbol('EURUSD')
s().clearDrawings('EURUSD')
s().setDrawTool('trend')
check('arming a tool deselects', s().drawTool === 'trend' && s().drawSel === null)
check('addDrawing stores and selects it, tool resets', s().addDrawing('EURUSD', mk('d1')) && s().drawings.EURUSD.length === 1 && s().drawSel === 'd1' && s().drawTool === 'cursor')
s().setDrawSticky(true); s().setDrawTool('trend'); s().addDrawing('EURUSD', mk('d2'))
check('sticky keeps the tool armed', s().drawTool === 'trend')
s().setDrawSticky(false); s().setDrawTool('cursor')
s().updateDrawing('EURUSD', 'd1', { color: '#ef4444', locked: true })
check('updateDrawing patches only that drawing', s().drawings.EURUSD[0].color === '#ef4444' && s().drawings.EURUSD[0].locked && s().drawings.EURUSD[1].color === '#38bdf8')
s().addDrawing('GBPUSD', mk('g1'))
check('drawings are per symbol', s().drawings.GBPUSD.length === 1 && s().drawings.EURUSD.length === 2)
s().setDrawSel('d2'); s().removeDrawing('EURUSD', 'd2')
check('removeDrawing clears selection of that drawing', s().drawings.EURUSD.length === 1 && s().drawSel === null)
s().setDrawTool('rect'); s().setDrawSel('d1')
check('escapeDraw: 1st Esc disarms the tool', s().escapeDraw() === true && s().drawTool === 'cursor' && s().drawSel === 'd1')
check('escapeDraw: 2nd Esc deselects', s().escapeDraw() === true && s().drawSel === null)
check('escapeDraw: 3rd Esc is not consumed (screen may close)', s().escapeDraw() === false)
s().setDrawSel('d1'); s().setDrawHidden(true)
check('hiding drawings deselects', s().drawHidden === true && s().drawSel === null)
s().setDrawHidden(false)
for (let i = 0; i < 400; i++) s().addDrawing('EURUSD', mk(`m${i}`))
check('per-symbol drawing cap (300)', s().drawings.EURUSD.length === 300)
s().clearDrawings('EURUSD')
check('clearDrawings', s().drawings.EURUSD.length === 0)

// ── layouts / active chart ──
s().setLayout(4)
s().setActiveChart(2)
check('activating a cell loads its symbol/timeframe', s().symbol === s().charts[2].symbol && s().timeframe === s().charts[2].timeframe && s().drawSel === null)
s().setSymbol('USDJPY'); s().setTimeframe('M30')
check('symbol/timeframe changes update only the active cell', s().charts[2].symbol === 'USDJPY' && s().charts[2].timeframe === 'M30' && s().charts[0].symbol !== 'USDJPY')
s().setLayout(2)
check('shrinking the layout re-activates cell 0', s().activeChart === 0 && s().symbol === s().charts[0].symbol)
check('cell 2 keeps its settings while hidden', s().charts[2].symbol === 'USDJPY')
s().setActiveChart(1)
s().setLayout(4); s().setActiveChart(3); s().setLayout(1)
check('layout 1 → active 0', s().activeChart === 0)
s().setActiveChart(9)
check('invalid cell index ignored', s().activeChart === 0)

// ── persistence round trip ──
const saved = JSON.parse(mem.get('mindmap-terminal-storage')).state
check('new fields are persisted', 'indicators' in saved && 'drawings' in saved && 'layout' in saved && 'charts' in saved && 'activeChart' in saved)
check('tool/selection are NOT persisted', !('drawTool' in saved) && !('drawSel' in saved))

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
