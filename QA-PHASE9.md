# Demo Terminal — Phase 9 report (Settings like a real terminal)

Legend: **PASS** = checked by an automated test or a scripted real-browser run (headless Chromium, 1440x900 and 360x740) ·
**PARTIAL** = logic tested, part of it not seen · **NOT BUILT** = deliberately left for a later phase.
Run everything with `bash tests/all.sh` (all green: 226 render checks, 64 + 18 new Phase 9 checks, build OK, import graph clean).

## 9.0 Bug fixes

| Item | Result |
|------|--------|
| `1W` timeframe + hotkeys `1`–`8` (key 8 used to crash: only 7 timeframes existed) | **PASS** — W1 added; keys map to the real list; shortcut text is generated from it. |
| Strategy Tester imports (`isFieldFilled`, `rrrToNumber`, `FIELD_BY_ID`) | **PASS** — exported; import-graph test now has 0 errors. (Strategy Tester behaviour itself was not click-tested.) |
| 'Clear all data' hard-coded password `1000` | **PASS (logic) / PARTIAL (UI)** — now re-checks the real Supabase password (`signInWithPassword`); Google / no-password accounts type `DELETE`. Not run against a real Supabase project. |

## 9.1 Architecture

- `src/lib/terminal/chartSettings.js` — defaults, validation (`cleanChartSettings`), merge, 6 themes + system, helpers. Pure.
- `src/lib/terminal/chartApply.js` — the only place that pushes settings into lightweight-charts; Heikin Ashi, colour-by-previous-close, series options.
- Store: `chartSettings` slice (persisted, cloud-synced inside `prefs.chart`, reset on account switch). Old saves / old cloud rows load with defaults and never wipe the local look.
- No hard-coded chrome colours left in the terminal components: panels read `--tm-*` CSS variables from the theme; the chart reads its colours from settings.
- `SettingsDialog` (+ `SettingsTabs`, `SettingsControls`): live preview, Cancel / Esc / ✕ revert, Ok keeps, Templates (device-only), Reset, Export / Import JSON, focus trap, full-screen sheet on phones.

## 9.2 Options — what is wired

| Tab | Options | Result |
|-----|---------|--------|
| Symbol | chart type ×7, body / border / wick colours + toggles, colour by previous close, line source / colour / width / type, area fills, baseline colours, thin bars, precision, time zone | **PASS** (unit-tested option objects; every chart type rendered in the browser) |
| Status line | symbol, description, market dot, OHLC (follows crosshair), change, volume, indicator titles + arguments, positions summary, opacity | **PASS** (seen in browser). Indicator *values* are not shown (Phase 11 legend). |
| Scales and lines | scale type (normal / log / % / indexed), auto, invert, lock, left / right, borders, margins, no-overlap, last label + line (colour / style / width), previous-close, bid, ask, high / low lines, countdown, bar spacing, right offset, seconds, 12 / 24 h, date format, keep last bar, crosshair mode / colour / style / width / labels | **PASS** (browser: countdown, prev, bid, ask, high, low, log scale seen) |
| Canvas | 6 presets + match system, solid / gradient background, grid V / H (colour, style), text colour + size, scale line + pane separator colours, watermark (off / symbol / symbol+tf / custom, colour, opacity, size, position), reset canvas | **PASS** (watermark, gradient, themes seen) |
| Trading | all Phase 8 options, confirm close / cancel, show positions / orders / executions, P/L unit on chart (money / pips / points / %), buy / sell / SL / TP / pending colours, line style + width | **PASS** (browser: pips label, execution arrow, positions hidden → 0 lines, confirm dialog) |
| Alerts | sounds on / off, notification time, keep screen on | **PASS** |

## Not built in this phase (so the dialog does not show dead toggles)

- Scale placement "both" (left + right at once) — only left or right.
- "Scroll to real-time" button, per-indicator *values* in the status line, indicator style editing → Phase 11.
- Reverse button, snap SL/TP, default SL/TP distance, margin-warning threshold, extend-lines → Phase 10 (they belong to the on-chart order desk).
- Time zone uses the zone's offset *now* for the whole history (a bar from before a DST change can be 1 h off).
- Per-event sounds → Phase 12; animations → Phase 13.

## Known gaps / NOT VERIFIED

- Light and Paper themes: the terminal's Tailwind text classes are remapped by CSS; the main screens were checked, but a few elements (disabled-looking buttons, the "Saved on this device only" pill) are still pale. Not every panel (History, Stats, Indicators panel) was checked in light mode.
- Real phone (touch, pinch) not tested; only a 360 px emulated viewport (dialog + chart load seen).
- Cloud sync round trip tested against the fake Supabase only.
- Templates are stored on this device only (not synced).
- Lint: the new files add a few `react/refs` style warnings (same kind the repo already has); build and tests are clean.

## Manual test list (≈5 minutes)

1. Gear (or `Alt+,`) → Canvas → try Light, Midnight, Match system; switch Gradient; Cancel and see it revert.
2. Symbol → try each chart type; turn on Colour by previous close.
3. Scales → turn on countdown, previous-close, bid / ask, high / low; Scale type = Logarithmic.
4. Trading → P/L unit = Pips, Show executions; open a BUY and look at the label and the arrow.
5. Reload the page: the look must be the same. Sign in on a second device: same look (needs your Supabase + the Phase 7 SQL).
6. Press `8`: the chart switches to 1W (it used to crash).
