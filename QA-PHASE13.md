# QA — Phase 13 (animations, effects, order popups)

## Automated (`tests/all.sh`)
- `terminal-phase13.test.mjs` — 50 checks: every catalogue event has a popup mapping and is visible (popup or chart effect), popup text (slippage worse / better, SL / TP, order type, modified old → new, rejected reason, closed win / loss / flat, stop-out banner), count-up and roll end exactly on the final value, motion policy matrix (Full / Reduced / Off, match system, adaptive), toast rules, frame watchdog (trips at > 24 ms average, quiet at 60 fps, ignores hidden-tab gaps), effect specs per event, reduced = only flash / badge / border, queue capped at 6, drawing never throws, settings validation + old saves.
- `terminal-phase13-store.test.mjs` — 26 checks on the real store: popup / toast follow Animations settings (full, also-toast off, toast only, popup off with errors still shown, Animations Off), event data (slippage, order type, distance, modify old / new, exit price), tick-driven limit fill and SL hit produce the right popup, stop-out banner, max 4 toasts, persistence (popup / banner / adaptive are not saved).
- Real browser (Playwright, headless Chromium): `tests/e2e-phase13/p13.mjs` 34/34 at 1440 px and at 360 px (touch). Covers a market buy popup (entrance ≈ 100 ms), click / Esc dismiss, all 12 popup variants, P/L count-up lands on +$90.00, canvas pixels drawn for the fill sweep and the TP shockwave and clean afterwards, 12 events at once keep ≤ 6 effects, stop-out banner (stays until dismissed), SL hit through the real engine, Animations tab, Off mode (plain toast), `prefers-reduced-motion` (+ match-system off), toast stack ≤ 4. Screenshots: `e2e-shots/13-*.png`.
- Frame timing during a 6-effect burst (headless software rendering): avg 17.6 ms / p95 33 ms at 1440 px, avg 17.2 ms / p95 16.8 ms at 360 px; the adaptive downgrade did not trigger. This is a software-rendered headless browser capped near 60 Hz, **not** a real GPU or phone.

## Acceptance
| Criterion | Result |
| --- | --- |
| every catalogue event has a distinct visible animation and sound | Visible: popup and / or chart effect for every live event (tested). Sound from Phase 12. `ui.*` and `connection.*` have no visual (nothing emits them yet) |
| Off mode shows plain toasts | PASS |
| reduced-motion respected | PASS (system setting → Reduced; match-system OFF → Full) |
| 60 fps with a 6-effect burst | NOT PROVEN: ≈ 60 fps in headless Chromium, not measured on a real device |

## Not built / not verified
- See PHASE-STATUS.md "Phase 13 NOT built": pill morph, SL / TP drag ghost, best-trade confetti, ticket / Settings spring sheets, sliding tab underline, per-tick pill P/L flash, price-alert emitter, rejection "Fix" button.
- Not verified: real phone / GPU performance, Safari, light / paper themes of the new popup colours, the stop-out vignette and margin border on a really slow device, screen-reader announcements of the popup.
