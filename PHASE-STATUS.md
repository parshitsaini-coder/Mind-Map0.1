# Demo Terminal — phase status

| Phase | Status |
| --- | --- |
| 1–8 | DONE (simulated feed, ledger / engine, orders, indicators, drawings, cloud sync, Phase 8 settings + QA) |
| 9 | DONE — Settings dialog, chart themes, 7 chart types, status line, price lines, watermark, executions, W1, clear-data password fix |
| 10 | **DONE** — on-chart position management (see below) |
| 11 | **DONE** — drawing tools + indicator settings, TradingView-style (see below) |
| 12 | **DONE** — sound engine: event bus + catalogue, Web Audio sounds, packs, Sounds tab (see below) |
| 13 | **DONE** — order popups, toast redesign, chart effects, row / number motion, Animations tab (see below) |
| 14 | TODO — live data API, remove simulator |
| 15 | TODO — final QA + release |

## Phase 10 — what was built
- `src/lib/terminal/chartOrders.js` (pure): `plFigures / fmtFigure / levelTag / nextPlUnit`, `validateDrag` (engine rules), `snapPrice / barLevels / breakEvenSnap`, `defaultStop / atrOf`, `validateCloseLots`, `marginState`, `createUndo`, `spreadY`.
- `PositionPills.jsx` — DOM overlay glued to the price scale by a rAF loop (no React work while panning): position pill (side+lots, live P/L chip that cycles money→pips→%→R, +SL / +TP place mode, quick bracket ⚡, reverse, close ×, ⋯ menu: close half, close custom lots, move SL to break-even, add SL/TP, trail SL, copy ticket id), pending-order pill (type, lots, price, cancel ×), `PlaceLayer` (ghost line + projected P/L).
- `ChartTrading.jsx` — drag with live tags (`SL −$45.00 (−15.0 pips) −0.45 %`, `TP … R 2.0`), validation while dragging (amber + reason, springs back), snap (off / round / bars; Shift = tick, Ctrl = 10 pips), SL break-even magnet, grab offset kept (touch), scale NOT re-fitted mid-drag, right-click / long-press menu (limit / stop, Draw horizontal line), hover "+" on the price scale, Ctrl+Z.
- `chartActions.js` — `commitPatch` (one modify call + toast with Undo + undo stack), `undoLast`.
- `ChartAccountStrip.jsx` (Balance / Equity / Floating / Margin level; amber under `marginWarn`, red under stop-out; bottom-right on phones), `ExecTooltip.jsx` (price / lots / P/L on execution markers).
- Store: `closeLots`, `notify(text, kind, action)`, `ticketPrefill / prefillTicket`; ledger: per-position `log` of SL/TP changes (cap 30). OrderTicket consumes the prefill; Toasts show an action button.
- New settings (`chartSettings.trading`): `plUnit` += `r`, `showPlPill, reverseBtn, extendLines, snap, defSlUnit/defSlValue, defTpUnit/defTpValue, marginWarn` — all in the Trading tab.
- Tests: `tests/terminal-phase10.test.mjs` (56), `tests/terminal-phase10-store.test.mjs` (18), real-browser scripts in `tests/e2e-phase10/`.

