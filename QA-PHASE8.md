# Demo Terminal — Phase 8 QA report

Legend: **PASS** = checked by an automated test in this repo · **PARTIAL** = the logic is tested, the on-screen
part is not · **NOT VERIFIED** = needs a real browser / phone / your Supabase project; nothing here could run
those. Run everything with `bash tests/all.sh`.

## Final QA checklist

| # | Check | Result | Evidence / what is left |
|---|-------|--------|-------------------------|
| 1 | Margin, P&L, pip value match hand-calculated examples (forex, gold, JPY, index) | **PASS** | `terminal-phase8.test.mjs` — 12 hand-worked checks: EURUSD 1 lot +10 pips = $100, margin $1,100; XAUUSD 1 lot +$1 = $100, margin $2,000; USDJPY pip $6.667, 10 pips $66.67, margin $1,000; NIFTY50 100 pts = $60.24 (₹83/$). Also `terminal-engine` / `terminal-ledger` from earlier phases. |
| 2 | Insufficient margin blocks the order with a clear message | **PARTIAL** | Engine refuses 10 lots on $10k @1:100 with a "margin" message (tested). That the ticket *shows* it is not browser-verified. |
| 3 | Stop-out closes the worst position at < 50 % margin level | **PASS** | Two-position scenario at ≈42 % margin level: the larger loser closes with reason `stopout`, the other stays (`terminal-phase8.test.mjs`). |
| 4 | SL / TP / pending fire on the correct side (bid vs ask), incl. gaps | **PASS** | BUY SL/TP on bid, SELL SL/TP on ask, gap fills at the gapped price (`terminal-phase8`, plus the pending-order cases in `terminal-orders` / `terminal-phase4`). |
| 5 | Dragging SL/TP on the chart updates the order and persists after refresh | **PARTIAL** | Modify-position logic and persistence are tested; the **drag gesture itself is not verified** (needs a browser). |
| 6 | Refresh / close / reopen: positions & orders intact; missed triggers replayed | **PARTIAL** | Offline catch-up replay is unit-tested (`terminal-phase4`); persistence is zustand `persist`. A real close-and-reopen is not verified. |
| 7 | Second device login shows the same account, positions, history | **PARTIAL** | Full round trip against a **fake** Supabase with two simulated devices (`terminal-phase7*.test.mjs`, 88 checks incl. conflicts, resets, races). **Not run against your real Supabase** — see the open points below. |
| 8 | Existing features unchanged (mind map, Trade Analysis, Strategy Tester, share links, PWA install) | **PARTIAL** | All earlier test suites unchanged and green; 169 render checks; production build OK. No manual click-through of mind map / share links / PWA install. The 4 import-graph errors in the Strategy Tester were already in the Phase 6 zip. |
| 9 | 360 px phone layout usable with one thumb; chart pinch-zoom works | **NOT VERIFIED** | Needs a phone. Touch targets were enlarged on touch screens (`@media (pointer: coarse)`) but never seen on a screen. |
| 10 | No API key in the shipped zip or browser network calls (only `/api/*`) | **PASS (trivially)** | Secret scan of `src/ public/ tests/ *.md .env.example` is clean and the terminal makes **no network calls** except Supabase sync. **But there is no `/api/` folder at all:** the Phase 1 real-data proxy (`api/candles.js`, `api/quote.js`, `restFeed`, `liveFeed`) was never built — prices are simulated only. |

## Phase 8 deliverables

| Item | Status |
|------|--------|
| Settings: spread fixed / variable, slippage on/off, commission per lot, stop-out level, one-click, sounds, default lots | **Built** (gear button in the terminal's second row). Logic tested (`terminal-phase8*.test.mjs`); panel render-tested in all variants; not seen in a browser. |
| Keyboard shortcuts: B/S, Enter, Esc, 1–8, +/−, ? | **Built.** The "stay out of the way of typing" guard is tested; the key → action wiring is not browser-tested. |
| Wake-lock option | **Built** (Settings → Keep screen on; this device only; hidden where the browser lacks the API). Not verified on a phone. |
| PWA: offline view of history/positions | **Built, unverified offline.** Service worker cache bumped to `v2`; people who already use the terminal get its lazy chunk fetched once while idle so it is cached; an "Offline" badge shows immediately. "Live data resumes on reconnect" does not apply — prices are simulated locally and need no network. |
| Accessibility | **Partly done:** aria-labels / `aria-pressed` on icon buttons, visible keyboard focus ring, ≥40 px touch targets on touch screens for top-bar controls, P&L always carries a +/− sign (never colour alone), settings switches show ON/OFF text. No screen-reader pass was done. |
| Lazy loading | Already in place: the terminal screen and `lightweight-charts` are a separate 83 KB-gzip chunk, not in the main bundle. The always-loaded part grew by ~16 KB raw (cloud sync + settings logic, +0.7 %). |
| Performance audit | **Partly done** (`terminal-perf.test.mjs`): 200,000 engine ticks with 25 live positions/orders → 3.8 µs per tick, no heap growth after GC; all 12 indicators on 6,000 bars = 103 ms total (slowest 16 ms); a full 2,000-trade cloud row builds in 6 ms and is 172 KB. **Not run:** Lighthouse, long-task profiling, the 30-minute browser memory test. |

## How commission, slippage and spread work (so the numbers are not a surprise)

- **Commission** — USD per lot, charged when lots are closed (round turn). Stored on the account, so it syncs. A trade's `pnl` in history is **net**, `commission` is recorded beside it.
- **Slippage** — market BUY/SELL, closes, partial closes and reversals fill up to 0.5 pip (0.5 point on the index) **worse** than the screen price, never better. Pending-order fills, SL/TP/stop-out fills are unaffected.
- **Variable spread** — 1–1.2× normal most of the time, about 2× now and then, 3–6× in rare spikes; deterministic per 10 s, so offline catch-up sees the same spread the live chart did.

## Manual test list for you (≈10 minutes)

1. Phone (≈360 px wide): open the terminal, pinch-zoom and drag the chart, open the order ticket sheet, place and close a trade with one hand.
2. Laptop: press `?`, then `B` → `Enter` to buy, `Esc` to cancel a confirmation, `1`…`8` for timeframes, `+` / `-` to zoom.
3. Settings: set commission to 7, slippage on, spread variable → open and close a 1-lot trade; the closed trade's P&L should be gross minus $7, and entry/exit slightly worse than the quote.
4. Drag a stop-loss line, refresh the page, confirm it is still where you left it.
5. Turn on airplane mode in the installed PWA: the terminal should still open and show positions / history with an "Offline" badge.
6. Two devices, same login (after running the §3f SQL): trade on one, open the other.
7. Mind map, Trade Analysis, Strategy Tester, a share link: open each once.

## Still open

- **Real Supabase:** the compare-and-swap save filters on the exact `updated_at` text Supabase returns. It works against the fake; confirm it with two real devices. Run both SQL blocks in `SUPABASE_SETUP.md` §3f.
- **Real price data (Phase 1):** not built. Everything is simulated, so "data delayed" badges, API rate limits and `/api/*` do not exist yet.
- **Pre-existing:** the Strategy Tester imports `isFieldFilled`, `rrrToNumber` and `FIELD_BY_ID` from `strategyTesterFields.js`, which does not export them (the import-graph test flags it; the build still passes). "Clear all data" is gated by a hard-coded client-side password.
