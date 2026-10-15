# QA — Phase 11 (drawing tools + indicator settings)

Legend: PASS = seen working in a real browser (headless Chromium, Playwright, `tests/e2e-phase11/`). Unit = covered by `terminal-phase11*.test.mjs`. NOT BUILT / NOT VERIFIED as stated.

| Item | Result | Evidence |
| --- | --- | --- |
| All 21 savable tools can be created with the mouse (click / drag / 3-click / channel) + measure (never saved) | PASS | p11a (21 creates) |
| Every drawing survives a reload | PASS | p11a |
| Trend dialog: colour, width, line style, opacity, extend L/R, arrow start/end, stats, name | PASS | p11a; colour verified on the canvas (red pixel on the line) |
| Coordinates: typed price / time applied; bad input rejected, drawing unchanged | PASS | p11a |
| Visibility range (timeframe from … to …), hidden, locked | PASS (store); hiding in the scene PASS | p11a, p11b |
| Cancel reverts every change; Ok keeps; Ctrl+Z undoes the whole dialog in one step; Ctrl+Y redoes | PASS | p11a |
| Rectangle fill on / colour / opacity (green pixel painted, off removes it) | PASS | p11a, screenshot 11a-rect-fill |
| Fib: level on/off, value, colour, style, add level, labels/percent/prices/trend/bands/reverse/extend | PASS | p11a (scene level count checked) |
| Text: text, size, bold, italic, colour, align, background, border | PASS (store + screenshot) | p11a |
| Arrow marker direction; callout text typed on creation | PASS | p11b |
| Arrow keys nudge (bar / tick), Ctrl+C/V, Ctrl+D, Delete, Esc cancels half-made drawing | PASS | p11b |
| Ctrl+Z / Ctrl+Y for drawing edits; SL/TP changes still undone by Ctrl+Z (most recent first) | PASS (drawing) / PASS (store test for ordering) | p11b, `undoAny` |
| Right-click menu on a drawing (not the order menu): lock, hide, … | PASS | p11b |
| Object tree: list, hide all / show all, lock all, rename, reorder, delete, remove all | PASS | p11b |
| Locked drawing does not move when dragged | PASS | p11b |
| Magnet strong: line lands exactly on O/H/L/C of its bar | PASS | p11b (checked against the candle); weak mode unit only |
| Long / short: 4 anchors, readable default size, Target / Stop / R:R labels | PASS | p11b, screenshot 11b-long |
| Long / short P/L maths equals `engine.pnl` (EURUSD, XAUUSD, USDJPY, NIFTY50) | PASS (unit) | phase11 test |
| "Place this order" fills limit/stop/market + SL + TP in the ticket and places NOTHING | PASS | p11b |
| Next trend line uses your last default; other tools unaffected; template save / apply; persisted + in cloud snapshot | PASS (browser + store + cloud round-trip unit) | p11b, store test |
| Starred favourites appear in the strip | PASS | p11b |
| Old v1 drawings (`dash:true`) migrate; junk dropped | PASS (unit) | phase11 / phase7 tests |
| Volume (+MA) and StochRSI compute + render in panes | PASS | p11c, unit |
| Indicator dialog: inputs, per-line colour / width / style / show, pane height, collapse, timeframe range; Cancel reverts | PASS (store; pane count checked in the chart) | p11c |
| Legend rows: live values at the crosshair / last bar, eye, gear, remove; "Indicator values" setting hides numbers | PASS | p11c |
| Time-range hides the pane (3 → 2 panes), comes back on H1 | PASS | p11c |
| Reorder indicators (panes) in the panel | PASS | p11c |
| 360 px phone: flyout, tap-tap drawing, bar, dialogs as bottom sheets, tree, no page overflow | PASS | p11d 11/11 |
| Full suite `tests/all.sh` | ALL GREEN, 226 renders | — |

## NOT BUILT (asked for, left out — honest list)
- Brush, highlighter, pitchfork, icon / emoji stamp.
- Multi-select (Shift-click / rubber band) — one drawing at a time.
- "Visible on all symbols" — drawings are per symbol.
- Visibility as range sliders (done as From / To timeframe selects).
- Indicator "source" input (always close) and per-indicator price-scale options.

## NOT VERIFIED
- Real Supabase round-trip of templates / defaults (verified only against the snapshot code path).
- A physical phone (touch simulated in Chromium); touch press-drag drawing is done via tap-tap in tests.
- Weak-magnet and dragging a position-tool handle in the browser (unit-tested only).
- Light / Paper themes for the new dialogs.
