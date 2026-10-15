// Phase 11 against the REAL store: drawing undo/redo, defaults, templates, clone/paste/reorder, cloud round-trip. Run via ./tests/run.sh.
const mem = new Map()
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() }
globalThis.window = globalThis
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const { useTerminalStore } = await import('../src/store/terminalStore.js')
const D = await import('../src/lib/terminal/drawings.js')
const CS = await import('../src/lib/terminal/cloudSync.js')
const A = await import('../src/components/terminal/chartActions.js')
const s = () => useTerminalStore.getState()
const SYM = 'EURUSD'
const times = Array.from({ length: 50 }, (_, i) => 1000 + i * 60)
const tm = D.makeTimeMap(times, 60)
const mk = (t = 'trend') => D.newDrawing(t, t === 'hline' ? [{ t: 1000, p: 1.1 }] : [{ t: 1000, p: 1.1 }, { t: 1600, p: 1.2 }])

s().addDrawing(SYM, mk()); s().addDrawing(SYM, mk('hline')); s().addDrawing(SYM, mk('rect'))
const ids = () => (s().drawings[SYM] || []).map((d) => d.id)
check('3 drawings, z increasing', ids().length === 3 && s().drawings[SYM].map((d) => d.z).join() === '0,1,2')
const [a, b, c] = ids()
s().removeDrawing(SYM, b)
check('remove', ids().length === 2)
check('undo restores it', s().undoDraw() && ids().length === 3)
check('redo removes again', s().redoDraw() && ids().length === 2)
check('new edit clears redo', (s().undoDraw(), s().updateDrawing(SYM, a, { color: '#ff0000' }), s().drawHist.future.length === 0))
check('Ctrl+Z reverts the colour', (A.undoAny(), s().drawings[SYM][0].color !== '#ff0000'))
// drag: one snapshot, many live edits, one undo
const before = s().drawings[SYM].find((d) => d.id === a).points
s().pushDrawHist()
for (let i = 1; i <= 5; i++) s().updateDrawing(SYM, a, { points: before.map((q) => ({ t: q.t + i * 60, p: q.p })) }, { hist: false })
check('drag: 5 live edits = 1 undo step', (A.undoAny(), s().drawings[SYM].find((d) => d.id === a).points[0].t === before[0].t))
// dialog cancel: push, edit, drop + replace
const orig = s().drawings[SYM].find((d) => d.id === a)
const n0 = s().drawHist.past.length
s().pushDrawHist(); s().updateDrawing(SYM, a, { width: 6 }, { hist: false })
s().replaceDrawing(SYM, orig); s().dropDrawHist()
check('dialog Cancel leaves no trace', s().drawings[SYM].find((d) => d.id === a).width === orig.width && s().drawHist.past.length === n0)
// z-order / clone / copy-paste
s().reorderDrawing(SYM, a, 'front')
check('bring to front', s().drawings[SYM].find((d) => d.id === a).z === Math.max(...s().drawings[SYM].map((d) => d.z)))
const dup = s().duplicateDrawing(SYM, a, tm)
check('duplicate: new id on top', dup && dup !== a && ids().length === 4 && s().drawings[SYM].find((d) => d.id === dup).z === 3)
check('copy + paste', s().copyDrawing(SYM, c) && !!s().pasteDrawing(SYM, tm) && ids().length === 5)
// defaults & templates
const t1 = s().drawings[SYM].find((d) => d.id === a)
s().setDrawDefault('trend', { ...t1, color: '#00ff00', width: 4 })
s().addDrawing(SYM, mk())
const last = s().drawings[SYM][s().drawings[SYM].length - 1]
check('next trend line uses the saved default', last.color === '#00ff00' && last.width === 4)
check('default does not touch other tools', (s().addDrawing(SYM, mk('rect')), s().drawings[SYM][s().drawings[SYM].length - 1].color !== '#00ff00'))
check('save template', s().saveDrawTemplate('trend', 'Thick', { ...t1, width: 7 }) && s().drawTemplates.trend[0].width === 7)
check('template: empty name rejected', !s().saveDrawTemplate('trend', '  ', t1))
s().deleteDrawTemplate('trend', 'Thick')
check('delete template', s().drawTemplates.trend.length === 0)
s().saveDrawTemplate('trend', 'Keep', { ...t1, width: 3 })
// bulk
s().setAllDrawings(SYM, { hidden: true })
check('hide all / lock all', s().drawings[SYM].every((d) => d.hidden) && (s().setAllDrawings(SYM, { locked: true }), s().drawings[SYM].every((d) => d.locked)))

// indicators: style / visibility / move / replace
const iid = s().addIndicator('stochrsi')
s().updateIndicator(iid, { styles: { k: { width: 4, hidden: true } }, visibility: { tfMin: 'M15', tfMax: 'H4' } })
let ind = s().indicators.find((i) => i.id === iid)
check('indicator: per-line style + visibility stored', ind.styles.k.width === 4 && ind.styles.k.hidden && ind.visibility.tfMin === 'M15')
s().updateIndicator(iid, { styles: { k: { lineStyle: 'dashed' } } })
ind = s().indicators.find((i) => i.id === iid)
check('indicator: style patches merge (width kept)', ind.styles.k.width === 4 && ind.styles.k.lineStyle === 'dashed')
const jid = s().addIndicator('volume')
s().moveIndicator(jid, -1)
check('indicator: move up changes the order', s().indicators[s().indicators.length - 2].id === jid)
const snapInd = JSON.parse(JSON.stringify(s().indicators.find((i) => i.id === iid)))
s().updateIndicator(iid, { params: { rsi: 30 } })
s().replaceIndicator(snapInd)
check('indicator: replace (dialog Cancel) restores the saved copy', s().indicators.find((i) => i.id === iid).params.rsi === 14)
// cloud round-trip keeps defaults & templates & v2 drawings
const snap = CS.snapshotOf(s())
const row = JSON.parse(JSON.stringify({ drawings: snap.drawings, settings: { v: 1, terminal: snap.settings, prefs: snap.prefs } }))
const back = CS.parseRow ? CS.parseRow({ ...row, account: null }) : null
if (back) {
  check('cloud: defaults survive', back.prefs.drawDefaults.trend?.color === '#00ff00')
  check('cloud: templates survive', back.prefs.drawTemplates.trend?.[0]?.name === 'Keep')
  check('cloud: drawings survive with style & lock', back.drawings[SYM].length === s().drawings[SYM].length && back.drawings[SYM].every((d) => d.locked && d.hidden))
}
// old save (no new fields) loads
mem.set('mindmap-terminal-storage', JSON.stringify({ version: 0, state: { drawings: { EURUSD: [{ id: 'x', type: 'trend', points: [{ t: 1, p: 1 }, { t: 2, p: 2 }], color: '#38bdf8', width: 2, dash: true }] } } }))
await useTerminalStore.persist.rehydrate()
const old = s().drawings.EURUSD[0]
check('old v1 drawing migrates (dash -> dashed)', old.style.lineStyle === 'dashed' && old.visibility && s().drawHist.past.length === 0 && s().drawMagnet === 'off')
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