## Phase 11 — what was built
- Drawing schema v2 (`DRAWING_SCHEMA = 2`, old saves migrate: `dash` → `style.lineStyle`): `style` (opacity, lineStyle, extendLeft/Right, arrowStart/End, fill, fillColor, fillOpacity, labels, stats, fib options), `textStyle`, `levels`, `visibility {tfMin, tfMax}`, `z`, `locked`, `hidden`, `name`.
- Pure layer: `drawingGeom.js` (time map, projector, hit-test), `drawingTools.js` (tool registry — each tool declared once: layout, tabs, category), `drawings.js` (clean / migrate, move / nudge / setAnchor, magnet, reorder, clone, templates).
- 22 tools: trend, ray, extended line, arrow, horizontal line, horizontal ray, vertical line, parallel channel, fib retracement, fib extension, rectangle, ellipse, triangle, text, callout, arrow marker, long position, short position, price range, date range, date+price range, measure (never saved).
- UI: grouped toolbar with flyouts + starred favourites (`DrawToolbar.jsx`), floating bar (`DrawingBar.jsx`: colour, width, style, fill, text, **Place order**, front / back, clone, lock, hide, settings, delete), settings dialog (`DrawingDialog.jsx`: Style · Text · Levels · Coordinates · Visibility, live preview, Cancel reverts everything, Ok commits, Template ▾ Save as / Apply / Set as default), right-click menu, object tree (`ObjectTree.jsx`: eye, lock, rename, up / down, settings, delete, hide-all / lock-all / remove-all), magnet off / weak / strong, keyboard: Delete, Ctrl+C / V / D, arrows (Shift = 10), Esc, Ctrl+Z / Ctrl+Y for ALL chart edits (`undoAny` picks drawing edit or SL/TP change by time).
- Long / short tools use the engine's own P/L maths; "Place this order" fills the ticket (type market / limit / stop from entry vs live price, plus SL and TP) — it never sends an order by itself.
- Store: undo / redo history (not persisted), per-tool defaults and named templates (synced through the account snapshot `prefs`), clone / paste / reorder, magnet, favourites.
- Indicators: new **Volume (+MA)** and **Stochastic RSI** (14 total); `IndicatorDialog.jsx` (Inputs · Style · Visibility: per-line colour / width / style / show, pane height, collapse pane, timeframe range); legend rows in the status line with live value at the crosshair + eye / gear / remove; move up / down in the panel; new status setting "Indicator values".
- Tests: `terminal-phase11.test.mjs`, `terminal-phase11-store.test.mjs`, real-browser scripts `tests/e2e-phase11/` (p11a tools + every dialog control, p11b interaction, p11c indicators, p11d 360 px). See `QA-PHASE11.md`.

## Phase 12 — what was built
- One catalogue `lib/terminal/eventCatalog.js` (21 events: id, category, priority, default sound, animation id for Phase 13, toast text, loud flag, haptic class, `live`). Reserved events with no emitter yet (`alert.price`, `connection.*`, `ui.*`) stay in the catalogue and the playground but are hidden from the Sounds tab.
- One bus `lib/terminal/effects.js`: `emitTerminalEvent(evt)` → subscribers `sound` (built in, also vibrates), `toast` (registered by the store), and `chart` (Phase 13 registers its renderer with `registerSubscriber('chart', fn)`). Every store action (market fills, pending placed / cancelled / modified / triggered, closes win / loss / flat, partial, reverse, SL / TP / stop-out / expired / OCO / rejected from ticks and offline catch-up) and the margin warning (`ChartAccountStrip`, once per drop, 60 s cooldown) go through it.
- Sounds are data (`soundDesign.js`: 18 note lists + pure `playSound(ctx, id, when, volume, pack)`), packs are data tables: Classic, Soft, Arcade, Silent pro. No audio files. Peak gain capped so the alarm is never louder than the master allows.
- Engine (`soundEngine.js`): context created / resumed on the first pointer / key event; "Tap to enable sound" chip only if the context is still suspended when a sound is due; 100 ms coalescing (highest-priority audible event plays once; toasts are unaffected); max 6 sounds / s; settings read at play time; never throws without Web Audio; vibration patterns per class.
- Settings → **Sounds** tab: master on/off (still `settings.sound`, so old saves migrate and sync), master volume, mute in background, vibration, pack + preview, Test all, Reset sounds, per-event rows (switch, sound choice, volume, ▶). Stored in `chartSettings.sounds` (validated from the catalogue, synced with the account). The old Alerts-tab switch is now a read-only status line pointing to Sounds.
- Dev "Effects playground": `?lab=1` in a dev build, or tap the version line in Settings → Alerts 5 times (works in any build).
- Tests: `terminal-phase12.test.mjs` (62 checks, stubbed AudioContext), `terminal-phase12-store.test.mjs` (20, real store), real browser `tests/e2e-phase12/` (p12: 19 checks incl. real oscillator counts; p12-mobile-lab: 360 px + `?lab=1`). See `QA-PHASE12.md`.
- Phase 12 NOT built: per-event custom sound file upload (≤ 200 KB, IndexedDB); price alerts and connection events have sounds in the catalogue but nothing emits them yet (Phase 13/14).

