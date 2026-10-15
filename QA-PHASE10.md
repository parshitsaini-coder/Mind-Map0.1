# QA — Phase 10 (manage positions on the chart)

Legend: PASS = seen working in a real browser (headless Chromium, Playwright, scripts in `tests/e2e-phase10/`). PARTIAL / NOT VERIFIED as stated.

| Item | Result | Evidence |
| --- | --- | --- |
| Position pill: side+lots, live P/L chip, close, reverse, ⋯ menu | PASS | p10a/p10c, screenshots 01, 11, 12 |
| Chip cycles money → pips → % → R and is stored in settings | PASS | p10b (`−$0.09 → −2.2 pips → −0.00% → −0.01 R`) |
| P/L shown on the chip equals the Positions panel / ledger | PASS | chip and panel both `−$0.09`; unit test: overlay P/L == closed-trade P/L for EURUSD, XAUUSD, USDJPY, NIFTY50 × buy/sell |
| SL / TP tags with $, pips, %, R | PASS | `SL −$14.86 (−148.6 pips) −0.15 %`, `TP +$12.06 (+120.6 pips) +0.12 % R 0.8` |
| Drag SL / TP: live tag, order unchanged until release, one change on release, persists after reload | PASS | p10b 21/21 |
| Invalid drag: amber + reason, springs back, error toast | PASS | p10b, screenshot 05 |
| Price scale does not run away while dragging | PASS | bug found and fixed (scale is not re-fitted mid-drag) |
| +SL / +TP place mode with ghost line + projected P/L | PASS | p10b, screenshot 02 |
| Quick bracket from default distances (one change) | PASS | p10c |
| Undo: Ctrl+Z and toast button | PASS (Ctrl+Z in browser, toast button exists; store test covers the action) | p10b, store test |
| Close half / custom lots (rejects whole / bad step) / reverse / break-even refusal / trail / copy id | PASS | p10c |
| Pending order pill, drag, cancel from pill; +SL / +TP / ⚡ on the pending order (added after review) | PASS | p10c, p10i 7/7, screenshot 60 |
| Right-click menu → limit placed; Draw horizontal line; hover "+" | PASS | p10c |
| Touch at 360 px: pill fits, buttons ≥ 40 px, tap place, touch drag, long-press menu, no page scroll | PASS | p10d 11/11 (mid-drag position read is timing-flaky in the script; the release result and the screenshot are right) |
| Account strip (amber under warn level, bottom-right on phones) | PASS | p10g, screenshot 41 |
| Red (stop-out) strip state | NOT VERIFIED in browser (unit-tested `marginState`) | |
| Settings: confirm close, pill off, extend lines, R unit, snap round | PASS | p10e 8/8 |
| 10 positions: pills don't overlap, panning | PASS (avg 17.8 ms/frame in headless software rendering; NOT measured on a real device) | p10f |
| 2-chart layout: pill only on the matching chart, one strip | PASS | p10h |
| Execution tooltip | NOT VERIFIED (code + build only; needs a closed trade under the crosshair) | |
| Light theme | PARTIAL — pills/menus use theme variables and are readable; toasts and disabled buttons are pale | screenshot 40 |
| Real phone, real Supabase sync of `log` / new settings | NOT VERIFIED | |
| Add price alert (menu) | NOT BUILT — no alert system exists | |

Tests: `bash tests/all.sh` ALL GREEN (phase 10: 56 + 18 checks; 226 renders; build OK). One lint warning (refs in PositionPills).

## Bugs found and fixed while testing
- Undo ids collided when two changes landed in the same millisecond (undo removed both) → counter ids.
- Price scale re-fitted during a drag and the line ran away → no re-fit until release.
- The hover "+" disappeared when the mouse moved onto it → pointerleave check.
- Account strip overlapped the OHLC text on phones → moved to the bottom, fewer cells.

## Manual test list for you
1. Buy, press ⚡, drag SL and TP, watch the tags; release, reload.
2. Drag SL above the price → amber + reason, line returns.
3. ⋯ → Close half, Close custom lots, Trail SL; click the P/L chip 4×.
4. Right-click the chart → Buy limit; drag the order; cancel from its pill.
5. Settings → Trading: snap, default SL/TP, margin warning, turn the pill off.
6. On a phone: long-press the chart, drag SL with a finger.