## Phase 13 — what was built
- Same bus as Phase 12 (`effects.js`): new built-in subscribers `chart` (→ `chartFx.js` listeners) and, from the store, `popup` and `toast`. Emitters now pass `data` (symbol, side, lots, price, SL / TP, slippage in pips, P/L, order type, distance, old → new for modifies) — the order is already placed before any animation starts.
- Pure: `motionPolicy.js` (Full / Reduced / Off, match-system, adaptive downgrade, toast rules, frame-time watchdog), `popupModel.js` (event → popup: titles, lines, slippage text, count-up / roll that end EXACTLY on the final value), `chartFx.js` (effect specs per event, capped queue of 6, canvas drawing functions, seeded particles).
- UI: `OrderPopup.jsx` (centred top / bottom, spring entrance, SVG circle + tick drawing itself, ripple, P/L count-up, price roll, shake on rejection, sparkles on wins, click / Esc / swipe dismiss, 1–4 s), `Toasts.jsx` redesigned (stacked max 4, spring, icon per event, progress bar, pause on hover, swipe away, Undo / View buttons), `ChartFx.jsx` (one transparent canvas per chart, ONE shared rAF loop that sleeps when idle and stops in a hidden tab; effects: entry sweep, ring, glow pulse + LIMIT FILLED / STOP TRIGGERED badge, TP shockwave + particles + counting badge, SL crack + shake + badge, margin border pulse, stop-out vignette, price-alert rings, line fade on cancel), `StopoutBanner.jsx` (stays until dismissed), `AnimNum.jsx` (120 ms green / red flash, balance counts), Positions / Orders / History rows slide in / out with `layout`, margin pulse on the account strip, button press feedback, `data-motion` on the terminal root.
- Settings → **Animations**: mode Full / Reduced / Off, match system reduced-motion (default ON), popup Full / Toast only / Off (errors always toast), popup time, position, also show toast, per-effect toggles (chart effects, particles, shake, list motion). Adaptive: if frames average > 24 ms for a second the session drops to Reduced and says so once.
- Effects playground (`?lab=1`) buttons now carry sample data, so every popup / chart effect can be previewed.
- Tests: `terminal-phase13.test.mjs` (50), `terminal-phase13-store.test.mjs` (26), real browser `tests/e2e-phase13/p13.mjs` (34 checks, run at 1440 px and 360 px with filmstrip screenshots and frame timings). See `QA-PHASE13.md`.
- Phase 13 NOT built: shared-element morph of the pending pill into the position pill (a glow + badge is used instead), SL / TP drag ghost line with spring smoothing and amber invalid tint, confetti for a new best trade, bottom-sheet / dialog spring transitions for the ticket and Settings, sliding tab underline, per-tick colour flash on the pill P/L chip (flash is on the account bar and strip), price-alert emitter (effect exists, nothing triggers it yet), the "Fix" button on a rejection popup (model supports it; nothing marks a rejection fixable yet).

## Known gaps / decisions
- "Add price alert" in the chart menu NOT built: the terminal has no price-alert system yet (candidate for Phase 12/13 event bus).
- Validation uses the engine's rules (BUY SL must be below the current bid), not "SL < entry": a locked-in-profit SL above entry is legal.
- "+SL/+TP" place mode works by click / tap; there is no separate long-press variant.
- Toasts (top centre) can cover a line near the top of the chart for ~4.5 s; the pill menu can be clipped at the chart's bottom edge.
- extendLines OFF hides the SL/TP line body (axis tag stays; the line shows while dragging).
- Not done from the Phase 9 backlog: scale placement "both" (not in the Phase 10 list).
- Light / Paper themes still have pale elements (toasts, disabled buttons).
- Phase 11 NOT built: brush, highlighter, pitchfork, icon / emoji stamp, multi-select (Shift-click / rubber band), "visible on all symbols" (drawings stay per symbol), visibility as sliders (min / max timeframe selects instead), indicator "source" input and price-scale options.

## Layout update (after Phase 13)
- Interface size **Compact** (default) / Normal: top bar, timeframe row, drawing toolbar, account bar and footer shrink (26 / 24 / 26 / 22 / 16 px; chart starts ~54 px higher). Settings → Alerts → This device; stored on this device (`uiDensity`).
- **Trade** button in the top-right corner (desktop) hides / shows the Buy / Sell ticket panel (`tradePanelOpen`, remembered); also a switch in the same Settings group. Mobile keeps the bottom Buy / Sell bar.
- Browser check: `tests/e2e-phase13/layout.mjs` (7 checks).
